import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Sandbox } from '@vercel/sandbox';
import { createVercelSandboxExecutor, PYTHON_BOOTSTRAP, PYTHON_SANDBOX_IMAGE, type SandboxFactory } from '../../src/features/submissions/python-vercel-sandbox';
import { PYTHON_SUPERVISOR, PYTHON_USAGE_PATH } from '../../src/features/submissions/python-supervisor';
import { mapPythonRun } from '../../src/features/submissions/python-runner';

// Manual, fixed-source probes only. Dry by default. Caller credentials never enter any VM.
const cases = [
  { name: 'ignore-sigxcpu', status: 'TIME_LIMIT', source: 'import signal\nsignal.signal(signal.SIGXCPU,signal.SIG_IGN)\nwhile True: pass' },
  { name: 'overbudget-normal-return', status: 'TIME_LIMIT', source: 'import time,json\nt=time.process_time()\nwhile time.process_time()-t < 2.2: pass\nprint(json.dumps(True))' },
  { name: 'normal-exit137', status: 'RUNTIME_ERROR', source: 'import os\nos._exit(137)' },
  { name: 'self-sigkill-low-cpu', status: 'INTERNAL_ERROR', source: 'import os,signal\nos.kill(os.getpid(),signal.SIGKILL)' },
  { name: 'root-parent-metadata-protection', status: 'ACCEPTED', source: String.raw`import ctypes, errno, json, os, signal
parent=os.getppid()
assert parent > 1
status=dict(line.split(':',1) for line in open('/proc/%d/status'%parent))
assert status['Uid'].split() == ['0']*4
for sig in (0,signal.SIGTERM):
 try: os.kill(parent,sig)
 except PermissionError: pass
 else: raise AssertionError('root parent signal allowed')
for path,mode in (('/proc/%d/mem'%parent,'rb'),('/proc/%d/environ'%parent,'rb'),('/root/algosprint/result.json','wb'),('/root/algosprint/result.json','rb')):
 try: f=open(path,mode)
 except PermissionError: pass
 else: f.close(); raise AssertionError('protected parent or accounting file accessible')
libc=ctypes.CDLL(None,use_errno=True)
# PTRACE_ATTACH and process_vm_writev must fail before any root memory can change.
ctypes.set_errno(0)
assert libc.ptrace(16,parent,0,0)==-1 and ctypes.get_errno()==errno.EPERM
class Iovec(ctypes.Structure): _fields_=[('base',ctypes.c_void_p),('length',ctypes.c_size_t)]
byte=ctypes.create_string_buffer(b'X'); local=Iovec(ctypes.cast(byte,ctypes.c_void_p),1); remote=Iovec(1,1)
ctypes.set_errno(0)
assert libc.process_vm_writev(parent,ctypes.byref(local),1,ctypes.byref(remote),1,0)==-1 and ctypes.get_errno()==errno.EPERM
# Learner-owned output/files cannot replace the trusted root-owned accounting path.
open('/tmp/fake-result.json','w').write('{"version":1,"cpuMs":0}')
try: os.symlink('/tmp/fake-result.json','/root/algosprint/result.json')
except PermissionError: pass
else: raise AssertionError('root accounting path replaced')
print(json.dumps(True))
` },
] as const;
const report='/tmp/algosprint-python-supervisor-security-result.json';
const ids:string[]=[];
const handles:Sandbox[]=[];
const results:object[]=[];
const metadata:object[]=[];
const states:object[]=[];
const hashes={image:PYTHON_SANDBOX_IMAGE,supervisorSha256:createHash('sha256').update(PYTHON_SUPERVISOR).digest('hex'),bootstrapSha256:createHash('sha256').update(PYTHON_BOOTSTRAP).digest('hex'),executorSha256:createHash('sha256').update(readFileSync(new URL('../../src/features/submissions/python-vercel-sandbox.ts',import.meta.url))).digest('hex')};
function save(extra:object={}) { writeFileSync(report,JSON.stringify({...hashes,ids,results,metadata,states,...extra},null,2)); }
const factory:SandboxFactory=async signal=>{
 const vm=await Sandbox.create({image:PYTHON_SANDBOX_IMAGE,resources:{vcpus:1},timeout:30000,persistent:false,networkPolicy:'deny-all',ports:[],signal});
 handles.push(vm);ids.push(vm.name);save();
 return {
  writeFiles:(files,options)=>vm.writeFiles(files,options),
  readFileToBuffer:async(file,options)=>{const raw=await vm.readFileToBuffer(file,options);if(file.path===PYTHON_USAGE_PATH&&raw){assert(raw.length<=4096);metadata.push({name:vm.name,usage:JSON.parse(raw.toString('utf8'))});save();}return raw;},
  runCommand:options=>vm.runCommand({...options,detached:true}),
  stop:options=>vm.stop(options),
 };
};
if(!process.argv.includes('--run')) {
 console.log(JSON.stringify({...hashes,maxVMs:cases.length,serial:true,cases},null,2));
} else {
 assert(process.env.VERCEL_OIDC_TOKEN,'Load development OIDC credentials through provider workflow');
 const claims=JSON.parse(Buffer.from(process.env.VERCEL_OIDC_TOKEN!.split('.')[1],'base64url').toString());
 assert.equal(claims.project_id,'prj_qhKaYl3Jy46DlwkzsGtOnkvhW8gR');assert.equal(claims.owner_id,'team_7eA3jsANeEllHR66QIPnyM6k');assert.equal(claims.environment,'development');assert(claims.exp*1000>Date.now()+180000);
 // SDK paginator toArray() follows every page, rather than checking only the first page.
 const existing=await(await Sandbox.list({signal:AbortSignal.timeout(15000)})).toArray();
 assert.equal(existing.filter(s=>['running','pending','stopping'].includes(s.status)).length,0,'Coordinate other live sandboxes first');
 let failed:unknown;
 try {
  const executor=createVercelSandboxExecutor(factory);
  for(const test of cases){
   const start=Date.now();
   const run=await executor.runCase({source:test.source,stdin:'[]',timeMs:2000,memoryKb:262144,signal:AbortSignal.timeout(20000)});
   const outcome=mapPythonRun(run,true,{timeMs:2000,memoryKb:262144});
   results.push({name:test.name,elapsedMs:Date.now()-start,run,outcome});save();
   console.log(test.name,outcome.status);assert.equal(outcome.status,test.status,test.name);
  }
 } catch(error){failed=error;save({failed:true,error:error instanceof Error?error.message:'failure'});}
 finally {
  // Independent cleanup also runs when an assertion or executor cleanup fails. No provider command is left running.
  await Promise.allSettled(handles.map(vm=>vm.stop({signal:AbortSignal.timeout(3000)})));
  let stopped=false;
  try{
   for(let attempt=0;attempt<5;attempt++){
    const all=await(await Sandbox.list({signal:AbortSignal.timeout(15000)})).toArray();
    states.splice(0,states.length,...ids.map(name=>({name,status:all.find(vm=>vm.name===name)?.status??'missing'})));
    stopped=states.every(value=>(value as {status:string}).status==='stopped');save({cleanupVerified:stopped});
    if(stopped)break;
    await new Promise(resolve=>setTimeout(resolve,500));
   }
  }finally{delete process.env.VERCEL_OIDC_TOKEN;}
  assert(stopped,'Some probe VMs are not confirmed stopped; inspect saved report');
 }
 if(failed)throw failed;
 console.log('ALL_SUPERVISOR_SECURITY_PROBES_PASS',ids.length);
}
