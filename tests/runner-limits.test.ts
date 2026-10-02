import { describe, expect, it } from "vitest";
import { runnerSupportsSlug } from "@/features/submissions/limits";
import { SIGNATURES } from "@/features/submissions/signatures";

describe("shared runner limits", () => {
  it("treats only registered signature slugs as executable", () => {
    for (const slug of Object.keys(SIGNATURES)) expect(runnerSupportsSlug(slug)).toBe(true);
    expect(runnerSupportsSlug("some-custom-problem")).toBe(false);
    expect(runnerSupportsSlug("__proto__")).toBe(false);
  });
});
