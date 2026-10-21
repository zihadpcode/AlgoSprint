import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Sandbox } from '@vercel/sandbox';
import { createVercelSandboxExecutor, PYTHON_BOOTSTRAP, PYTHON_SANDBOX_IMAGE, type SandboxFactory } from '../../src/features/submissions/python-vercel-sandbox';
import { executePython, mapPythonRun } from '../../src/features/submissions/python-runner';
import { makePythonProgram } from '../../src/features/submissions/harness-python';

// Operator-only, fixed trusted sources. Never puts the caller's OIDC token, environment or expected output in a VM.
const ids: string[] = [];
const results: object[] = [];
const providerPhases: {name:string;createMs:number;writeMs?:number;commandCreateMs?:number;waitAfterHandleMs?:number;stopMs?:number}[] = [];
const timingOnly = process.argv.includes('--timing-only');
const lifecycleOnly = process.argv.includes('--lifecycle-only');
const limits = {timeMs: 2000, memoryKb: 262144};
const report = lifecycleOnly ? '/tmp/algosprint-python-lifecycle-live-result.json' : timingOnly ? '/tmp/algosprint-python-timing-live-result.json' : '/tmp/algosprint-python-final-live-result.json';
const identity = String.raw`import ctypes, errno, json, os, resource, threading
assert os.getresuid() == (65534,)*3 and os.getresgid() == (65534,)*3 and os.getgroups() == []
s = dict(line.split(':',1) for line in open('/proc/self/status'))
assert s['NoNewPrivs'].strip() == '1'
assert all(int(s[k].strip(),16)==0 for k in ('CapInh','CapPrm','CapEff','CapBnd','CapAmb'))
for k in (resource.RLIMIT_AS,resource.RLIMIT_DATA): assert resource.getrlimit(k)==(268435456,)*2
for k in (resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_NPROC,resource.RLIMIT_NOFILE):
 h=resource.getrlimit(k)[1]
 try: resource.setrlimit(k,(h+1,h+1))
 except (ValueError,PermissionError): pass
 else: raise AssertionError('raised limit')
try: os.setuid(0)
except PermissionError: pass
else: raise AssertionError('root regained')
try: p=os.fork()
except OSError as e: assert e.errno==errno.EPERM
else:
 if p==0: os._exit(0)
 os.waitpid(p,0); raise AssertionError('fork allowed')
t=threading.Thread(target=lambda:None)
try: t.start()
except RuntimeError: pass
else: t.join(); raise AssertionError('thread allowed')
libc=ctypes.CDLL(None,use_errno=True)
# Fixed x86_64 raw clone (one child at most), clone3 and unshare user namespace.
assert os.uname().machine=='x86_64'
pid=libc.syscall(56,17,0,0,0,0)
if pid==0: libc.syscall(60,0)
if pid>0: os.waitpid(pid,0); raise AssertionError('raw clone allowed')
assert ctypes.get_errno() in (errno.EAGAIN,errno.EPERM,errno.ENOSYS)
class CloneArgs(ctypes.Structure): _fields_=[(k,ctypes.c_ulonglong) for k in ('flags','pidfd','child_tid','parent_tid','exit_signal','stack','stack_size','tls','set_tid','set_tid_size','cgroup')]
a=CloneArgs(); a.exit_signal=17
pid=libc.syscall(435,ctypes.byref(a),ctypes.sizeof(a))
if pid==0: libc.syscall(60,0)
if pid>0: os.waitpid(pid,0); raise AssertionError('clone3 allowed')
assert ctypes.get_errno() in (errno.EAGAIN,errno.EPERM,errno.ENOSYS)
ctypes.set_errno(0)
rc=libc.unshare(0x10000000); error=ctypes.get_errno()
assert rc==-1 and error==errno.EPERM, ('user namespace policy',rc,error)
for nr in (56,57,58,272,308,435,0x40000000,0x40000038,0x400001b3):
 ctypes.set_errno(0)
 assert libc.syscall(nr,0,0,0,0,0,0)==-1 and ctypes.get_errno()==errno.EPERM, nr
# A permissive additional filter cannot loosen the inherited one.
class F(ctypes.Structure): _fields_=[('code',ctypes.c_ushort),('jt',ctypes.c_ubyte),('jf',ctypes.c_ubyte),('k',ctypes.c_uint32)]
class P(ctypes.Structure): _fields_=[('len',ctypes.c_ushort),('filter',ctypes.POINTER(F))]
allow=(F*1)(F(0x06,0,0,0x7fff0000)); policy=P(1,allow)
assert libc.prctl(22,2,ctypes.byref(policy),0,0)==0
assert libc.prctl(22,0,0,0,0)==-1
ctypes.set_errno(0)
assert libc.unshare(0x10000000)==-1 and ctypes.get_errno()==errno.EPERM
assert libc.prctl(21,0,0,0,0)==2
print(json.dumps(True))
`;
const mappings = String.raw`import errno,mmap,os,json
for shared in (False,True):
 fd=os.open('/tmp/fixed-large-backing',os.O_RDONLY)
 try:
  # Root creates a sparse backing before limits. This exercises AS, not mmap's length check or FSIZE.
  try: m=mmap.mmap(fd,300*1024*1024,flags=mmap.MAP_SHARED if shared else mmap.MAP_PRIVATE,prot=mmap.PROT_READ,trackfd=False)
  except OSError as e: assert e.errno==errno.ENOMEM
  else: m.close(); raise AssertionError('oversize mapping allowed')
 finally: os.close(fd)
# Individually valid mappings must also count in aggregate; touch each accepted mapping.
fd=os.open('/tmp/fixed-large-backing',os.O_RDONLY)
held=[]
try:
 for i in range(8):
  try: m=mmap.mmap(fd,64*1024*1024,flags=mmap.MAP_SHARED,prot=mmap.PROT_READ,trackfd=False)
  except OSError as e: assert e.errno==errno.ENOMEM; break
  held.append(m)
  for offset in range(0,64*1024*1024,4096): _=m[offset]
 else: raise AssertionError('aggregate mappings exceeded AS')
 assert len(held)<4
finally:
 for m in held: m.close()
 os.close(fd)
print(json.dumps(True))
`;
const cases = [
 {name:'identity-process-syscalls',source:identity,expected:true,status:'ACCEPTED'},
 {name:'shared-private-mappings',source:mappings,expected:true,status:'ACCEPTED',mapping:true},
 {name:'correct-harness',source:makePythonProgram('solve','def solve(x): return x * 2'),stdin:'[21]',expected:42,status:'ACCEPTED'},
 {name:'syntax',source:makePythonProgram('solve','def solve(:'),expected:0,status:'COMPILE_ERROR'},
 {name:'runtime',source:makePythonProgram('solve','def solve(): return 1/0'),expected:0,status:'RUNTIME_ERROR'},
 {name:'cpu',source:'while True: pass',expected:0,status:'TIME_LIMIT'},
 {name:'sleep',source:'import time; time.sleep(10)',expected:0,status:'TIME_LIMIT'},
 {name:'heap',source:"a=bytearray(300*1024*1024)",expected:0,status:'MEMORY_LIMIT'},
 {name:'output-flood',source:"import os\nfor _ in range(128): os.write(1,b'x'*8192)",expected:0,status:'RUNTIME_ERROR'},
 {name:'setuid-exec',source:"import os\nos.execv('/tmp/fixed-root-id',['id','-u'])",expected:65534,status:'ACCEPTED',control:true},
 {name:'direct-sudo-exec',source:"import os\nos.execv('/usr/bin/sudo',['sudo','-n','/usr/bin/id','-u'])",expected:0,status:'RUNTIME_ERROR'},
 {name:'setup-nonroot',source:"print('LEARNER_RAN')",expected:0,status:'INTERNAL_ERROR',nonroot:true},
] as const;

