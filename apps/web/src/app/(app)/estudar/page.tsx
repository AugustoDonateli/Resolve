import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { FirstTimeTip } from "@/components/guide/first-time-tip";
import { StartFitted } from "@/components/question/start-fitted";
import { StartRhythm } from "@/components/question/start-rhythm";
import { StartTraining } from "@/components/question/start-training";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Sumario } from "@/components/ui/sumario";
import { loadGuide } from "@/lib/guide/data";
import { loadSuggestion } from "@/lib/study/suggestion";
import { publishedByArea } from "@/lib/study/session";

export const metadata: Metadata = { title: "Estudar" };
export const dynamic = "force-dynamic";

/** As três portas do caderno, na ordem em que costumam ser usadas. Cada uma diz quando serve. */
const DOORS = [
  { href: "/estudar/licoes", n: "1", title: "Aprender", when: "Quando o assunto é novo ou esqueceu: lição curta, com exemplo e questões reais." },
  { href: "#praticar", n: "2", title: "Praticar", when: "No dia a dia: resolver questões e ver a correção de cada uma." },
  { href: "#treinar-a-prova", n: "3", title: "Treinar a prova", when: "Quando o problema não é o conteúdo: leitura do comando, pegadinha, tempo." },
  { href: "#provar", n: "4", title: "Provar", when: "De tempos em tempos: a prova inteira, no relógio, e uma medida da sua nota." },
];

const PRATICAR = [
  { href: "/estudar/banco", title: "Banco de questões", tag: "com filtros", body: "Quando você já sabe o que quer: escolha por área, edição, dia de prova, habilidade ou assunto." },
];
const TECNICAS = [
  { href: "/estudar/comando", title: "Comando primeiro", tag: "leitura", body: "Quando você erra por ler errado: leia o comando antes do texto, marque a evidência e só então responda." },
  { href: "/estudar/distrator", title: "Caça ao distrator", tag: "pegadinha", body: "Quando você fica entre duas: depois de responder, diga por que cada alternativa errada atrai." },
];
const PROVAR = [
  { href: "/estudar/dia-d", title: "Dia D", tag: "simulado", body: "Um caderno oficial inteiro, com o relógio do servidor e o cartão-resposta. Reserve o tempo da prova." },
  { href: "/diagnostico", title: "Diagnóstico", tag: "medida", body: "Até 20 questões por área e uma estimativa da nota pelo cálculo do Enem, com a faixa de erro." },
];

