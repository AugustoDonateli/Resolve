import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { AreaEstimate } from "@/components/tri/area-estimate";
import { StartDiagnostic } from "@/components/tri/start-diagnostic";
import { ScreenHeader } from "@/components/shell/app-shell";
import { DemoBadge } from "@/components/ui/demo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { demoConfig, demoData } from "@/lib/demo/tri";
import { loadDiagnostic, MIN_ITEMS_FOR_ESTIMATE } from "@/lib/tri/diagnostic";

export const metadata: Metadata = { title: "Diagnóstico" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  nao_validado: "cálculo ainda não validado contra notas de referência",
  em_validacao: "cálculo em validação",
  validado: "cálculo validado contra notas de referência",
};

export default async function DiagnosticoPage() {
  const areas = await loadDiagnostic();
  if (!areas)
    return (
      <>
        <ScreenHeader title="Diagnóstico" />
        <EmptyState icon={Gauge} title="Entre para ver o diagnóstico" body="A estimativa usa as suas respostas." action={{ href: "/entrar", label: "Entrar" }} />
      </>
    );
  return (
    <>
      <ScreenHeader title="Diagnóstico" kicker="Estimativa por área (TRI)" />
      <p className="mb-10 max-w-3xl t-reading text-ink-2">
        A TRI estima sua proficiência pelo padrão das respostas, não só pela quantidade de acertos: errar uma questão fácil e acertar uma difícil
        pesa diferente, e acertar ao acaso conta menos. Para isso cada questão precisa dos parâmetros oficiais. Só entram respostas sem ajuda, na
        primeira vez que você vê a questão.
      </p>

      {areas.every((a) => a.reason === "sem_modelo") && (
        <p className="mb-8 max-w-3xl border-l-2 border-line pl-4 t-reading text-ink">
          <span className="font-medium">Estimativa indisponível nas quatro áreas.</span>{" "}
          <span className="text-ink-2">
            Nenhum conjunto de parâmetros oficiais foi carregado ainda (eles vêm dos microdados do Inep). Sem eles, qualquer número seria
            inventado. O diagnóstico já pode ser feito: as respostas ficam guardadas e entram na estimativa quando os parâmetros chegarem.
          </span>
        </p>
      )}
      <ol className="flex flex-col">
        {areas.map((a) => (
          <li key={a.code} className="grid gap-5 border-t border-line-subtle py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
            <div>
              <h2 className="t-section">{a.label}</h2>
              <p className="mt-1 t-meta tabular text-ink-2">
                {a.responses} {a.responses === 1 ? "resposta" : "respostas"} sem ajuda · {a.correct} certas
                <br />
                {a.withParameters} com parâmetro oficial
              </p>
            </div>
            <div className="flex flex-col gap-4">
              {a.reason === null && a.model ? (
                <>
                  <AreaEstimate
                    input={{
                      config: a.model.config,
                      data: a.data,
                      unit: a.model.config.transform ? "pontos" : "θ",
                      bandLabel: "faixa posterior do modelo, não calibrada",
                    }}
                  />
                  <p className="t-meta text-ink-2">
                    Modelo {a.model.id} · {a.model.parameterSet} · {STATUS[a.model.status] ?? a.model.status}
                    {a.model.transformSource ? ` · escala: ${a.model.transformSource}` : " · escala do modelo (θ), sem conversão para nota"}. Não é a nota oficial.
                  </p>
                </>
              ) : (
                <p className="max-w-2xl t-ui text-ink">
                  <span className="font-medium">Indisponível. </span>
                  <span className="text-ink-2">
                    {a.reason === "sem_modelo"
                      ? areas.every((x) => x.reason === "sem_modelo")
                        ? "Sem parâmetros oficiais desta área."
                        : "Nenhum conjunto de parâmetros oficiais desta área foi carregado (eles vêm dos microdados do Inep). Sem eles, qualquer número seria inventado; seus acertos continuam contando no Progresso."
                      : a.reason === "sem_parametros"
                        ? "Há parâmetros carregados, mas nenhuma das questões que você respondeu sem ajuda tem parâmetro válido."
                        : `São necessárias pelo menos ${MIN_ITEMS_FOR_ESTIMATE} respostas com parâmetro (regra da plataforma); você tem ${a.withParameters}.`}
                  </span>
                </p>
              )}
              <StartDiagnostic area={a.code as "LC" | "CH" | "CN" | "MT"} label={a.label} available={a.publishedItems} />
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="como-funciona" className="mt-6 flex flex-col gap-5 rounded-panel border border-dashed border-line px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="como-funciona" className="t-section">
            Como a régua funciona
          </h2>
          <DemoBadge>Parâmetros fictícios</DemoBadge>
        </div>
        <p className="max-w-3xl t-meta text-ink-2">
          Oito questões inventadas, com parâmetros fictícios, na escala do modelo (θ). O cálculo é o mesmo que será usado com os parâmetros
          oficiais. Escolha um erro para ver o conjunto recalculado.
        </p>
        <AreaEstimate input={{ config: demoConfig, data: demoData, unit: "θ", bandLabel: "faixa posterior do modelo" }} />
      </section>
    </>
  );
}
