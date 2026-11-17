import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnostic, AREAS } from "@/lib/tri/diagnostic";
import { eap, type ItemParameters } from "@/lib/tri/engine";
import type { AreaPace, PeriodTally, WeekRow } from "./habits";
import { errorPattern, extremes, PROFILE_RULE, read, type DistractorCount, type Reading, type Tally } from "./rule";

interface RawTally {
  answers: number;
  correct: number;
  with_brazil: number;
  brazil_sum: number;
  correct_with_brazil: number;
}
const tally = (r: RawTally | undefined): Tally => ({
  answers: r?.answers ?? 0,
  correct: r?.correct ?? 0,
  withBrazil: r?.with_brazil ?? 0,
  brazilSum: Number(r?.brazil_sum ?? 0),
  correctWithBrazil: r?.correct_with_brazil ?? 0,
});

export interface ThemeRow {
  code: string;
  label: string;
  discipline: string | null;
  reading: Reading;
}
export interface AreaRow {
  code: string;
  label: string;
  reading: Reading;
  /** Nota estimada pela TRI (mesmo cálculo do Diagnóstico); null sem respostas suficientes. */
  score: { value: number; lower: number; upper: number } | null;
  themes: ThemeRow[];
}
export interface Profile {
  areas: AreaRow[];
  extremes: ReturnType<typeof extremes>;
  pattern: ReturnType<typeof errorPattern>;
  answers: number;
}

/** Perfil da conta do login; null sem sessão. */
export async function loadProfile(): Promise<Profile | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data, error }, diagnostic] = await Promise.all([supabase.rpc("learning_profile"), loadDiagnostic()]);
  if (error || !data) return null;
  const raw = data as {
    areas: (RawTally & { area: string })[];
    themes: (RawTally & { area: string; code: string; label: string; discipline: string | null })[];
    distractors: DistractorCount[];
    wrong_total: number;
  };
  const areas: AreaRow[] = AREAS.map((a) => {
    const d = diagnostic?.find((x) => x.code === a.code);
    let score: AreaRow["score"] = null;
    if (d && d.model && d.reason === null) {
      const e = eap(
        d.data.map((x) => ({ itemId: x.itemId, correct: x.correct })),
        new Map<string, ItemParameters>(d.data.map((x) => [x.itemId, { a: x.a, b: x.b, c: x.c }])),
        d.model.config,
      );
      score = { value: e.score, lower: e.lower, upper: e.upper };
    }
    return {
      code: a.code,
      label: a.label,
      reading: read(tally(raw.areas.find((x) => x.area === a.code)), PROFILE_RULE.minArea),
      score,
      themes: raw.themes
        .filter((t) => t.area === a.code)
        .map((t) => ({ code: t.code, label: t.label, discipline: t.discipline, reading: read(tally(t), PROFILE_RULE.minTheme) }))
        .sort((x, y) => (y.reading.diff ?? -9) - (x.reading.diff ?? -9) || x.code.localeCompare(y.code, "pt-BR", { numeric: true })),
    };
  });
  return {
    areas,
    extremes: extremes(areas),
    pattern: errorPattern(raw.distractors, raw.wrong_total),
    answers: raw.areas.reduce((n, a) => n + a.answers, 0),
  };
}

export interface Habits {
  areas: (AreaPace & { label: string })[];
  overallMedianMs: number | null;
  timed: number;
  periods: PeriodTally[];
  weeks: WeekRow[];
}

/** Tempo por questão, períodos do dia e últimas semanas da conta do login; null sem sessão. */
export async function loadHabits(): Promise<Habits | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [h, w] = await Promise.all([supabase.rpc("study_habits"), supabase.rpc("my_weeks", { p_weeks: 8 })]);
  if (h.error || !h.data) return null;
  const raw = h.data as {
    areas: { area: string; n: number; median_ms: number | null; n_correct: number; median_ms_correct: number | null; n_wrong: number; median_ms_wrong: number | null }[];
    overall_median_ms: number | null;
    timed: number;
    periods: PeriodTally[];
  };
  const weeks = ((w.data ?? []) as { week_start: string; minutes: number; answers: number; correct: number; days_active: number }[]).map((x) => ({
    weekStart: x.week_start,
    minutes: x.minutes,
    answers: x.answers,
    correct: x.correct,
    daysActive: x.days_active,
  }));
  return {
    areas: AREAS.flatMap((a) => {
      const x = raw.areas.find((r) => r.area === a.code);
      return x
        ? [{ area: a.code, label: a.label, n: x.n, medianMs: x.median_ms, nCorrect: x.n_correct, medianMsCorrect: x.median_ms_correct, nWrong: x.n_wrong, medianMsWrong: x.median_ms_wrong }]
        : [];
    }),
    overallMedianMs: raw.overall_median_ms,
    timed: raw.timed,
    periods: raw.periods,
    weeks,
  };
}
