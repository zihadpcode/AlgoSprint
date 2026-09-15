export const editorLanguages = {
  JAVASCRIPT: { label: "JavaScript", id: "javascript" },
  TYPESCRIPT: { label: "TypeScript", id: "typescript" },
  PYTHON: { label: "Python", id: "python" },
  JAVA: { label: "Java", id: "java" },
  CPP: { label: "C++", id: "cpp" },
  SQL: { label: "SQL", id: "sql" },
} as const;
export type EditorLanguage = keyof typeof editorLanguages;
export type EditorStarter = { language: EditorLanguage; entryPoint: string; code: string };
export type EditorDrafts = Partial<Record<EditorLanguage, string>>;

export function draftFor(starter: EditorStarter, drafts: EditorDrafts) {
  // Empty code is a deliberate draft, not a request to reload the starter.
  return drafts[starter.language] ?? starter.code;
}
