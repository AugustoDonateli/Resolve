"use client";

import { clsx } from "clsx";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChartTarget, GrifoCommand, LessonResource, StepChart } from "@/lib/lessons/types";

const money = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const factor = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Moldura comum: o recurso é uma folha menor dentro da explicação, com rótulo e abertura. */
function Frame({ label, intro, children }: { label: string; intro: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-card border border-line-subtle bg-surface p-4 shadow-paper sm:p-6">
      <p className="t-kicker">{label}</p>
      <p className="mt-1 t-reading text-ink">{intro}</p>
      <div className="mt-4">{children}</div>
    </figure>
  );
}

/* ── Controle deslizante: aumento e desconto seguidos ── */

function Slider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 t-ui text-ink">
        {label}
        <output htmlFor={id} className="font-mono text-[14px] tabular">
          {value}%
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={50}
        step={5}
        value={value}
        aria-valuetext={`${value}%`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--rs-primary)]"
      />
    </div>
  );
}

export function PercentControl({ base, intro }: { base: number; intro: string }) {
  const uid = useId();
  const [up, setUp] = useState(10);
  const [down, setDown] = useState(10);
  const v1 = (base * (100 + up)) / 100;
  const v2 = (v1 * (100 - down)) / 100;
  const diff = v2 - base;
  const rows = [
    { label: "Antes", value: base },
    { label: `Depois do aumento de ${up}%`, value: v1 },
    { label: `Depois do desconto de ${down}%`, value: v2 },
  ];
  const max = base * 1.5;
  const w = 300;
  const x = (v: number) => (v / max) * w;
  return (
    <Frame label="Mexa nos controles" intro={intro}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider id={`${uid}-up`} label="Aumento" value={up} onChange={setUp} />
        <Slider id={`${uid}-down`} label="Desconto, depois" value={down} onChange={setDown} />
      </div>
      <ul className="mt-5 flex flex-col gap-3" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)] gap-1">
            <span className="flex justify-between gap-3 t-meta text-ink-2">
              <span>{r.label}</span>
              <span className="font-mono tabular text-ink">R$ {money(r.value)}</span>
            </span>
            <svg viewBox={`0 0 ${w} 14`} preserveAspectRatio="none" className="h-3.5 w-full overflow-visible">
              <rect x={0} y={1} width={x(r.value)} height={12} className="fill-ink" />
              <line x1={x(base)} x2={x(base)} y1={-3} y2={17} className="stroke-ink-2" strokeWidth={1.5} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
            </svg>
          </li>
        ))}
      </ul>
      <p className="mt-1 t-meta text-ink-2" aria-hidden="true">
        A linha tracejada marca os R$ {money(base)} do começo.
      </p>
      <p aria-live="polite" className="mt-4 border-t border-line-subtle pt-3 t-reading text-ink">
        R$ {money(base)} × {factor(1 + up / 100)} × {factor(1 - down / 100)} = R$ {money(v2)}.{" "}
        {Math.abs(diff) < 0.005
          ? "Voltou ao valor do começo."
          : diff < 0
            ? `Ficou R$ ${money(-diff)} abaixo do começo.`
            : `Ficou R$ ${money(diff)} acima do começo.`}
      </p>
    </Frame>
  );
}

/* ── Gráfico em etapas, com marca-texto no ponto de cada etapa ── */

const isBar = (t: ChartTarget): t is { category: number; series: number } => typeof t === "object";

function Hl({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className="mark mark-yellow" data-on={on} style={{ ["--sweep" as string]: on ? 1 : 0 }}>
      {children}
    </span>
  );
}

