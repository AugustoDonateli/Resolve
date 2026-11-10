import { fmtDuration } from "@/lib/demo/routine";
import type { WeeklyReport as Report } from "@/lib/routine/weekly";

const AREA: Record<string, string> = { LC: "Linguagens", CH: "Humanas", CN: "Natureza", MT: "Matemática", RED: "Redação", geral: "Sem área" };

function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, d!))).replace(".", "");
}

/**
 * Relatório semanal: barra = minutos feitos (registrados pelo foco), traço = minutos planejados.
 * Uma série só, com o plano como marca de referência; a tabela tem os mesmos números.
 */
export function WeeklyReport({ r }: { r: Report }) {
  const max = Math.max(60, ...r.days.map((d) => Math.max(d.plannedMinutes, d.doneMinutes)));
  const H = 160;
  const t = r.totals;
  const goal = r.weeklyGoal ?? (r.dailyGoal ? r.dailyGoal * 7 : null);
  return (
    <section aria-labelledby="semana" className="flex flex-col gap-6">
      <div>
        <h2 id="semana" className="t-kicker">
          Últimos 7 dias
        </h2>
        <p className="mt-2 font-display text-[32px] leading-tight text-ink sm:text-[40px]">
          {t.done > 0 ? fmtDuration(t.done) : "Nenhum minuto"} de estudo registrado
          {t.planned > 0 && <span className="text-ink-2"> · {fmtDuration(t.planned)} planejados</span>}
        </p>
        {goal && (
          <p className="mt-1 t-meta text-ink-2">
            Meta da semana: {fmtDuration(goal)}
            {r.weeklyGoal ? "" : " (meta diária × 7)"} · {Math.round((t.done / goal) * 100)}% feito
          </p>
        )}
      </div>

      <figure className="flex flex-col gap-3">
        <div className="flex items-end gap-2 sm:gap-4" style={{ height: H + 28 }} aria-hidden="true">
          {r.days.map((d) => {
            const done = (d.doneMinutes / max) * H;
            const plan = (d.plannedMinutes / max) * H;
            return (
              <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                <div className="relative w-full max-w-12 border-b border-line" style={{ height: H }}>
                  {d.doneMinutes > 0 && (
                    <div className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-link" style={{ height: Math.max(2, done) }} />
                  )}
                  {d.plannedMinutes > 0 && (
                    <div className="absolute -inset-x-1 h-0.5 rounded-full bg-ink-2" style={{ bottom: plan }} />
                  )}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-control border border-line-subtle bg-surface px-3 py-2 t-meta text-ink shadow-paper group-hover:block">
                    <span className="block font-medium">{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                    feito {fmtDuration(d.doneMinutes)} · planejado {fmtDuration(d.plannedMinutes)}
                    <span className="block text-ink-2">
                      {d.blocksDone}/{d.blocksPlanned} blocos · {d.answers} respostas · {d.reviews} revisões
                    </span>
                  </div>
                </div>
                <span className={d.date === r.today ? "mt-2 t-meta font-medium text-ink" : "mt-2 t-meta text-ink-2"}>
                  {d.date === r.today ? "hoje" : weekday(d.date)}
                </span>
              </div>
            );
          })}
        </div>
        <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 t-meta text-ink-2">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-3 rounded-[3px] bg-link" /> minutos feitos (foco registrado)
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-ink-2" /> minutos planejados
          </span>
        </figcaption>
        <details className="t-meta">
          <summary className="cursor-pointer t-ui text-ink">Ver em tabela</summary>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="border-b border-line-subtle text-left text-ink-2">
                <th scope="col" className="py-1.5 pr-3 font-medium">Dia</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Feito</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Planejado</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Blocos</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Respostas</th>
                <th scope="col" className="py-1.5 font-medium">Revisões</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {r.days.map((d) => (
                <tr key={d.date} className="border-b border-line-subtle text-ink">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">{weekday(d.date)} {d.date.slice(8)}/{d.date.slice(5, 7)}</th>
                  <td className="py-1.5 pr-3">{fmtDuration(d.doneMinutes)}</td>
                  <td className="py-1.5 pr-3">{fmtDuration(d.plannedMinutes)}</td>
                  <td className="py-1.5 pr-3">{d.blocksDone}/{d.blocksPlanned}</td>
                  <td className="py-1.5 pr-3">{d.answers}{d.answers ? ` (${d.correct} certas)` : ""}</td>
                  <td className="py-1.5">{d.reviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figure>

      <p className="max-w-2xl t-reading text-ink">
        {t.blocksDone} de {t.blocksPlanned} blocos concluídos · {t.answers} {t.answers === 1 ? "resposta" : "respostas"}
        {t.answers ? ` (${t.correct} certas)` : ""} · {t.reviews} {t.reviews === 1 ? "revisão" : "revisões"} de cartão · {t.essays}{" "}
        {t.essays === 1 ? "redação enviada" : "redações enviadas"}.
      </p>

      {r.byArea.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="t-ui font-semibold">Por área (blocos concluídos)</h3>
          <ul className="flex flex-col">
            {r.byArea.map((a) => (
              <li key={a.area} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-subtle py-2">
                <span className="t-ui">{AREA[a.area] ?? a.area}</span>
                <span className="t-meta tabular text-ink-2">
                  {fmtDuration(a.minutes)}
                  {a.targetMinutes ? ` de ${fmtDuration(a.targetMinutes)} da meta semanal` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
