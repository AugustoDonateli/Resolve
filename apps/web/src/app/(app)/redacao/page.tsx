import type { Metadata } from "next";
import Link from "next/link";
import { NewEssayButton } from "@/components/essay/new-essay-button";
import { ScreenHeader } from "@/components/shell/app-shell";
import { listMyEssays } from "@/lib/essay/drafts";
import { loadTrack } from "@/lib/essay/track-data";
import { TRACK } from "@/lib/essay/track";

export const metadata: Metadata = { title: "Redação" };
export const dynamic = "force-dynamic";

export default async function RedacaoPage() {
  const [essays, track] = await Promise.all([listMyEssays(), loadTrack()]);
  const recent = (essays ?? []).filter((e) => !e.trainingPiece).slice(0, 3);
  const doneSteps = track?.done.length ?? 0;
  const paths = [
    { href: "/redacao/trilha", title: "Redação do zero", body: `Trilha em oito etapas · ${doneSteps} de ${TRACK.length} feitas` },
    { href: "/redacao/pecas", title: "Treino por peças", body: "Introdução, desenvolvimento, conclusão e intervenção, uma de cada vez." },
    { href: "/redacao/temas", title: "Temas", body: "Propostas com textos motivadores e fonte." },
    { href: "/redacao/repertorio", title: "Repertório", body: "Seu banco de dados, leis, obras e citações, com fonte." },
    { href: "/redacao/minhas", title: "Minhas redações", body: "Rascunhos, enviadas, correções e reescritas." },
    { href: "/redacao/demonstracao", title: "Correção demonstrativa", body: "Como a correção por competência aparece, com uma redação de exemplo." },
  ];
  return (
    <>
      <ScreenHeader title="Redação" kicker="Escrever, corrigir, reescrever">
        <NewEssayButton label="Escrever uma redação" />
      </ScreenHeader>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-14">
        <nav aria-label="Redação">
          <ul className="flex flex-col border-t border-line-subtle">
            {paths.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="group flex min-h-16 items-center justify-between gap-4 border-b border-line-subtle py-3 hover:bg-surface-subtle/60">
                  <span>
                    <span className="block t-ui text-ink">{p.title}</span>
                    <span className="block t-meta text-ink-2">{p.body}</span>
                  </span>
                  <span aria-hidden className="t-ui text-ink-2 transition-transform duration-[var(--rs-dur-state)] group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-xl border-l-2 border-line pl-4 t-meta text-ink-2">
            Biblioteca nota 1000: aguardando as redações de referência com uso permitido. A leitura com anotações antes dos comentários, as
            camadas e a comparação do mesmo tema entram quando elas chegarem.
          </p>
        </nav>
        <aside aria-labelledby="recentes" className="flex flex-col gap-3">
          <h2 id="recentes" className="t-kicker">
            Recentes
          </h2>
          {recent.length ? (
            <ul className="flex flex-col">
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
        </aside>
      </div>
    </>
  );
}
