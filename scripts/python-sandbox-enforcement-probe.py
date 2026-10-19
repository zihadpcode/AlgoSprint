"""Trusted, bounded capability probe. No learner code or application data enters this VM."""

import json
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import time

ROOT = pathlib.Path("/sys/fs/cgroup")
DEADLINE = time.monotonic() + 8
results = {}


def remaining():
    return max(0.1, min(2.0, DEADLINE - time.monotonic()))


def value(path):
    return int(path.read_text().strip().split()[0])


def child(group, code, *args):
    # The supervisor stays outside the child cgroup and can always kill it.
    def enter_group():
        (group / "cgroup.procs").write_text(str(os.getpid()))

    return subprocess.Popen(
        [sys.executable, "-I", "-c", code, *args],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, close_fds=True, preexec_fn=enter_group,
        env={"PATH": "/usr/bin:/bin"},
    )


def group(label):
    path = ROOT / ("algosprint-probe-" + label + "-" + str(os.getpid()))
    path.mkdir()
    return path


def cleanup(path, processes):
    try:
        (path / "cgroup.kill").write_text("1")
    finally:
        for process in processes:
            try:
                process.wait(timeout=remaining())
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=remaining())
        path.rmdir()


def check_memory():
    path = group("memory")
    processes = []
    try:
        (path / "memory.max").write_text(str(32 * 1024 * 1024))
        (path / "memory.swap.max").write_text("0")
        before = events(path)["oom_kill"]
        process = child(path, "x=bytearray(96*1024*1024); print(len(x))")
        processes.append(process)
        process.wait(timeout=remaining())
        results["memory"] = {
            "limitBytes": value(path / "memory.max"),
            "swapLimitBytes": value(path / "memory.swap.max"),
            "oomKillObserved": events(path)["oom_kill"] > before,
        }
    finally:
        cleanup(path, processes)


def events(path):
    return {name: int(number) for name, number in
            (line.split() for line in (path / "memory.events").read_text().splitlines())}


def check_cpu():
    path = group("cpu")
    processes = []
    try:
        (path / "cpu.max").write_text("20000 100000")
        code = "import time; end=time.monotonic()+0.6\nwhile time.monotonic()<end: pass"
        process = child(path, code)
        processes.append(process)
        process.wait(timeout=remaining())
        stats = {name: int(number) for name, number in
                 (line.split() for line in (path / "cpu.stat").read_text().splitlines())}
        results["cpu"] = {
            "max": (path / "cpu.max").read_text().strip(),
            "throttled": stats.get("nr_throttled", 0) > 0,
        }
    finally:
        cleanup(path, processes)


def check_processes():
    path = group("processes")
    processes = []
    try:
        (path / "pids.max").write_text("4")
        code = """import subprocess, sys, time
children=[]
for _ in range(8):
    try: children.append(subprocess.Popen([sys.executable,'-I','-c','import time; time.sleep(1)']))
    except OSError: break
for child in children: child.wait()
"""
        process = child(path, code)
        processes.append(process)
        process.wait(timeout=remaining())
        pids_events = {name: int(number) for name, number in
                       (line.split() for line in (path / "pids.events").read_text().splitlines())}
        results["processes"] = {
            "limit": value(path / "pids.max"),
            "limitHit": pids_events.get("max", 0) > 0,
        }
    finally:
        cleanup(path, processes)


def check_descendants():
    path = group("cancel")
    processes = []
    try:
        with tempfile.TemporaryDirectory(prefix="algosprint-probe-") as directory:
            marker = pathlib.Path(directory) / "child.pid"
            code = """import subprocess, sys, time
p=subprocess.Popen([sys.executable,'-I','-c','import time; time.sleep(10)'])
open(sys.argv[1],'w').write(str(p.pid))
time.sleep(10)
"""
            parent = child(path, code, str(marker))
            processes.append(parent)
            end = time.monotonic() + remaining()
            while not marker.exists() and time.monotonic() < end:
                time.sleep(0.02)
            if not marker.exists():
                raise RuntimeError("descendant marker not written")
            descendant = int(marker.read_text())
            (path / "cgroup.kill").write_text("1")
            parent.wait(timeout=remaining())
            # A killed child may remain a zombie briefly; cgroup.events measures
            # whether any process can still execute within this case boundary.
            populated = (path / "cgroup.events").read_text().splitlines()
            end = time.monotonic() + remaining()
            while "populated 0" not in populated and time.monotonic() < end:
                time.sleep(0.02)
                populated = (path / "cgroup.events").read_text().splitlines()
            results["cancellation"] = {
                "parentTerminated": parent.poll() is not None,
                "groupEmpty": "populated 0" in populated,
                "descendantWasCreated": descendant > 0,
            }
    finally:
        cleanup(path, processes)


def check_network():
    # No credentials, no payload, and a fixed 300 ms timeout. A successful
    # connection is a failed isolation check, not an invitation to proceed.
    try:
        with socket.create_connection(("1.1.1.1", 443), timeout=0.3):
            results["network"] = {"directEgressDenied": False}
    except OSError:
        results["network"] = {"directEgressDenied": True}


for name, check in [
    ("memory", check_memory), ("cpu", check_cpu),
    ("processes", check_processes), ("cancellation", check_descendants),
    ("network", check_network),
]:
    if time.monotonic() >= DEADLINE:
        results[name] = {"error": "probe deadline reached"}
        break
    try:
        check()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        results[name] = {"errorType": type(error).__name__}

print(json.dumps({"trustedProbeOnly": True, "results": results,
                  "learnerIsolationVerified": False,
                  "networkEnforcementVerified": results.get("network", {}).get("directEgressDenied", False),
                  "outputStreamEnforcementVerified": False}, separators=(",", ":")))
