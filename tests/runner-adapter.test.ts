import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getRunnerConfig } from "@/features/submissions/config";
import { makeProgram, makeStdin, runnerSupports } from "@/features/submissions/harness";
import { executeJudge0, judgeOutcome } from "@/features/submissions/judge0";
const config = { url: "https://runner.example/", key: "private-key", auth: "token" as const, languageId: 102 };
const b64 = (s: string) => Buffer.from(s).toString("base64");
const raw = (output: string, id = 3) => ({ status: { id }, stdout: b64(output), stderr: null, compile_output: null, time: "0.012", memory: 1234 });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("runner configuration and harness", () => {
  it("requires explicit opt-in, credentials, HTTPS origin and a configured language", () => {
    for (const [key, value] of Object.entries({ CODE_RUNNER_ENABLED: "true", JUDGE0_API_URL: config.url, JUDGE0_API_KEY: config.key,
      JUDGE0_AUTH_MODE: "token", JUDGE0_JAVASCRIPT_LANGUAGE_ID: "102" })) vi.stubEnv(key, value);
    expect(getRunnerConfig()).toEqual(config);
    for (const url of ["", "bad", "http://runner.example/", "https://runner.example/?key=x", "https://user:pass@runner.example/", "https://runner.example/path"]) {
      vi.stubEnv("JUDGE0_API_URL", url); expect(getRunnerConfig()).toBeNull();
    }
    vi.stubEnv("JUDGE0_API_URL", config.url); vi.stubEnv("CODE_RUNNER_ENABLED", "false"); expect(getRunnerConfig()).toBeNull();
    vi.stubEnv("CODE_RUNNER_ENABLED", "true"); vi.stubEnv("JUDGE0_API_KEY", ""); expect(getRunnerConfig()).toBeNull();
  });
  it("uses named argument order, rejects unsupported signatures and never embeds expected values", () => {
    expect(makeStdin("relay-window", { width: 2, loads: [4, 5] })).toBe("[[4,5],2]");
    expect(makeStdin("parcel-checkpoints", { ranges: [[0, 1]], parcels: [4, 5] })).toBe("[[4,5],[[0,1]]]");
    expect(makeStdin("dock-threshold", { load: 8, capacities: [3, 9] })).toBe("[[3,9],8]");
    expect(makeStdin("quiet-badge", { badges: "aab" })).toBe('["aab"]');
    expect(makeStdin("lantern-steps", { costs: [1, 2] })).toBe("[[1,2]]");
    for (const slug of ["unknown", "constructor", "__proto__"]) {
      expect(runnerSupports(slug)).toBe(false); expect(() => makeProgram(slug, "solve", "code")).toThrow();
    }
    expect(() => makeProgram("relay-window", "x);evil()", "code")).toThrow();
    expect(() => makeStdin("relay-window", { width: 2 })).toThrow();
    const source = makeProgram("relay-window", "relayWindow", "function relayWindow() { return 13; }");
    expect(source).toContain("return relayWindow;"); expect(source).toContain('readFileSync(0, "utf8")');
    expect(source).not.toContain("expected");
  });
});

