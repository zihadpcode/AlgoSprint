"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type StudyLanguage = {
  language: string | undefined;
  selection: number;
  languages: readonly string[];
  selectLanguage: (language: string) => void;
};
const StudyLanguageContext = createContext<StudyLanguage | null>(null);
export function useStudyLanguage() { return useContext(StudyLanguageContext); }

// A problem-scoped preference only. Code drafts stay in the editor's separate language-keyed state.
export function StudyLanguageProvider({ languages, children }: { languages: readonly string[]; children: ReactNode }) {
  const [choice, setChoice] = useState({ language: languages[0], selection: 0 });
  const value = useMemo(() => ({ ...choice, languages,
    selectLanguage: (language: string) => {
      if (languages.includes(language)) setChoice((current) => current.language === language ? current
        : { language, selection: current.selection + 1 });
    },
  }), [choice, languages]);
  return <StudyLanguageContext.Provider value={value}>{children}</StudyLanguageContext.Provider>;
}

const languageLabels: Record<string, string> = { JAVASCRIPT: "JavaScript", PYTHON: "Python", TYPESCRIPT: "TypeScript", JAVA: "Java", CPP: "C++", SQL: "SQL" };
export const studyLanguageLabel = (language: string) => languageLabels[language] ?? language;