function save(extra: object={}) { writeFileSync(report,JSON.stringify({image:PYTHON_SANDBOX_IMAGE,bootstrapSha256:createHash('sha256').update(PYTHON_BOOTSTRAP).digest('hex'),executorSha256:createHash('sha256').update(readFileSync(new URL('../../src/features/submissions/python-vercel-sandbox.ts',import.meta.url))).digest('hex'),ids,results,providerPhases,...extra},null,2)); }
function factory(mode?:{control?:boolean;nonroot?:boolean;mapping?:boolean;onCommand?:()=>void;onLearnerStarted?:()=>void}): SandboxFactory {
 return async signal=>{
  const creationStarted=Date.now();
  const vm=await Sandbox.create({image:PYTHON_SANDBOX_IMAGE,resources:{vcpus:1},timeout:30000,persistent:false,networkPolicy:'deny-all',ports:[],signal});
  const phase={name:vm.name,createMs:Date.now()-creationStarted} as (typeof providerPhases)[number];providerPhases.push(phase);
  ids.push(vm.name); save();
  try {
   if(mode?.mapping){
    const setup=await vm.runCommand({cmd:'python3',args:['-I','-c',"import os; f=open('/tmp/fixed-large-backing','wb'); f.truncate(300*1024*1024); f.close(); os.chmod('/tmp/fixed-large-backing',0o644)"],sudo:true,signal});assert.equal(setup.exitCode,0);
   }
   if(mode?.control){
    const setup=await vm.runCommand({cmd:'python3',args:['-I','-c',"import shutil,os; shutil.copyfile('/usr/bin/id','/tmp/fixed-root-id'); os.chown('/tmp/fixed-root-id',0,0); os.chmod('/tmp/fixed-root-id',0o4755)"],sudo:true,signal});
    assert.equal(setup.exitCode,0);
    const control=await vm.runCommand({cmd:'/tmp/fixed-root-id',args:['-u'],signal});
    assert.equal(control.exitCode,0); assert.equal((await control.stdout()).trim(),'0');
   }
  } catch(e) { await vm.stop(); throw e; }
  return {writeFiles:async(f,o)=>{const t=Date.now();try{await vm.writeFiles(f,o);}finally{phase.writeMs=Date.now()-t;}},runCommand:async o=>{const t=Date.now();const cmd=await vm.runCommand({...o,sudo:mode?.nonroot?false:true,detached:true});phase.commandCreateMs=Date.now()-t;mode?.onCommand?.();return {logs:async function*(o){let text='',seen=false;for await(const log of cmd.logs(o)){if(log.stream==='stdout'){text=(text+log.data).slice(-128);if(!seen&&text.includes('PROBE_STARTED')){seen=true;mode?.onLearnerStarted?.();}}yield log;}},kill:(s,o)=>cmd.kill(s,o),wait:async o=>{const t=Date.now();try{return await cmd.wait(o);}finally{phase.waitAfterHandleMs=Date.now()-t;}}};},stop:async o=>{const t=Date.now();try{return await vm.stop(o);}finally{phase.stopMs=Date.now()-t;}}};
 };
}
if(!process.argv.includes('--run')) {
 console.log(JSON.stringify({image:PYTHON_SANDBOX_IMAGE,bootstrapSha256:createHash('sha256').update(PYTHON_BOOTSTRAP).digest('hex'),cases:(timingOnly||lifecycleOnly?[]:cases).map(c=>({name:c.name,source:c.source,status:c.status})),additional:[...(!lifecycleOnly?['10 full-CPU cases in width5 under20s']:[]),'2 fresh-VM isolation cases','host abort after learner stdout marker'],maxVMs:lifecycleOnly?3:timingOnly?13:25}));
} else {
 assert(process.env.VERCEL_OIDC_TOKEN,'Load current development OIDC credentials through the provider workflow before --run');
 const claims=JSON.parse(Buffer.from(process.env.VERCEL_OIDC_TOKEN!.split('.')[1],'base64url').toString());
 assert.equal(claims.project_id,'prj_qhKaYl3Jy46DlwkzsGtOnkvhW8gR');assert.equal(claims.owner_id,'team_7eA3jsANeEllHR66QIPnyM6k');assert.equal(claims.environment,'development');assert(claims.exp*1000>Date.now()+180000,'refresh caller credentials first');
 const active=(await (await Sandbox.list()).toArray()).filter(s=>['running','pending','stopping'].includes(s.status));
 assert.equal(active.length,0,'Other live sandboxes found; coordinate before running');
 try {
  // Serial trusted boundary cases prevent accidental load or concurrent privileged controls.
  for(const c of timingOnly||lifecycleOnly?[]:cases) {
   const start=Date.now(); const ex=createVercelSandboxExecutor(factory({control:'control' in c && c.control,nonroot:'nonroot' in c && c.nonroot,mapping:'mapping' in c && c.mapping}));
   const run=await ex.runCase({source:c.source,stdin:'stdin' in c?c.stdin:'[]',...limits,signal:AbortSignal.timeout(20000)});
   const out=mapPythonRun(run,c.expected,limits); results.push({name:c.name,elapsedMs:Date.now()-start,run,outcome:out});save();
   console.log(c.name,out.status);assert.equal(out.status,c.status,c.name);
   if(c.name==='setup-nonroot') assert(!out.stdout.includes('LEARNER_RAN'));
  }
  const ex=createVercelSandboxExecutor(factory());
  if(!lifecycleOnly){
  const ten=makePythonProgram('solve',"def solve():\n import time\n t=time.process_time()\n while time.process_time()-t < 1.8: pass\n return 42");
  const start=Date.now();const outcomes=await executePython(ex,ten,Array.from({length:10},()=>({stdin:'[]',expected:42})),limits);
  results.push({name:'ten-full-cpu-cases',elapsedMs:Date.now()-start,outcomes});save();assert(outcomes.every(o=>o.status==='ACCEPTED'));assert(Date.now()-start<20000);
  }
  const isolated=makePythonProgram('solve',"def solve():\n import os\n p='/tmp/algosprint-isolation-marker'\n assert not os.path.exists(p)\n open(p,'w').write('fixed')\n return 7");
  const iso=await executePython(ex,isolated,[{stdin:'[]',expected:7},{stdin:'[]',expected:7}],limits);results.push({name:'fresh-case-isolation',outcomes:iso});save();assert(iso.every(o=>o.status==='ACCEPTED'));
  const abort=new AbortController();const started=Date.now();let commandCreated=false,learnerStarted=false;let timer:ReturnType<typeof setTimeout>|undefined;
  const cancelEx=createVercelSandboxExecutor(factory({onCommand:()=>{commandCreated=true;},onLearnerStarted:()=>{learnerStarted=true;timer=setTimeout(()=>abort.abort(),250);}}));
  const cancelled=await cancelEx.runCase({source:"import time;print('PROBE_STARTED',flush=True);time.sleep(10)",stdin:'[]',...limits,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])});clearTimeout(timer);
  results.push({name:'host-cancel',elapsedMs:Date.now()-started,commandCreated,learnerStarted,run:cancelled});save();assert(commandCreated&&learnerStarted);assert.equal(cancelled.kind,'unavailable');assert(Date.now()-started<10000);
  let states:{name:string;status:string|undefined}[]=[];
  for(let attempt=0;attempt<4;attempt++) { const all=await (await Sandbox.list()).toArray();states=ids.map(name=>({name,status:all.find(s=>s.name===name)?.status}));if(states.every(s=>s.status==='stopped'))break;await new Promise(r=>setTimeout(r,500)); }
  save({states});assert(states.every(s=>s.status==='stopped'));
  console.log('ALL_TRUSTED_PROBES_PASS',ids.length);
 } catch(e) { save({failed:true,error:e instanceof Error?e.message:'failure'});throw e; }
 finally { delete process.env.VERCEL_OIDC_TOKEN; }
}