export function ChartSteps({ chart, steps, intro }: { chart: StepChart; steps: { label: string; target: ChartTarget; text: string }[]; intro: string }) {
  const [i, setI] = useState(0);
  const step = steps[i]!;
  const t = step.target;
  const W = 360;
  const H = 210;
  const left = 38;
  const bottom = 30;
  const top = 8;
  const plotH = H - bottom - top;
  const y = (v: number) => top + plotH - (v / chart.max) * plotH;
  const groupW = (W - left - 8) / chart.categories.length;
  const barW = Math.min(30, (groupW - 16) / chart.series.length);
  const ticks = Array.from({ length: Math.floor(chart.max / chart.tick) + 1 }, (_, k) => k * chart.tick);
  const patternId = useId().replace(/:/g, "");
  return (
    <Frame label="Gráfico de exemplo, em etapas" intro={intro}>
      <div className="mx-auto max-w-[30rem]">
        <p className="t-ui font-semibold text-ink">
          <Hl on={t === "titulo"}>{chart.title}</Hl>
        </p>
        <p className="mt-2 t-meta text-ink">
          <Hl on={t === "eixo"}>{chart.unit}</Hl>
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`Gráfico de barras: ${chart.title}. Os valores estão na tabela logo abaixo.`}>
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" className="fill-surface" />
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-ink" strokeWidth="2.4" />
            </pattern>
          </defs>
          {t === "eixo" && <rect x={0} y={0} width={left - 4} height={H - bottom + 6} rx={3} className="fill-mark-yellow" />}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={left} x2={W - 4} y1={y(v)} y2={y(v)} className="stroke-line-subtle" strokeWidth={1} />
              <text x={left - 6} y={y(v) + 4} textAnchor="end" fontSize={13} className={clsx("font-mono", t === "eixo" ? "fill-on-mark" : "fill-ink-2")}>
                {v}
              </text>
            </g>
          ))}
          {chart.categories.map((c, ci) => {
            const gx = left + ci * groupW + (groupW - barW * chart.series.length) / 2;
            return (
              <g key={c}>
                {chart.series.map((s, si) => {
                  const v = s.values[ci]!;
                  const bx = gx + si * barW;
                  const hit = isBar(t) && t.category === ci && t.series === si;
                  return (
                    <g key={s.name}>
                      {hit && <rect x={bx - 5} y={y(v) - 20} width={barW + 10} height={plotH + top - y(v) + 22} rx={3} className="fill-mark-yellow" />}
                      <rect x={bx + 1} y={y(v)} width={barW - 2} height={top + plotH - y(v)} fill={si === 0 ? undefined : `url(#${patternId})`} className={clsx(si === 0 && "fill-ink", "stroke-ink")} strokeWidth={1} />
                      {hit && (
                        <text x={bx + barW / 2} y={y(v) - 6} textAnchor="middle" fontSize={14} className="fill-on-mark font-mono font-semibold">
                          {v}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text x={left + ci * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize={14} className="fill-ink">
                  {c}
                </text>
              </g>
            );
          })}
          <line x1={left} x2={W - 4} y1={top + plotH} y2={top + plotH} className="stroke-ink" strokeWidth={1.5} />
        </svg>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 t-meta text-ink">
          <Hl on={t === "legenda"}>
            {chart.series.map((s, si) => (
              <span key={s.name} className="mr-4 inline-flex items-center gap-1.5 last:mr-0">
                <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
                  <rect x={0.5} y={0.5} width={11} height={11} fill={si === 0 ? undefined : `url(#${patternId})`} className={clsx(si === 0 && "fill-ink", "stroke-ink")} />
                </svg>
                {s.name}
              </span>
            ))}
          </Hl>
        </p>
        <table className="sr-only">
          <caption>{chart.title}</caption>
          <thead>
            <tr>
              <th scope="col">Categoria</th>
              {chart.series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.categories.map((c, ci) => (
              <tr key={c}>
                <th scope="row">{c}</th>
                {chart.series.map((s) => (
                  <td key={s.name}>{s.values[ci]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 border-t border-line-subtle pt-4">
        <p className="t-kicker">
          Etapa {i + 1} de {steps.length} · {step.label}
        </p>
        <p aria-live="polite" className="mt-1 min-h-[3.5rem] t-reading text-ink">
          {step.text}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
            Voltar
          </Button>
          <Button size="sm" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>
            Próxima etapa
          </Button>
        </div>
      </div>
    </Frame>
  );
}

/* ── Grifo no comando: o aluno marca as palavras e compara com o grifo revisado ── */

function GrifoItem({ cmd, n, total }: { cmd: GrifoCommand; n: number; total: number }) {
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);
  const missing = cmd.words.filter((w, k) => w.core && !marked.has(k)).map((w) => w.t);
  const extra = cmd.words.filter((w, k) => !w.core && !w.ok && marked.has(k)).map((w) => w.t);
  const clean = (t: string) => t.replace(/[,.;:]$/, "");
  return (
    <li className="border-t border-line-subtle py-4 first:border-t-0 first:pt-0">
      <p className="t-meta text-ink-2">
        Comando {n} de {total}
      </p>
      <p className="mt-1 t-reading text-ink" role="group" aria-label="Palavras do comando: toque nas que dizem o que se pede">
        {cmd.words.map((w, k) => {
          const on = marked.has(k);
          return (
            <span key={k}>
              <button
                type="button"
                aria-pressed={on}
                disabled={checked}
                onClick={() =>
                  setMarked((m) => {
                    const next = new Set(m);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                className="inline-flex min-h-9 min-w-6 items-center justify-center rounded-[3px] px-0.5 align-baseline hover:bg-surface-subtle disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="mark mark-yellow" data-on={on} style={{ ["--sweep" as string]: on ? 1 : 0 }}>
                  {w.t}
                </span>
              </button>{" "}
            </span>
          );
        })}
      </p>
      {!checked ? (
        <Button size="sm" variant="secondary" className="mt-2" disabled={marked.size === 0} onClick={() => setChecked(true)}>
          Comparar com o grifo revisado
        </Button>
      ) : (
        <div className="mt-2 flex flex-col gap-2" aria-live="polite">
          <p className="t-meta text-ink-2">Grifo revisado:</p>
          <p className="t-reading text-ink">
            {cmd.words.map((w, k) => (
              <span key={k}>
                {w.core ? (
                  <span className="mark mark-pink" data-on="true" style={{ ["--sweep" as string]: 1 }}>
                    {w.t}
                  </span>
                ) : (
                  w.t
                )}{" "}
              </span>
            ))}
          </p>
          <p className="t-reading text-ink">
            {missing.length === 0 && extra.length === 0
              ? "Seu grifo pegou o núcleo. "
              : [missing.length ? `Faltou grifar: ${missing.map(clean).join(", ")}.` : "", extra.length ? `Não precisava: ${extra.map(clean).join(", ")}.` : ""].filter(Boolean).join(" ") + " "}
            {cmd.why}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => {
              setChecked(false);
              setMarked(new Set());
            }}
          >
            Grifar de novo
          </Button>
        </div>
      )}
    </li>
  );
}

export function Grifo({ commands, intro }: { commands: GrifoCommand[]; intro: string }) {
  return (
    <Frame label="Grife o núcleo" intro={intro}>
      <ol className="flex flex-col">
        {commands.map((c, n) => (
          <GrifoItem key={n} cmd={c} n={n + 1} total={commands.length} />
        ))}
      </ol>
    </Frame>
  );
}

/** O recurso da lição, escolhido pelo tipo. */
export function LessonResourceView({ resource }: { resource: LessonResource }) {
  switch (resource.kind) {
    case "controle-porcentagem":
      return <PercentControl base={resource.base} intro={resource.intro} />;
    case "grafico-em-etapas":
      return <ChartSteps chart={resource.chart} steps={resource.steps} intro={resource.intro} />;
    case "grifo":
      return <Grifo commands={resource.commands} intro={resource.intro} />;
  }
}