export default async function EstudarPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  const initialArea = area && ["LC", "CH", "CN", "MT"].includes(area) ? area : "todas";
  const [counts, guide, suggestion] = await Promise.all([publishedByArea(), loadGuide(), loadSuggestion()]);
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <ScreenHeader title="Estudar" kicker={total > 0 ? `Caderno de questões · ${total} questões oficiais` : "Caderno de questões"} />
      {total > 0 ? (
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-6">
            <p className="max-w-[62ch] t-reading text-ink-2">O caderno tem quatro portas. Escolha pela sua necessidade de hoje.</p>
            <nav aria-label="As quatro portas do caderno">
              <ol className="grid gap-x-8 border-t-[1.5px] border-ink sm:grid-cols-2 lg:grid-cols-4">
                {DOORS.map((d) => (
                  <li key={d.href} className="border-b border-line-subtle md:border-b-0">
                    <Link href={d.href} className="group flex h-full gap-3 py-4">
                      <span aria-hidden="true" className="font-display text-[40px] leading-[0.9] text-ink-2">
                        {d.n}
                      </span>
                      <span>
                        <span className="block t-section text-ink [background:linear-gradient(currentColor,currentColor)_no-repeat_left_100%/0%_1.5px] transition-[background-size] duration-[var(--rs-dur-layout)] ease-layout group-hover:[background-size:100%_1.5px] group-focus-visible:[background-size:100%_1.5px]">
                          {d.title}
                        </span>
                        <span className="mt-1 block t-meta text-ink-2">{d.when}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
            {suggestion && (
              <section aria-labelledby="sugestao" className="relative rounded-card border border-line-subtle bg-surface px-5 pb-5 pt-6 shadow-paper sm:px-6">
                <span aria-hidden="true" className="absolute -top-2.5 left-5 rounded-sm bg-mark-yellow px-2 py-0.5 t-meta font-medium text-on-mark">
                  agora
                </span>
                <h2 id="sugestao" className="t-kicker">
                  Sugestão para agora
                </h2>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                  <div className="min-w-0 max-w-[62ch]">
                    <p className="t-section text-ink">{suggestion.title}</p>
                    <p className="mt-1 t-meta text-ink-2">
                      <span className="font-medium text-ink">Por quê: </span>
                      {suggestion.reason}
                    </p>
                  </div>
                  <Link
                    href={suggestion.href}
                    className="inline-flex min-h-11 items-center rounded-control border-[1.5px] border-ink px-4 t-ui text-ink hover:bg-ink hover:text-background"
                  >
                    {suggestion.action}
                  </Link>
                </div>
              </section>
            )}
          </div>

          <section id="praticar" aria-labelledby="praticar-t" className="scroll-mt-20 border-t-[1.5px] border-ink pt-8">
            <p className="t-kicker">Porta 2</p>
            <h2 id="praticar-t" className="t-screen text-ink">
              Praticar
            </h2>
            <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <div id="treino" className="flex scroll-mt-20 flex-col gap-3">
                <h3 className="t-section">Treino livre</h3>
                <p className="max-w-[46ch] t-meta text-ink-2">
                  Quando usar: todo dia. Questões sorteadas, primeiro as que você ainda não respondeu; cada resposta é corrigida na hora, com o Raio-X.
                </p>
                <StartTraining counts={counts!} initialArea={initialArea} />
              </div>
              <div className="flex flex-col gap-8">
                <div id="medida" className="flex scroll-mt-20 flex-col gap-3">
                  <h3 className="t-section">Na sua medida</h3>
                  <p className="max-w-[52ch] t-meta text-ink-2">
                    Quando usar: depois de umas 10 respostas na área. Dez questões novas com dificuldade logo acima do seu nível estimado: nem fáceis demais,
                    nem fora de alcance.
                  </p>
                  <StartFitted initialArea={initialArea} />
                </div>
                <Sumario id="praticar-mais" label="Também em Praticar" items={PRATICAR} />
              </div>
            </div>
          </section>

          <section id="treinar-a-prova" aria-labelledby="tecnica-t" className="scroll-mt-20 border-t-[1.5px] border-ink pt-8">
            <p className="t-kicker">Porta 3</p>
            <h2 id="tecnica-t" className="t-screen text-ink">
              Treinar a prova
            </h2>
            <p className="mt-2 max-w-[62ch] t-meta text-ink-2">Quatro treinos do jeito de fazer a prova. Cada um ataca um problema diferente.</p>
            <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-2">
              <div id="triagem" className="flex scroll-mt-20 flex-col gap-3">
                <h3 className="t-section">Triagem de 20 segundos</h3>
                <p className="t-meta text-ink-2">
                  Quando usar: se você trava em questão difícil e falta tempo no fim. Decida em até 20 segundos: resolver agora, deixar para depois ou
                  chutar. Depois você resolve todas e compara.
                </p>
                {guide && <FirstTimeTip tip="dica_triagem" seen={guide.guide.dica_triagem} />}
                <StartTraining counts={counts!} mode="triagem" />
              </div>
              <div id="ritmo" className="flex scroll-mt-24 flex-col gap-3">
                <h3 className="t-section">Blocos de ritmo</h3>
                <p className="t-meta text-ink-2">
                  Quando usar: se você acerta com calma, mas não sabe se o tempo dá. Contra o relógio, com alvo por questão e gabarito só no fim.
                </p>
                {guide && <FirstTimeTip tip="dica_ritmo" seen={guide.guide.dica_ritmo} />}
                <StartRhythm available={total} />
              </div>
            </div>
            <div className="mt-10">
              <Sumario id="tecnica-mais" label="Também em Treinar a prova" items={TECNICAS} />
            </div>
          </section>

          <section id="provar" aria-labelledby="provar-t" className="scroll-mt-20 border-t-[1.5px] border-ink pt-8">
            <p className="t-kicker">Porta 4</p>
            <h2 id="provar-t" className="t-screen text-ink">
              Provar
            </h2>
            <div className="mt-6 max-w-[46rem]">
              <Sumario id="provar-mais" label="Prova inteira e medida" items={PROVAR} />
            </div>
          </section>

          <p className="t-meta text-ink-2">
            Só questões reais do Enem, conferidas e publicadas.{" "}
            <Link href="/estudar/demonstracao" className="underline">
              Ver a questão demonstrativa
            </Link>
            . A matriz de habilidades fica em{" "}
            <Link href="/progresso#habilidades" className="underline">
              Progresso
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
