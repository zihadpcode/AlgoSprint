import { expect, it } from "vitest";
import { isPythonIdentifier, pythonEntryPoint, toSnakeCase } from "@/features/submissions/python-names";
import { SIGNATURES } from "@/features/submissions/signatures";

it("converts camelCase names to snake_case", () => {
  expect(toSnakeCase("relayWindow")).toBe("relay_window");
  expect(toSnakeCase("k")).toBe("k");
  expect(toSnakeCase("newSlot")).toBe("new_slot");
  expect(toSnakeCase("parseHTTPRequest")).toBe("parse_http_request");
  expect(toSnakeCase("twinXor")).toBe("twin_xor");
});
it("rejects keywords and non-identifiers", () => {
  for (const name of ["def", "None", "class", "1abc", "a-b", "", "naïve", "a b"]) expect(isPythonIdentifier(name), name).toBe(false);
  for (const name of ["relay_window", "_x", "a1"]) expect(isPythonIdentifier(name), name).toBe(true);
});
it("derives a valid, unique Python name and parameters for every reviewed signature", () => {
  for (const [slug, { entryPoint, keys }] of Object.entries(SIGNATURES)) {
    expect(isPythonIdentifier(pythonEntryPoint(entryPoint)), slug).toBe(true);
    const parameters = keys.map(toSnakeCase);
    expect(parameters.every(isPythonIdentifier), slug).toBe(true);
    expect(new Set(parameters).size, slug).toBe(parameters.length);
  }
});
