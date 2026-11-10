"use client";

import { clsx } from "clsx";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Button } from "@/components/ui/button";
import { TRACK } from "@/lib/essay/track";
import { setTrackStep } from "@/lib/essay/track-actions";
import type { TrackData } from "@/lib/essay/track-data";

export function TrackView({ data }: { data: TrackData }) {
  const router = useRouter();
  const reduced = useReduced();
  const [done, setDone] = useState(new Set(data.done));
  const firstOpen = TRACK.find((s) => !done.has(s.id))?.id ?? TRACK[0]!.id;
  const [openId, setOpenId] = useState(firstOpen);
  const [pending, start] = useTransition();
  const ratio = done.size / TRACK.length;

  const toggle = (id: string) => {
    const next = !done.has(id);
    setDone((d) => {
      const n = new Set(d);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
    if (next) {
      const after = TRACK.find((s) => s.id !== id && !done.has(s.id) && TRACK.indexOf(s) > TRACK.findIndex((x) => x.id === id));
      if (after) setOpenId(after.id);
    }
    start(async () => {
      const r = await setTrackStep({ step: id, done: next });
      if (!r.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="t-meta tabular text-ink-2" role="status">
        {done.size} de {TRACK.length} etapas feitas
      </p>
      <ol className="relative flex flex-col">
        {/* margem do caderno: a linha se preenche com o progresso */}
        <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-line-subtle" />
        <motion.span
          aria-hidden
          className="absolute left-[15px] top-4 w-0.5 origin-top bg-primary"
          style={{ height: "calc(100% - 2rem)" }}
          initial={false}
          animate={{ scaleY: ratio }}
          transition={{ duration: reduced ? 0 : duration.evidence / 1000, ease: ease.evidence }}
        />
        {TRACK.map((s, i) => {
          const isDone = done.has(s.id);
          const open = openId === s.id;
          const r = s.competency ? data.rubric[s.competency] : null;
          return (
            <li key={s.id} className="relative pb-6 pl-12 last:pb-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? "" : s.id)}
                aria-expanded={open}
                className="group flex w-full items-start gap-3 text-left"
              >
                <span
                  className={clsx(
                    "absolute left-0 top-0 grid size-8 place-items-center rounded-full border-2 t-meta font-semibold transition-colors duration-[var(--rs-dur-state)]",
                    isDone ? "border-primary bg-primary text-on-primary" : open ? "border-primary bg-surface text-link" : "border-line-subtle bg-background text-ink-2",
                  )}
                  aria-hidden
                >
                  {isDone ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex flex-col pt-1">
                  <span className={clsx("t-ui group-hover:underline", isDone ? "text-ink-2" : "text-ink")}>{s.title}</span>
                  {s.competency && <span className="t-meta text-ink-2">Competência {s.competency.slice(1)}</span>}
                </span>
              </button>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : duration.layout / 1000, ease: ease.layout }}
                  className="mt-3 flex max-w-2xl flex-col gap-4"
                >
                  <p className="t-reading text-ink">{s.why}</p>
                  <ul className="flex flex-col gap-1.5">
                    {s.how.map((h) => (
                      <li key={h} className="flex gap-2 t-ui text-ink">
                        <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-2" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  {r?.top && (
                    <blockquote className="border-l-2 border-line pl-4">
                      <p className="t-meta text-ink-2">
                        Nível 200 da competência {s.competency!.slice(1)} na matriz do Inep{r.page ? ` (p. ${r.page})` : ""}:
                      </p>
                      <p className="mt-1 font-display text-[19px] leading-snug text-ink">“{r.top}”</p>
                    </blockquote>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={s.action.href}
                      className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
                    >
                      {s.action.label} <ArrowRight aria-hidden className="size-4" />
                    </Link>
                    <Button type="button" variant="ghost" disabled={pending} onClick={() => toggle(s.id)}>
                      {isDone ? "Desmarcar" : "Marcar como feita"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="t-meta text-ink-2">Trilha da plataforma: sequência didática do Resolve, não material do Inep. Os textos citados da matriz vêm da rubrica oficial registrada.</p>
    </div>
  );
}
