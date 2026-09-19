import type { z } from "zod";
import type { ProblemSeed } from "../../src/lib/validators/problem";
import type { Random } from "./random";

export type Template<I> = {
  id: string;
  title: string;
  pattern: ProblemSeed["pattern"];
  categories: string[];
  tags: string[];
  statement: string;
  constraints: string[];
  input: z.ZodType<I>;
  edges: I[];
  random: (random: Random) => I;
  brute: (input: I) => number | number[];
  optimal: (input: I) => number | number[];
  bruteCode: string;
  optimalCode: string;
  hints: [string, string, string, string, string];
  bruteApproach: string;
  optimalApproach: string;
  invariant: string;
  bruteTime: string;
  optimalTime: string;
  optimalSpace: string;
  mistakes: string[];
};

// Erase heterogeneous input types only after binding their Zod parser.
export function defineTemplate<I>(template: Template<I>) {
  return {
    ...template,
    evaluate(input: unknown, strategy: "brute" | "optimal") {
      return template[strategy](template.input.parse(input));
    },
  };
}
