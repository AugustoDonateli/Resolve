import type { PromptDetail } from "@/lib/essay/prompt-types";
import type { StudyQuestion } from "@/lib/study/question-types";

export const LETTERS = ["A", "B", "C", "D", "E"] as const;
export type Letter = (typeof LETTERS)[number];
export type Language = "ingles" | "espanhol";
export const LANGUAGE_LABEL = { ingles: "Inglês", espanhol: "Espanhol" };

export interface Booklet {
  booklet_id: string;
  year: number;
  day: number;
  booklet_number: number;
  color: string;
  language: Language | null;
  minutes: number;
  essay: boolean;
  prompt_id: string | null;
  expected: number;
  available: number;
  annulled: number;
  local_start: string | null;
  schedule_source: string | null;
}

export interface RunSummary {
  id: string;
  year: number;
  day: number;
  color: string;
  started_at: string;
  deadline_at: string;
  ended_at: string | null;
}

export interface Catalog {
  server_time: string;
  booklets: Booklet[];
  runs: RunSummary[];
}

export interface ExamItem {
  position: number;
  version: string | null;
  letters: Record<Letter, Letter> | null;
  annulled: boolean;
  work: Letter | null;
  card: Letter | null;
  correct?: Letter | null;
  question?: StudyQuestion;
}

export type ExamAction =
  | { kind: "abriu"; position: number }
  | { kind: "marcou" | "transcreveu"; position: number; letter: Letter | null }
  | { kind: "redacao"; essay: string }
  | { kind: "entregou" };

export interface ExamEvent {
  sequence: number;
  kind: ExamAction["kind"];
  position: number | null;
  letter: Letter | null;
  recorded_at: string;
}

export interface ExamRun {
  id: string;
  position: number;
  revision: number;
  server_time: string;
  started_at: string;
  deadline_at: string;
  ended_at: string | null;
  essay: string;
  prompt_id: string | null;
  reference_time: boolean;
  booklet: { day: number; number: number; color: string; profile: string; source: string };
  items: ExamItem[];
  events: ExamEvent[];
  prompt?: PromptDetail | null;
}

export function bookletLabel(book: Booklet) {
  return `${book.year} · Dia ${book.day} · ${book.color}${book.language ? ` · ${LANGUAGE_LABEL[book.language]}` : ""}`;
}

export function canStart(book: Booklet) {
  return book.expected === 90 && book.available + book.annulled === book.expected && (!book.essay || !!book.prompt_id);
}

export function clockLabel(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
}
