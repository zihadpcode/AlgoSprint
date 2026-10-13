// Shared rules for the free-text title searches in the library, the saved lists and the admin index, so the three
// behave the same way.

// C0 control characters and DEL never belong in a title search. Newlines or NULs in a query string would otherwise
// reach the database comparison, and a NUL is rejected by PostgreSQL text parameters.
export function stripSearchControls(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "");
}

// Prisma's PostgreSQL `contains` filter is a LIKE pattern, so `%`, `_` and the escape character `\` would act as
// wildcards. Escape them so the learner's punctuation is searched literally.
export function literalSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
