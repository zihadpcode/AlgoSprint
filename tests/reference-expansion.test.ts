import { describe, expect, it } from "vitest";
import { EXPANSION, seededRng } from "../scripts/lib/reference-expansion";
import { libraryResult } from "../scripts/lib/reference-library";
import { SIGNATURES } from "@/features/submissions/signatures";

// Every expansion reference must agree with its independent brute-force baseline on seeded random inputs, and its
// input schema must accept exactly what the sampler produces.
describe("library expansion references", () => {
  for (const [slug, item] of Object.entries(EXPANSION)) {
    it(`${slug}: optimal reference matches the brute-force baseline`, () => {
      const signature = SIGNATURES[slug];
      expect(signature).toBeDefined();
      const rng = seededRng(slug.length * 7919 + 17);
      for (let trial = 0; trial < 400; trial++) {
        const input = item.input.parse(item.sample(rng)) as Record<string, unknown>;
        const args = signature.keys.map((key) => input[key]) as never[];
        expect(item.solve(...args), JSON.stringify(input)).toEqual(item.brute(...args));
        expect(libraryResult(slug, input)).toEqual(item.solve(...args));
      }
    });
  }
});
