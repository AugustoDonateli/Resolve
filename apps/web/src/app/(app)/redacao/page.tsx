import type { Metadata } from "next";
import Link from "next/link";
import { NewEssayButton } from "@/components/essay/new-essay-button";
import { ScreenHeader } from "@/components/shell/app-shell";
import { Sumario } from "@/components/ui/sumario";
import { clsx } from "clsx";
import { listMyEssays } from "@/lib/essay/drafts";
import { currentEssayStep, essayName, ESSAY_STEPS } from "@/lib/essay/path";
import { loadTrack } from "@/lib/essay/track-data";
import { TRACK } from "@/lib/essay/track";

export const metadata: Metadata = { title: "Redação" };
export const dynamic = "force-dynamic";

export default async function RedacaoPage() {
  const [essays, track] = await Promise.all([listMyEssays(), loadTrack()]);
  const recent = (essays ?? []).filter((e) => !e.trainingPiece).slice(0, 3);
  const doneSteps = track?.done.length ?? 0;
  const own = (essays ?? []).filter((e) => !e.trainingPiece);
  const draft = own.find((e) => e.status !== "submetida");
  const now = currentEssayStep(own[0]);
  const at = ESSAY_STEPS.findIndex((x) => x.key === now.step);
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
      {/* O caminho de uma redação, com o passo em que a pessoa está. */}
      <section aria-labelledby="caminho" className="mb-10">
        <h2 id="caminho" className="mb-2 t-kicker">
          O caminho de uma redação
        </h2>
        <ol className="grid border-t-[1.5px] border-ink sm:grid-cols-5">
          {ESSAY_STEPS.map((x, i) => {
            const here = i === at;
            return (
              <li key={x.key} aria-current={here ? "step" : undefined} className={clsx("flex gap-3 border-b border-line-subtle py-3 sm:flex-col sm:gap-1 sm:border-b-0 sm:pr-4", here && "sm:border-t-[3px] sm:border-primary sm:-mt-[1.5px]")}>
                <span
                  aria-hidden="true"
                  className={clsx(
                    "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[12px]",
                    here ? "border-ink bg-ink text-background" : "border-line text-ink-2",
                  )}
                >
                  {i + 1}
                </span>
                <span>
                  <span className={clsx("block t-ui", here ? "text-ink" : "text-ink-2")}>
                    {x.label}
                    {here && <span className="sr-only"> (você está aqui)</span>}
                  </span>
                  <span className="block t-meta text-ink-2">{x.hint}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 t-ui text-ink">
          Você está em “{ESSAY_STEPS[at]!.label}”.{" "}
          <Link href={now.href} className="text-link underline underline-offset-4">
            {now.action}
          </Link>
        </p>
      </section>
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
                  Continuar: {essayName(draft)}
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
                      <span className="t-ui text-ink group-hover:underline">{essayName(e)}</span>
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
