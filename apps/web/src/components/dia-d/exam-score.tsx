import type { ExamAreaScore } from "@/lib/tri/exam";

const one = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Nota por área do Dia D entregue. É o cálculo do Inep (TRI com os parâmetros oficiais da prova), por isso a
 * nota aparece com uma casa decimal, como no boletim. Sem modelo da área, diz que está indisponível.
 */
export function ExamScore({ scores }: { scores: ExamAreaScore[] }) {
  if (scores.length === 0) return null;
  const validated = scores.some((s) => s.validated);
  return (
    <section aria-labelledby="dia-d-nota" className="mb-6 flex flex-col gap-4 rounded-panel border border-line bg-surface p-4 sm:p-6">
      <h3 id="dia-d-nota" className="t-section">Nota por área</h3>
      <dl className="grid gap-5 sm:grid-cols-2">
        {scores.map((s) => (
          <div key={s.area} className="flex flex-col gap-1">
            <dt className="t-ui font-semibold">{s.label}</dt>
            <dd className="flex flex-col gap-1">
              {s.status === "ok" && s.score !== null ? (
                <>
                  <span className="t-metric tabular">{one(s.score)}</span>
                  <span className="t-meta tabular text-ink-2">
                    {s.correct} de {s.total} certas
                    {s.lower !== null && s.upper !== null && ` · faixa do modelo: ${Math.round(s.lower)} a ${Math.round(s.upper)}`}
                    {s.excluded > 0 && ` · ${s.excluded} ${s.excluded === 1 ? "questão retirada" : "questões retiradas"} do cálculo pelo Inep`}
                  </span>
                </>
              ) : s.status === "em_branco" ? (
                <>
                  <span className="t-metric tabular">0,0</span>
                  <span className="t-meta text-ink-2">Área inteira em branco. O Inep dá nota 0 nesse caso.</span>
                </>
              ) : (
                <span className="t-meta text-ink-2">
                  Indisponível: não há parâmetros oficiais carregados para esta área. {s.correct} de {s.total} certas.
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="max-w-3xl t-meta text-ink-2">
        Mesmo cálculo do Inep: TRI com os parâmetros oficiais de cada questão desta prova. Errar uma fácil pesa mais que errar uma difícil, e
        questão em branco conta como erro.{" "}
        {validated
          ? "O cálculo foi conferido contra as notas oficiais de participantes reais."
          : "O cálculo ainda não foi conferido contra notas oficiais."}
      </p>
    </section>
  );
}
