import { PYTHON_SUPERVISOR } from '../../src/features/submissions/python-supervisor';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Sandbox } from "@vercel/sandbox";
import { createVercelSandboxExecutor, PYTHON_BOOTSTRAP, PYTHON_SANDBOX_IMAGE, type SandboxFactory } from "../../src/features/submissions/python-vercel-sandbox";

// Fixed trusted workloads only. No expected values, caller environment, or credentials enter any VM.
const report = "/tmp/algosprint-python-cpu-diagnostic-result.json";
const targets = [0, 0.8, 1.8] as const;
const sources = targets.map(target => `import json,sys,time\np0=time.process_time()\nw0=time.monotonic()\nprint(json.dumps({"stage":"entry","processCpu":p0,"monotonic":w0,"target":${target}}),file=sys.stderr,flush=True)\nwhile time.process_time()-p0 < ${target}: pass\nprint(json.dumps({"stage":"done","cpuDelta":time.process_time()-p0,"wallDelta":time.monotonic()-w0}),file=sys.stderr,flush=True)\nprint(42,flush=True)\n`);
const ids: string[] = [];
const phases: Record<string, unknown>[] = [];
const results: Record<string, unknown>[] = [];
let finalStates: {name: string; status: string|undefined}[] = [];
function save(extra: object = {}) {
 writeFileSync(report, JSON.stringify({image:PYTHON_SANDBOX_IMAGE,supervisorSha256:createHash("sha256").update(PYTHON_SUPERVISOR).digest("hex"),bootstrapSha256:createHash("sha256").update(PYTHON_BOOTSTRAP).digest("hex"),executorSha256:createHash("sha256").update(readFileSync(new URL("../../src/features/submissions/python-vercel-sandbox.ts",import.meta.url))).digest("hex"),ids,phases,results,finalStates,...extra},null,2));
}
const factory: SandboxFactory = async signal => {
 const t=performance.now();
 const vm=await Sandbox.create({image:PYTHON_SANDBOX_IMAGE,resources:{vcpus:1},timeout:30000,persistent:false,networkPolicy:"deny-all",ports:[],signal});
 ids.push(vm.name);
 const phase:Record<string,unknown>={name:vm.name,createMs:performance.now()-t}; phases.push(phase); save();
 return {
  readFileToBuffer:async(file,options)=>{const b=await vm.readFileToBuffer(file,options);if(b&&b.length<=4096)phase.accounting=JSON.parse(b.toString("utf8"));save();return b;},
  writeFiles:async(files,options)=>{const t=performance.now();try{await vm.writeFiles(files,options);}finally{phase.writeMs=performance.now()-t;save();}},
  runCommand:async options=>{
   const t=performance.now();const cmd=await vm.runCommand({...options,detached:true});phase.commandCreateMs=performance.now()-t;save();
   return {
    logs:options=>cmd.logs(options),
    kill:(signal,options)=>cmd.kill(signal,options),
    wait:async options=>{const t=performance.now();try{const result=await cmd.wait(options);phase.providerExitCode=result.exitCode;return result;}catch(error){phase.waitError=error instanceof Error?error.name:"Error";throw error;}finally{phase.waitAfterHandleMs=performance.now()-t;save();}},
   };
  },
  stop:async options=>{const t=performance.now();try{return await vm.stop(options);}finally{phase.stopMs=performance.now()-t;save();}},
 };
};
if(!process.argv.includes("--run")) {
 console.log(JSON.stringify({image:PYTHON_SANDBOX_IMAGE,supervisorSha256:createHash("sha256").update(PYTHON_SUPERVISOR).digest("hex"),bootstrapSha256:createHash("sha256").update(PYTHON_BOOTSTRAP).digest("hex"),sources,maxVMs:3,serial:true,caseLimits:{timeMs:2000,memoryKb:262144,totalMs:20000},report},null,2));
} else {
 assert(process.env.VERCEL_OIDC_TOKEN,"Load current development OIDC caller credentials first");
 const claims=JSON.parse(Buffer.from(process.env.VERCEL_OIDC_TOKEN.split(".")[1],"base64url").toString());
 assert.equal(claims.project_id,"prj_qhKaYl3Jy46DlwkzsGtOnkvhW8gR");assert.equal(claims.owner_id,"team_7eA3jsANeEllHR66QIPnyM6k");assert.equal(claims.environment,"development");assert(claims.exp*1000>Date.now()+180000,"Refresh caller credentials first");
 const active=(await (await Sandbox.list()).toArray()).filter(vm=>["running","pending","stopping"].includes(vm.status));
 assert.equal(active.length,0,"Other live VMs found; coordinate before running");
 try {
  const executor=createVercelSandboxExecutor(factory);
  for(let i=0;i<targets.length;i++) {
   const t=performance.now();
   const run=await executor.runCase({source:sources[i],stdin:"[]",timeMs:2000,memoryKb:262144,signal:AbortSignal.timeout(20000)});
   results.push({targetCpuSeconds:targets[i],elapsedMs:performance.now()-t,run});save();
   console.log(JSON.stringify({targetCpuSeconds:targets[i],run}));
  }
 } catch(error) {save({failed:true,error:error instanceof Error?error.name:"Error"});throw error;}
 finally {
  try {
   for(let attempt=0;attempt<4;attempt++) {
    const all=await (await Sandbox.list()).toArray();
    finalStates=ids.map(name=>({name,status:all.find(vm=>vm.name===name)?.status}));save();
    if(finalStates.every(vm=>vm.status==="stopped"))break;
    await new Promise(resolve=>setTimeout(resolve,500));
   }
   assert(finalStates.length===ids.length && finalStates.every(vm=>vm.status==="stopped"),"VM teardown not yet confirmed");
  } finally {delete process.env.VERCEL_OIDC_TOKEN;}
 }
}
