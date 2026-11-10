"use client";

import { useState } from "react";
import type { StudyQuestion } from "@/lib/study/question-types";
import { QuestionView } from "./question-view";

/** Prévia: o editor pode marcar e eliminar alternativas, mas não confirma nem vê gabarito. */
export function QuestionPreview({ question }: { question: StudyQuestion }) {
  const [value, setValue] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<Set<string>>(new Set());
  return (
    <QuestionView
      question={question}
      answer={{
        value,
        onValueChange: setValue,
        eliminated,
        onToggleEliminate: (k) =>
          setEliminated((s) => {
            const n = new Set(s);
            if (n.has(k)) n.delete(k);
            else n.add(k);
            return n;
          }),
        confirmed: false,
        reveal: null,
      }}
    />
  );
}
