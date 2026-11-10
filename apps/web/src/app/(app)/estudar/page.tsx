import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { StartRhythm } from "@/components/question/start-rhythm";
import { StartTraining } from "@/components/question/start-training";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { publishedByArea } from "@/lib/study/session";

export const metadata: Metadata = { title: "Estudar" };
export const dynamic = "force-dynamic";

const MODES = [
  { href: "/estudar/dia-d", title: "Dia D", body: "Simulado com caderno oficial, relógio do servidor e cartão-resposta." },
  { href: "/diagnostico", title: "Diagnóstico", body: "Até 20 questões por área e a estimativa por TRI quando houver parâmetros oficiais." },
];

export default async function EstudarPage() {
  const counts = await publishedByArea();
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <ScreenHeader title="Estudar" kicker="Treino livre" />
      <nav aria-label="Modos de estudo" className="mb-10">
        <ul className="flex flex-col border-t border-line-subtle">
          {MODES.map((m) => (
            <li key={m.href}>
              <Link
                href={m.href}
                className="group flex min-h-16 items-center justify-between gap-4 border-b border-line-subtle py-3 hover:bg-surface-subtle/60"
              >
                <span>
                  <span className="block t-ui text-ink">{m.title}</span>
                  <span className="block t-meta text-ink-2">{m.body}</span>
                </span>
                <span aria-hidden className="t-ui text-ink-2 transition-transform duration-[var(--rs-dur-state)] group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {total > 0 ? (
        <div className="flex flex-col gap-6">
          <StartTraining counts={counts!} />
          <section
            aria-labelledby="treinos-habilidade"
            className="flex max-w-xl flex-col gap-3"
          >
            <h2 id="treinos-habilidade" className="t-section">
              Triagem de 20 segundos
            </h2>
            <p className="t-meta text-ink-2">
              Para cada questão, decida em até 20 segundos: resolver agora,
              deixar para depois ou chutar. Depois você resolve todas e compara.
            </p>
            <StartTraining counts={counts!} mode="triagem" />
          </section>
          <section
            aria-labelledby="ritmo"
            className="flex max-w-xl flex-col gap-3"
          >
            <h2 id="ritmo" className="t-section">
              Blocos de ritmo
            </h2>
            <p className="t-meta text-ink-2">
              Resolva contra o relógio, com alvo por questão, marcação para
              revisar e gabarito só no fim.
            </p>
            <StartRhythm available={total} />
          </section>
          <p className="t-meta text-ink-2">
            Só questões reais do Enem, conferidas e publicadas.{" "}
            <Link href="/estudar/banco" className="underline">
              Escolher no banco, com filtros
            </Link>{" "}
            ·{" "}
            <Link href="/estudar/demonstracao" className="underline">
              Ver a questão demonstrativa
            </Link>
            .
          </p>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Ainda não há questões publicadas"
          body="O treino usa só questões reais do Enem conferidas uma a uma. Enquanto o primeiro lote é revisado, dá para conhecer a tela com uma questão demonstrativa."
          note="Nenhuma questão inventada entra no banco de estudo."
          action={{
            href: "/estudar/demonstracao",
            label: "Ver questão demonstrativa",
          }}
        />
      )}
    </>
  );
}
