import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadSession } from "@/lib/study/session";
import {
  reviewTriage,
  TARGET_MS,
  type ReviewInput,
} from "@/lib/study/triage-review";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conferência da triagem" };
export const dynamic = "force-dynamic";

const LABEL = { agora: "Agora", depois: "Depois", chuto: "Chute" } as const;
const OUTCOME = {
  acertou: "Acertou",
  errou: "Errou",
  anulada: "Anulada",
  nao_observado: "Não observado",
} as const;
const sec = (ms: number | null) =>
  ms == null ? "—" : `${Math.round(ms / 1000)} s`;

/**
 * Conferência da triagem (F4-T05): decisão × resolução posterior, com tempo e acerto observados.
 * Sem resolução, "não observado"; dificuldade aparece indisponível enquanto não há parâmetros reais.
 */
export default async function TriageReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadSession(id);
  const supabase = await createClient();
  const { data: atts } = await supabase
    .from("attempts")
    .select("session_item_id, active_ms")
    .in(
      "session_item_id",
      session.entries.map((e) => e.sessionItemId),
    );
  const msBy = new Map(
    (atts ?? []).map((a) => [a.session_item_id, a.active_ms as number | null]),
  );
  const input: ReviewInput[] = session.entries.map((e, i) => ({
    position: i + 1,
    decision: e.triage?.decision ?? null,
    triageMs: e.triage?.visible_ms ?? null,
    windowClosed: e.triage?.window_closed ?? null,
    resolved: e.feedback
      ? {
          correct: e.feedback.isCorrect,
          activeMs: msBy.get(e.sessionItemId) ?? null,
        }
      : null,
  }));
  const r = reviewTriage(input);
  return (
    <>
      <Link
        href={`/estudar/triagem/${id}`}
        className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" /> Triagem
      </Link>
      <ScreenHeader
        title="Conferência da triagem"
        kicker="Treino de habilidade"
      />
      <div className="flex max-w-3xl flex-col gap-5">
        <ul className="flex flex-col gap-1 t-reading">
          <li>
            “Agora” resolvidas certo em até {TARGET_MS / 60000} min:{" "}
            {r.agora.correctWithinTarget} de {r.agora.observed} resolvidas
            {r.agora.notObserved > 0
              ? ` (${r.agora.notObserved} ainda não resolvidas, fora da conta)`
              : ""}
            .
          </li>
          <li>
            “Depois”: {r.depois.correct} de {r.depois.observed} resolvidas
            certo.
          </li>
          <li>
            Chutes: {r.chuto.correct} de {r.chuto.observed} resolvidos certo.
          </li>
        </ul>
        <p className="t-meta text-ink-2">
          Só entra na conta o que você resolveu depois. Isto descreve o que
          aconteceu nesta sessão; não prova qual estratégia é a melhor. O
          tempo-alvo de {TARGET_MS / 60000} min é a configuração inicial do
          treino.
        </p>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Decisões por questão"
          tabIndex={0}
        >
          <table className="w-full min-w-[560px] border-collapse t-ui">
            <thead>
              <tr className="border-b border-line text-left t-meta text-ink-2">
                <th scope="col" className="py-2 pr-3">
                  Questão
                </th>
                <th scope="col" className="py-2 pr-3">
                  Decisão
                </th>
                <th scope="col" className="py-2 pr-3">
                  Tempo na triagem
                </th>
                <th scope="col" className="py-2 pr-3">
                  Depois
                </th>
                <th scope="col" className="py-2 pr-3">
                  Tempo para resolver
                </th>
                <th scope="col" className="py-2">
                  Dificuldade
                </th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.position} className="border-b border-line-subtle">
                  <td className="py-2 pr-3 tabular-nums">{row.position}</td>
                  <td className="py-2 pr-3">
                    {row.decision ? LABEL[row.decision] : "Sem decisão"}
                    {row.windowClosed ? (
                      <span className="t-meta text-ink-2"> (após 20 s)</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {sec(row.triageMs)}
                  </td>
                  <td className="py-2 pr-3">{OUTCOME[row.outcome]}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {sec(row.resolved?.activeMs ?? null)}
                  </td>
                  <td className="py-2 text-ink-2">Indisponível</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="t-meta text-ink-2">
          Dificuldade indisponível: ainda não há parâmetros reais das questões
          (a calibração depende dos microdados).
        </p>
      </div>
    </>
  );
}
