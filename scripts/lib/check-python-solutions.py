"""Validate only the repository's reviewed Python editorials, never learner submissions.

Each code string is authored source from the checked-in add-on. This offline check
is not an execution backend and has no application credentials or database access.
"""
import ast
import copy
import json
import signal
import sys


class CaseTimeout(Exception):
    pass


def expired(_signum, _frame):
    raise CaseTimeout()


def same(actual, expected):
    if isinstance(actual, bool) or isinstance(expected, bool):
        return type(actual) is type(expected) and actual == expected
    if actual is None or expected is None:
        return actual is expected
    if isinstance(actual, list) and isinstance(expected, list):
        return len(actual) == len(expected) and all(same(a, b) for a, b in zip(actual, expected))
    if isinstance(actual, dict) and isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(same(actual[key], expected[key]) for key in actual)
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return actual == expected
    return type(actual) is type(expected) and actual == expected


signal.signal(signal.SIGALRM, expired)
sys.setrecursionlimit(15000)
report = {"solutions": 0, "checkedCases": 0, "slowBruteCases": [], "failures": []}
for job in json.load(sys.stdin):
    label = job["slug"] + ":" + job["kind"]
    checked = 0
    try:
        tree = ast.parse(job["code"], filename=label)
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == job["entryPoint"]]
        if len(functions) != 1:
            raise ValueError("Expected one top-level entry function")
        args = functions[0].args
        if [arg.arg for arg in args.posonlyargs + args.args] != job["parameters"] or args.vararg or args.kwarg or args.kwonlyargs or args.defaults:
            raise ValueError("Entry-point signature differs from the Python starter")
        scope = {"__name__": "editorial_validation"}
        exec(compile(tree, label, "exec"), scope)
        solve = scope[job["entryPoint"]]
        for index, case in enumerate(job["cases"]):
            try:
                # Slow exhaustive approaches teach a tradeoff; their large stored
                # cases may exceed the judge budget. Every approach must still
                # demonstrate correctness on at least two bounded cases.
                signal.setitimer(signal.ITIMER_REAL, 0.15 if job["kind"] == "BRUTE_FORCE" else 5)
                actual = solve(*copy.deepcopy(case["args"]))
                # Round-trip disallows non-finite numbers and non-JSON returns.
                actual = json.loads(json.dumps(actual, allow_nan=False))
                if not same(actual, case["expected"]):
                    raise AssertionError("Output differs from the trusted stored expected result")
                checked += 1
            except CaseTimeout:
                if job["kind"] != "BRUTE_FORCE":
                    raise AssertionError("Non-brute approach exceeded the offline check budget")
                report["slowBruteCases"].append({"solution": label, "case": index + 1})
            finally:
                signal.setitimer(signal.ITIMER_REAL, 0)
        if checked < 2:
            raise AssertionError("Each approach needs at least two passing bounded cases")
        report["solutions"] += 1
        report["checkedCases"] += checked
    except Exception as error:
        signal.setitimer(signal.ITIMER_REAL, 0)
        report["failures"].append({"solution": label, "error": type(error).__name__ + ": " + str(error)})

json.dump(report, sys.stdout, separators=(",", ":"))
sys.stdout.write("\n")
sys.exit(1 if report["failures"] else 0)