describe("trusted verdict calculation", () => {
  it("compares structured JSON without coercion and independently of provider acceptance", () => {
    expect(judgeOutcome(raw('{"b":2,"a":1}'), { a: 1, b: 2 })?.status).toBe("ACCEPTED");
    for (const output of ['"13"', "14", "console log\n13", "undefined"]) expect(judgeOutcome(raw(output), 13)?.status).toBe("WRONG_ANSWER");
    expect(judgeOutcome(raw("[2,1]"), [1, 2])?.status).toBe("WRONG_ANSWER");
    expect(judgeOutcome(raw("13"), 13)).toMatchObject({ status: "ACCEPTED", runtimeMs: 12, memoryKb: 1234 });
    expect(judgeOutcome(raw("13", 4), 13)?.status).toBe("WRONG_ANSWER");
  });
  it("distinguishes queued, compile, runtime, timeout and infrastructure failures", () => {
    expect(judgeOutcome(raw("", 1), null)).toBeNull(); expect(judgeOutcome(raw("", 2), null)).toBeNull();
    for (const [id, status] of [[5, "TIME_LIMIT"], [6, "COMPILE_ERROR"], [11, "RUNTIME_ERROR"], [13, "INTERNAL_ERROR"], [14, "INTERNAL_ERROR"]] as const)
      expect(judgeOutcome(raw("", id), null)?.status).toBe(status);
    expect(() => judgeOutcome(raw("", 99), null)).toThrow();
    expect(() => judgeOutcome({ ...raw("13"), stdout: "invalid%" }, 13)).toThrow();
    expect(judgeOutcome({ ...raw("13"), time: null, memory: null }, 13)).toMatchObject({ runtimeMs: null, memoryKb: null });
  });
  it("compares full bounded output before truncating visible diagnostics", () => {
    const value = "x".repeat(5000);
    const result = judgeOutcome({ ...raw(JSON.stringify(value)), stderr: b64(value) }, value);
    expect(result?.status).toBe("ACCEPTED"); expect(result?.stdout).toHaveLength(4000); expect(result?.diagnostic).toHaveLength(4000);
  });
});

describe("Judge0 transport with an inert HTTP stub", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  it("sends only source/stdin, forces sandbox limits, polls privately and compares output", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ token: "00000000-0000-4000-8000-000000000001" })).mockResolvedValueOnce(Response.json(raw("13")));
    const result = await executeJudge0(config, "source", [{ stdin: "[[1],1]", expected: 13 }], { timeMs: 2000, memoryKb: 262144 });
    expect(result[0].status).toBe("ACCEPTED");
    const [url, request] = fetchMock.mock.calls[0]; const body = JSON.parse(request.body);
    expect(url.toString()).toBe("https://runner.example/submissions?base64_encoded=true&wait=false");
    expect(body).toMatchObject({ enable_network: false, number_of_runs: 1, max_file_size: 64, wall_time_limit: 5, max_processes_and_or_threads: 32 });
    for (const key of ["expected_output", "callback_url", "additional_files", "compiler_options", "command_line_arguments"]) expect(body).not.toHaveProperty(key);
    expect(Buffer.from(body.source_code, "base64").toString()).toBe("source");
    expect(request.headers).toMatchObject({ "X-Auth-Token": "private-key" });
    expect(request.redirect).toBe("error"); expect(request.cache).toBe("no-store");
    expect(fetchMock.mock.calls[1][0].toString()).not.toContain("private-key");
  });
  it("supports explicit RapidAPI headers without accepting browser header/URL overrides", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ token: "00000000-0000-4000-8000-000000000002" })).mockResolvedValueOnce(Response.json(raw("0")));
    await executeJudge0({ ...config, auth: "rapidapi" }, "source", [{ stdin: "[]", expected: 0 }], { timeMs: 9000, memoryKb: 500000 });
    const req = fetchMock.mock.calls[0][1];
    expect(req.headers).toMatchObject({ "X-RapidAPI-Key": config.key, "X-RapidAPI-Host": "runner.example" });
    expect(JSON.parse(req.body)).toMatchObject({ cpu_time_limit: 2, memory_limit: 262144 });
  });
  it("fails closed on provider errors, oversized responses and invalid tokens", async () => {
    for (const response of [new Response("secret", { status: 401 }), new Response("x".repeat(128001)), Response.json({ token: "../../secret" })]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(executeJudge0(config, "source", [{ stdin: "[]", expected: 0 }], { timeMs: 2000, memoryKb: 262144 })).rejects.toThrow();
    }
  });
  it("bounds queue polling and never treats unfinished work as accepted", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(Response.json({ token: "00000000-0000-4000-8000-000000000002" }));
    fetchMock.mockImplementation(async () => Response.json(raw("", 2)));
    const promise = expect(executeJudge0(config, "source", [{ stdin: "[]", expected: 0 }], { timeMs: 2000, memoryKb: 262144 })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(21000); await promise;
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(31);
  });
});
