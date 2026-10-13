// Browser-safe helpers shared by the Python harness, the starter generator and seed validation.
// Keep this module free of "server-only" imports.

export const PYTHON_KEYWORDS: ReadonlySet<string> = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif",
  "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or",
  "pass", "raise", "return", "try", "while", "with", "yield",
]);

// camelCase (as used by the reviewed JavaScript signatures) to snake_case.
export function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();
}

// ASCII-only on purpose: the harness embeds the entry point name in generated source.
export function isPythonIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PYTHON_KEYWORDS.has(name);
}

export function pythonEntryPoint(javascriptEntryPoint: string): string {
  return toSnakeCase(javascriptEntryPoint);
}
