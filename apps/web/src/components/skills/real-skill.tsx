"use client";

import { useMemo } from "react";
import { getSkillFeedback, recordDistractorChoices, recordEvidence, submitAttempt } from "@/lib/study/actions";
import type { SessionView } from "@/lib/study/session";
import { SkillRunner, type SkillBackend, type SkillEntry, type Taxon } from "./skill-runner";

const MSG: Record<string, string> = {
  resolve_already_answered: "Esta questão já foi respondida.",
  resolve_session_closed: "Esta sessão foi encerrada.",
  resolve_evidence_invalid: "O trecho marcado não confere com o texto. Marque de novo.",
};

/** Treino sobre uma sessão real: grava evidência, resposta e classificação; o retorno vem do banco. */
export function RealSkill({ skill, session, taxonomy }: { skill: "comando" | "distrator"; session: SessionView; taxonomy: Taxon[] }) {
  const pending = session.entries.filter((e) => !e.feedback);
  const entries: SkillEntry[] = pending.map((e) => ({ id: e.sessionItemId, question: e.question }));
  const altIds = useMemo(() => new Map(session.entries.map((e) => [e.sessionItemId, e.alternativeIds])), [session.entries]);
  const backend: SkillBackend = {
    async recordEvidence(entry, ranges, none) {
      const r = await recordEvidence({ sessionItemId: entry.id, ranges, noneReason: none }).catch(() => null);
      return r?.ok ? null : (MSG[r && !r.ok ? r.error : ""] ?? "Não foi possível guardar o trecho. Tente de novo.");
    },
    async submit(entry, key) {
      const actionId = crypto.randomUUID();
      const r = await submitAttempt({ actionId, sessionItemId: entry.id, alternativeId: altIds.get(entry.id)![key], activeMs: 0, elapsedMs: 0 }).catch(() => null);
      if (!r?.ok) return { ok: false, message: MSG[r && !r.ok ? r.error : ""] ?? "Não foi possível confirmar. Tente de novo." };
      const f = await getSkillFeedback({ sessionItemId: entry.id });
      return f.ok && f.value.correct_key ? { ok: true, correctKey: f.value.correct_key } : { ok: false, message: "Resposta gravada, mas o retorno não chegou. Recarregue." };
    },
    async recordChoices(entry, choices) {
      const r = await recordDistractorChoices({ sessionItemId: entry.id, choices }).catch(() => null);
      return r?.ok ? null : "Não foi possível guardar a classificação. Tente de novo.";
    },
    async result(entry) {
      const f = await getSkillFeedback({ sessionItemId: entry.id }).catch(() => null);
      if (!f?.ok || !f.value.released) return null;
      return {
        correctKey: f.value.correct_key!,
        annotationStatus: f.value.annotation_status ?? "pendentes",
        evidence: f.value.evidence ?? null,
        distractors: f.value.distractors ?? null,
      };
    },
  };
  if (!entries.length) return <p className="t-reading text-ink-2">Todas as questões desta sessão já foram respondidas.</p>;
  return <SkillRunner skill={skill} entries={entries} backend={backend} taxonomy={taxonomy} />;
}
