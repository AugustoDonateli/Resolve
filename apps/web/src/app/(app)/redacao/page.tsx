import type { Metadata } from "next";
import Link from "next/link";
import { NewEssayButton } from "@/components/essay/new-essay-button";
import { ScreenHeader } from "@/components/shell/app-shell";
import { Sumario } from "@/components/ui/sumario";
import { listMyEssays } from "@/lib/essay/drafts";
import { loadTrack } from "@/lib/essay/track-data";
import { TRACK } from "@/lib/essay/track";

export const metadata: Metadata = { title: "Redação" };
export const dynamic = "force-dynamic";

export default async function RedacaoPage() {
  const [essays, track] = await Promise.all([listMyEssays(), loadTrack()]);
  const recent = (essays ?? []).filter((e) => !e.trainingPiece).slice(0, 3);
  const doneSteps = track?.done.length ?? 0;
  const draft = (essays ?? []).find((e) => !e.trainingPiece && e.status !== "submetida");
  const paths = [
    { href: "/redacao/trilha", title: "Redação do zero", tag: `${doneSteps} de ${TRACK.length}`, body: "Trilha em oito etapas, da leitura da proposta à reescrita." },
    { href: "/redacao/pecas", title: "Treino por peças", tag: "partes", body: "Introdução, desenvolvimento, conclusão e intervenção, uma de cada vez." },
    { href: "/redacao/temas", title: "Temas", tag: "propostas", body: "Propostas com textos motivadores e fonte." },
    { href: "/redacao/repertorio", title: "Repertório", tag: "seu banco", body: "Dados, leis, obras e citações, com fonte." },
    { href: "/redacao/minhas", title: "Minhas redações", tag: "arquivo", body: "Rascunhos, enviadas, correções e reescritas." },
    { href: "/redacao/demonstracao", title: "Correção demonstrativa", tag: "exemplo", body: "Como a correção por competência aparece, com uma redação de exemplo." },
  ];
  return (
    <>
      <ScreenHeader title="Redação" kicker="Escrever, corrigir, reescrever" />
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-8">
          {/* A folha de redação: 30 linhas à espera. A ação principal está escrita nela. */}
          <section aria-labelledby="folha-t" className="folha-redacao">
            <div className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-ink pb-2">
              <h2 id="folha-t" className="t-kicker !text-ink">
                Folha de redação
              </h2>
              <span className="t-kicker">30 linhas</span>
            </div>
            <ol aria-hidden="true" className="folha-linhas">
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i}>{String(i + 1).padStart(2, "0")}</li>
              ))}
            </ol>
            <div className="folha-acao">
              <p className="t-section">{draft ? "Você tem um rascunho aberto" : "Comece pela folha em branco"}</p>
              {draft && (
                <Link href={`/redacao/escrever/${draft.id}`} className="t-reading text-link underline underline-offset-4">
                  Continuar: {draft.promptTitle ?? "tema livre"}
                </Link>
              )}
              <NewEssayButton label={draft ? "Escrever outra redação" : "Escrever uma redação"} />
            </div>
          </section>
          <section aria-labelledby="recentes" className="flex flex-col gap-2">
            <h2 id="recentes" className="t-kicker">
              Recentes
            </h2>
            {recent.length ? (
              <ul className="flex flex-col border-t border-line-subtle">
                {recent.map((e) => (
                  <li key={e.id} className="border-b border-line-subtle py-3">
                    <Link href={e.status === "submetida" ? `/redacao/correcao/${e.id}` : `/redacao/escrever/${e.id}`} className="group flex flex-col">
                      <span className="t-ui text-ink group-hover:underline">{e.promptTitle ?? "Tema livre"}</span>
                      <span className="t-meta text-ink-2">
                        {e.status === "submetida" ? "Enviada · ver correção" : "Rascunho"} · {new Date(e.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-meta text-ink-2">Nenhuma redação ainda.</p>
            )}
          </section>
        </div>
        <div className="flex flex-col gap-6">
          <Sumario id="redacao-sumario" items={paths} />
          <p className="max-w-xl border-l-2 border-line pl-4 t-meta text-ink-2">
            Biblioteca nota 1000: aguardando as redações de referência com uso permitido. A leitura com anotações antes dos comentários, as
            camadas e a comparação do mesmo tema entram quando elas chegarem.
          </p>
        </div>
      </div>
    </>
  );
}
