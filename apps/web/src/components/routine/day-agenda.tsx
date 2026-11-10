"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { canPlace, type StudyBlock } from "@/lib/demo/routine";
import { rescheduleBlock } from "@/lib/routine/plan-actions";
import type { DayPlan } from "@/lib/routine/plan";
import { Agenda } from "./agenda";
import { RescheduleDialog } from "./reschedule-dialog";

/**
 * Remarcação acessível (F4-T16) sobre o plano real: arrastar e formulário usam a mesma regra
 * (`canPlace`) na tela e a mesma ação no servidor, que confere de novo antes de gravar.
 * Compromissos aparecem fixos; blocos em curso ou feitos também não se movem.
 */
export function DayAgenda({ plan }: { plan: DayPlan }) {
  const router = useRouter();
  const [moved, setMoved] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const blocks: StudyBlock[] = useMemo(
    () => [
      ...plan.blocks
        .filter((b) => b.status !== "dispensado")
        .map((b) => ({
          id: b.id,
          kind: b.kind,
          title: b.title,
          detail: b.reason ?? "",
          start: moved[b.id] ?? b.start_minute,
          minutes: b.planned_minutes,
          fixed: b.status !== "planejado",
        })),
      ...plan.commitments.map((c, i) => ({
        id: `compromisso-${i}`,
        kind: "compromisso" as const,
        title: c.title,
        detail: "Compromisso fixo",
        start: c.start,
        minutes: c.end - c.start,
        fixed: true,
      })),
    ],
    [plan, moved],
  );
  if (!plan.blocks.length) return null;
  // Remarcar só daqui para a frente: a grade começa no próximo horário de 15 min a partir de agora,
  // e o que já terminou não aparece.
  // Agora no fuso do perfil (o mesmo em que o plano foi feito), não no relógio do aparelho.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: plan.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const now =
    Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const gridStart = Math.min(1425, Math.ceil(now / 15) * 15);
  const visible = blocks
    .filter((b) => b.start + b.minutes > gridStart)
    .map((b) =>
      b.start < gridStart
        ? { ...b, start: gridStart, minutes: b.start + b.minutes - gridStart }
        : b,
    );
  const ends = [
    ...visible.map((b) => b.start + b.minutes),
    ...plan.available.map((w) => w.end),
  ];
  const gridEnd = Math.min(
    1440,
    Math.ceil((Math.max(gridStart + 60, ...ends) + 30) / 60) * 60,
  );

  const move = (
    id: string,
    start: number,
  ): { ok: true } | { ok: false; reason: string } => {
    const check = canPlace(visible, id, start, gridStart, gridEnd);
    if (!check.ok) return check;
    const before = moved[id];
    setMoved((m) => ({ ...m, [id]: start })); // registra antes da animação (§8)
    setMessage(null);
    void rescheduleBlock({ id, start }).then((r) => {
      if (r.ok) router.refresh();
      else {
        setMoved((m) => {
          const n = { ...m };
          if (before === undefined) delete n[id];
          else n[id] = before;
          return n;
        });
        setMessage(r.message);
      }
    });
    return { ok: true };
  };

  return (
    <div className="flex flex-col gap-2">
      <Agenda
        blocks={visible}
        gridStart={gridStart}
        gridEnd={gridEnd}
        nowMin={now}
        focusedId={null}
        onReschedule={move}
        onOpenReschedule={(id) => setOpenId(id)}
      />
      <div aria-live="assertive">
        {message && (
          <p role="alert" className="t-ui">
            {message}
          </p>
        )}
      </div>
      <RescheduleDialog
        block={
          openId
            ? (visible.find((b) => b.id === openId && !b.fixed) ?? null)
            : null
        }
        blocks={visible}
        gridStart={gridStart}
        gridEnd={gridEnd}
        onClose={() => setOpenId(null)}
        onConfirm={(id, s) => {
          setOpenId(null);
          const r = move(id, s);
          if (!r.ok) setMessage(r.reason);
        }}
      />
    </div>
  );
}
