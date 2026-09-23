import "server-only";
import { z } from "zod";

const schema = z.object({
  url: z.url().refine((value) => {
    try { const u = new URL(value); return u.protocol === "https:" && u.pathname === "/" && !u.username && !u.password && !u.search && !u.hash; }
    catch { return false; }
  }),
  key: z.string().min(1).max(512).regex(/^[\x21-\x7e]+$/),
  auth: z.enum(["token", "rapidapi"]),
  languageId: z.coerce.number().int().positive().max(10000),
});
export type Judge0Config = z.infer<typeof schema>;
// "judge0" calls an external provider; "sandbox" runs the harness in the in-process QuickJS WebAssembly interpreter.
export type RunnerConfig = ({ provider: "judge0" } & Judge0Config) | { provider: "sandbox" };
export function getRunnerConfig(): RunnerConfig | null {
  if (process.env.CODE_RUNNER_ENABLED !== "true") return null;
  const provider = process.env.CODE_RUNNER_PROVIDER ?? "judge0";
  if (provider === "sandbox") return { provider: "sandbox" };
  if (provider !== "judge0") return null;
  const parsed = schema.safeParse({ url: process.env.JUDGE0_API_URL, key: process.env.JUDGE0_API_KEY,
    auth: process.env.JUDGE0_AUTH_MODE ?? "token", languageId: process.env.JUDGE0_JAVASCRIPT_LANGUAGE_ID });
  return parsed.success ? { provider: "judge0", ...parsed.data } : null;
}
