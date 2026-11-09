"use client";

import { clsx } from "clsx";
import { Check, HelpCircle, Table2, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { isOffscreen } from "@/components/question/margin-notes";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { demoSkills, evaluate, MASTERY_RULE, recentRefs, type AttemptRef, type SkillNode } from "@/lib/demo/constellation";

const R = 34; // raio da órbita dos pontos de tentativa (px)

function dayLabel(d: number) {
  return d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
}

/**
 * Constelação como evidência (M05 + teste R0-P03; protótipo F1-T15).
 * Cada nó mostra suas tentativas como pontos. Abrir o nó transforma esses
 * pontos nas oito referências que sustentam o estado — a origem do diagnóstico
 * fica explicável por toque e teclado. Posições são estáveis.
 */
export function Constellation() {
  const reduced = useReduced();
  const [openId, setOpenId] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const evals = useMemo(() => new Map(demoSkills.map((s) => [s.id, evaluate(s.attempts)])), []);
  const open = demoSkills.find((s) => s.id === openId) ?? null;

  const close = () => {
    const id = openId;
    setOpenId(null);
    if (id) requestAnimationFrame(() => nodeRefs.current.get(id)?.focus());
  };

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const T = (i: number) => ({ duration: reduced ? 0 : duration.evidence / 1000, ease: ease.evidence, delay: reduced ? 0 : i * 0.035 });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="t-meta text-ink-2">
          Regra {MASTERY_RULE.version}: classificar só com {MASTERY_RULE.minUnassisted} tentativas sem ajuda, {MASTERY_RULE.minDistinctItems} itens diferentes e {MASTERY_RULE.minDays} dias.
        </p>
        <DemoBadge>Habilidades e tentativas demonstrativas</DemoBadge>
      </div>

      <LayoutGroup id="constelacao">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <section aria-labelledby="map-title" className="paper-grain relative rounded-panel border border-line-subtle bg-surface md:self-start">
            <h2 id="map-title" className="absolute left-4 top-3 t-meta font-medium uppercase tracking-[0.08em] text-ink-2">
              Linguagens · demonstração
            </h2>
            <div className="relative h-[380px] sm:h-[440px]">
              {/* Ligações estáveis entre nós da mesma área */}
              <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {demoSkills.slice(1).map((s, i) => (
                  <line key={s.id} x1={demoSkills[i]!.x} y1={demoSkills[i]!.y} x2={s.x} y2={s.y} stroke="var(--rs-border-subtle)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
              <ul>
                {demoSkills.map((s) => (
                  <li key={s.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                    <Node
                      skill={s}
                      ev={evals.get(s.id)!}
                      isOpen={openId === s.id}
                      onToggle={() => {
                        if (openId === s.id) return close();
                        setOpenId(s.id);
                        // Celular: o painel fica abaixo do mapa; traz o resultado da ação para a vista.
                        const panel = document.getElementById("evidence-panel");
                        if (panel && isOffscreen(panel)) panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
                      }}
                      refCb={(el) => {
                        if (el) nodeRefs.current.set(s.id, el);
                      }}
                      T={T}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <p className="px-4 pb-3 t-meta text-ink-2">
              <span aria-hidden="true">●</span> acerto sem ajuda · <span aria-hidden="true">○</span> erro sem ajuda · <span aria-hidden="true">◌</span> com ajuda (não conta)
            </p>
          </section>

          <section id="evidence-panel" aria-live="polite" aria-label="Evidências do nó" className="min-h-[200px] rounded-panel border border-line-subtle bg-surface p-4 sm:p-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {open ? (
                <Evidence key={open.id} skill={open} ev={evals.get(open.id)!} onClose={close} T={T} reduced={reduced} />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>
                  <HelpCircle aria-hidden="true" className="mb-2 size-5 text-ink-2" />
                  <p className="t-ui">De onde vem o estado de cada nó?</p>
                  <p className="mt-1 t-meta text-ink-2">Toque num nó ou use Tab e Enter. As tentativas que sustentam o estado aparecem aqui, uma por linha.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </LayoutGroup>

      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={() => setTable((v) => !v)} aria-expanded={table} icon={<Table2 aria-hidden className="size-4" />}>
          {table ? "Ocultar tabela" : "Ver como tabela"}
        </Button>
        {table && <SkillTable evals={evals} />}
      </div>
    </div>
  );
}

function Node({
  skill,
  ev,
  isOpen,
  onToggle,
  refCb,
  T,
}: {
  skill: SkillNode;
  ev: ReturnType<typeof evaluate>;
  isOpen: boolean;
  onToggle: () => void;
  refCb: (el: HTMLButtonElement | null) => void;
  T: (i: number) => object;
}) {
  const refs = recentRefs(skill);
  const refIds = new Set(refs.map((r) => r.id));
  const acc = ev.accuracy ?? 0;
  const circ = 2 * Math.PI * 17;
  return (
    <div className="relative grid place-items-center" style={{ width: R * 2 + 16, height: R * 2 + 16 }}>
      {/* Pontos de tentativa em órbita; os oito recentes viajam para a lista quando o nó abre */}
      {skill.attempts.map((a, i) => {
        const ang = (i / skill.attempts.length) * Math.PI * 2 - Math.PI / 2;
        const travels = refIds.has(a.id);
        if (isOpen && travels) return null;
        return (
          <motion.span
            key={a.id}
            layoutId={travels ? `dot-${a.id}` : undefined}
            transition={T(i)}
            aria-hidden="true"
            className="absolute"
            style={{ left: "50%", top: "50%", x: Math.cos(ang) * R - 4, y: Math.sin(ang) * R - 4 }}
          >
            <Dot a={a} size={8} />
          </motion.span>
        );
      })}
      <button
        ref={refCb}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="evidence-panel"
        aria-label={`${skill.code}: ${skill.label}. ${ev.sufficient ? `Evidência suficiente, acerto recente ${ev.correctUnassisted} de ${ev.unassisted}` : "Dados insuficientes"}. Abrir evidências.`}
        className={clsx(
          "relative grid size-11 place-items-center rounded-full bg-surface transition-[box-shadow] duration-[var(--rs-dur-state)]",
          isOpen && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 44 44" className="absolute inset-0">
          {ev.sufficient ? (
            <>
              <circle cx="22" cy="22" r="17" fill="none" stroke="var(--rs-border-subtle)" strokeWidth="4" />
              <circle cx="22" cy="22" r="17" fill="none" stroke="var(--rs-text)" strokeWidth="4" strokeDasharray={`${acc * circ} ${circ}`} transform="rotate(-90 22 22)" strokeLinecap="round" />
            </>
          ) : (
            <circle cx="22" cy="22" r="17" fill="none" stroke="var(--rs-border-control)" strokeWidth="2" strokeDasharray="3 3" />
          )}
        </svg>
        <span className="relative t-meta font-medium text-ink">{skill.code}</span>
      </button>
      <span aria-hidden="true" className="absolute top-full mt-0.5 whitespace-nowrap t-meta text-ink-2">
        {ev.sufficient ? `${Math.round(acc * 100)}% recente` : "dados insuficientes"}
      </span>
    </div>
  );
}

function Dot({ a, size }: { a: AttemptRef; size: number }) {
  return (
    <span
      className={clsx(
        "block rounded-full",
        a.help ? "border border-dashed border-ink-2" : a.correct ? "bg-ink" : "border-[1.5px] border-ink bg-surface",
      )}
      style={{ width: size, height: size }}
    />
  );
}

function Evidence({ skill, ev, onClose, T, reduced }: { skill: SkillNode; ev: ReturnType<typeof evaluate>; onClose: () => void; T: (i: number) => object; reduced: boolean }) {
  const refs = recentRefs(skill);
  const older = skill.attempts.length - refs.length;
  const crit = [
    { ok: ev.unassisted >= MASTERY_RULE.minUnassisted, text: `${ev.unassisted} tentativas sem ajuda (mínimo ${MASTERY_RULE.minUnassisted})` },
    { ok: ev.distinctItems >= MASTERY_RULE.minDistinctItems, text: `${ev.distinctItems} itens diferentes (mínimo ${MASTERY_RULE.minDistinctItems})` },
    { ok: ev.days >= MASTERY_RULE.minDays, text: `${ev.days} dia(s) de estudo (mínimo ${MASTERY_RULE.minDays})` },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="t-meta text-ink-2">{skill.code}</p>
          <h3 className="t-ui">{skill.label}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar evidências" className="grid size-9 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-surface-subtle hover:text-ink">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <p className="mt-3 t-ui">{ev.sufficient ? `Evidência suficiente · ${ev.correctUnassisted} de ${ev.unassisted} sem ajuda certas` : "Dados insuficientes"}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {crit.map((c) => (
          <li key={c.text} className="flex items-center gap-2 t-meta">
            {c.ok ? <Check aria-hidden="true" className="size-4 text-ink" /> : <X aria-hidden="true" className="size-4 text-ink-2" />}
            <span className={c.ok ? "text-ink" : "text-ink-2"}>
              {c.text}
              <span className="sr-only">{c.ok ? ", atendido" : ", não atendido"}</span>
            </span>
          </li>
        ))}
        {ev.withHelp > 0 && <li className="t-meta text-ink-2">{ev.withHelp} tentativa(s) com ajuda não contam.</li>}
      </ul>
      {!ev.sufficient && <p className="mt-2 t-meta text-ink">Falta: {ev.missing.join(", ")}.</p>}

      <p className="mb-2 mt-4 t-meta font-medium text-ink-2">Referências recentes</p>
      <ol className="flex flex-col">
        {refs.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 border-b border-line-subtle py-1.5 last:border-0">
            <motion.span layoutId={`dot-${a.id}`} transition={T(i)} aria-hidden="true" className="grid w-4 place-items-center">
              <Dot a={a} size={10} />
            </motion.span>
            <span className="flex-1 t-meta tabular">{a.item}</span>
            <span className="t-meta text-ink-2">
              {a.help ? "com ajuda" : a.correct ? "acerto" : "erro"} · {dayLabel(a.daysAgo)}
            </span>
          </li>
        ))}
      </ol>
      {older > 0 && <p className="mt-2 t-meta text-ink-2">+ {older} tentativa(s) mais antiga(s) contadas na regra.</p>}
      <p className="mt-3 t-meta text-ink-2">Na versão real, cada referência abre a questão respondida.</p>
    </motion.div>
  );
}

function SkillTable({ evals }: { evals: Map<string, ReturnType<typeof evaluate>> }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-card border border-line-subtle bg-surface">
      <table className="w-full text-left t-meta">
        <caption className="sr-only">Habilidades demonstrativas e evidências</caption>
        <thead className="border-b border-line-subtle text-ink-2">
          <tr>
            {["Habilidade", "Estado", "Sem ajuda", "Itens", "Dias", "Acerto recente"].map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {demoSkills.map((s) => {
            const e = evals.get(s.id)!;
            return (
              <tr key={s.id} className="border-b border-line-subtle last:border-0">
                <th scope="row" className="px-4 py-2 font-normal">{s.code} · {s.label}</th>
                <td className="px-4 py-2">{e.sufficient ? "Suficiente" : "Dados insuficientes"}</td>
                <td className="px-4 py-2 tabular">{e.unassisted}</td>
                <td className="px-4 py-2 tabular">{e.distinctItems}</td>
                <td className="px-4 py-2 tabular">{e.days}</td>
                <td className="px-4 py-2 tabular">{e.sufficient ? `${e.correctUnassisted}/${e.unassisted}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
