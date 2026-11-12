import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { StartRhythm } from "@/components/question/start-rhythm";
import { StartTraining } from "@/components/question/start-training";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Sumario } from "@/components/ui/sumario";
import { publishedByArea } from "@/lib/study/session";

export const metadata: Metadata = { title: "Estudar" };
export const dynamic = "force-dynamic";

/** Sumário do caderno: todos os modos de estudo, na ordem em que costumam ser usados. */
const SUMARIO = [
  { href: "#treino", title: "Treino livre", tag: "nesta página", body: "Questões sorteadas, primeiro as que você ainda não respondeu." },
  { href: "/estudar/banco", title: "Banco de questões", tag: "filtros", body: "Escolha por área, edição, dia de prova, habilidade ou assunto." },
  { href: "/estudar/dia-d", title: "Dia D", tag: "simulado", body: "Caderno oficial inteiro, relógio do servidor e cartão-resposta." },
  { href: "/estudar/comando", title: "Comando primeiro", tag: "leitura", body: "Leia o comando antes do texto, marque a evidência e só então responda." },
  { href: "/estudar/distrator", title: "Caça ao distrator", tag: "eliminação", body: "Depois de responder, classifique por que cada alternativa errada atrai." },
  { href: "#triagem", title: "Triagem de 20 segundos", tag: "nesta página", body: "Decida rápido: resolver agora, deixar para depois ou chutar." },
  { href: "#ritmo", title: "Blocos de ritmo", tag: "nesta página", body: "Contra o relógio, com alvo por questão e gabarito só no fim." },
  { href: "/estudar/matriz", title: "Matriz e incidência", tag: "mapa", body: "As 120 habilidades oficiais e a ficha de cada uma." },
  { href: "/diagnostico", title: "Diagnóstico", tag: "medida", body: "Até 20 questões por área; estimativa por TRI quando houver parâmetros oficiais." },
];

export default async function EstudarPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  const initialArea = area && ["LC", "CH", "CN", "MT"].includes(area) ? area : "todas";
  const counts = await publishedByArea();
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <ScreenHeader title="Estudar" kicker={total > 0 ? `Caderno de questões · ${total} questões oficiais` : "Caderno de questões"} />
      {total > 0 ? (
        <div className="flex flex-col gap-12">
          {/* Página dupla de abertura: o treino à esquerda, o sumário à direita */}
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <section id="treino" aria-labelledby="treino-t" className="flex scroll-mt-20 flex-col gap-4">
              <h2 id="treino-t" className="t-section">
                Treino livre
              </h2>
              <p className="max-w-[46ch] t-reading text-ink-2">Abra o caderno numa área e resolva. Cada resposta é corrigida na hora, à caneta.</p>
              <StartTraining counts={counts!} initialArea={initialArea} />
            </section>
            <Sumario id="sumario-t" items={SUMARIO} />
          </div>

          <div className="grid gap-x-12 gap-y-10 border-t-[1.5px] border-ink pt-8 lg:grid-cols-2">
            <section id="triagem" aria-labelledby="triagem-t" className="flex scroll-mt-20 flex-col gap-3">
              <h2 id="triagem-t" className="t-section">
                Triagem de 20 segundos
              </h2>
              <p className="t-meta text-ink-2">
                Para cada questão, decida em até 20 segundos: resolver agora, deixar para depois ou chutar. Depois você resolve todas e compara.
              </p>
              <StartTraining counts={counts!} mode="triagem" />
            </section>
            <section aria-labelledby="ritmo" className="flex flex-col gap-3">
              <h2 id="ritmo" className="scroll-mt-24 t-section">
                Blocos de ritmo
              </h2>
              <p className="t-meta text-ink-2">Resolva contra o relógio, com alvo por questão, marcação para revisar e gabarito só no fim.</p>
              <StartRhythm available={total} />
            </section>
          </div>
          <p className="t-meta text-ink-2">
            Só questões reais do Enem, conferidas e publicadas.{" "}
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
