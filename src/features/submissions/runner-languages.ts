import "server-only";
import type { RunnerConfig } from "./config";
import type { ExecutionLanguage } from "./contracts";
import { getPythonExecutor } from "./python-runner";

// Languages the configured runner can execute on the server. JavaScript is always runnable when a runner is configured.
// Python needs the in-process provider and an installed executor; Judge0 has no reviewed Python language id.
export function supportedRunnerLanguages(config: RunnerConfig | null): ExecutionLanguage[] {
  if (!config) return [];
  const languages: ExecutionLanguage[] = ["JAVASCRIPT"];
  if (config.provider === "sandbox" && getPythonExecutor().available) languages.push("PYTHON");
  return languages;
}
