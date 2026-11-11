"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { daysUntil, FINAL_STRETCH_DAYS, longExamDate } from "@/lib/routine/exam";
import { setExamDay } from "@/lib/routine/exam-actions";

/**
 * Data da prova: informada por você e marcada como provisória até o edital do Inep. Liga a contagem
 * em Hoje e, nos últimos 60 dias, a reta final (o plano troca o treino livre por blocos de ritmo).
 */
export function ExamDayForm({ examDay, today }: { examDay: string | null; today: string }) {
  const router = useRouter();
  const [value, setValue] = useState(examDay ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (date: string | null) =>
    start(async () => {
      const r = await setExamDay({ date });
      setMsg(r.ok ? { ok: true, text: date ? "Data salva." : "Data removida." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });
  const days = examDay ? daysUntil(today, examDay) : null;
  return (
    <section aria-labelledby="prova" className="flex max-w-2xl flex-col gap-4">
      <h2 id="prova" className="scroll-mt-24 t-section">
        Data da prova
      </h2>
      <p className="t-meta text-ink-2">
        O Inep ainda não publicou o edital do Enem 2027. Informe a data que você espera para o 1º dia; ela fica marcada como
        provisória. Nos últimos {FINAL_STRETCH_DAYS} dias, o plano entra na reta final: revisão primeiro e blocos de ritmo no lugar
        do treino livre.
      </p>
      {examDay && days !== null && (
        <p className="t-ui">
          1º dia em {longExamDate(examDay)}{" "}
          <span className="t-meta text-ink-2">
            (provisória, informada por você){days >= 0 ? ` · faltam ${days} ${days === 1 ? "dia" : "dias"}` : " · data passada"}
          </span>
        </p>
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value) save(value);
        }}
      >
        <label className="flex flex-col gap-1 t-meta text-ink-2">
          1º dia
          <input
            type="date"
            required
            min="2026-01-01"
            max="2100-12-31"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink"
          />
        </label>
        <Button type="submit" loading={pending}>
          Salvar data
        </Button>
        {examDay && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => save(null)}>
            Remover
          </Button>
        )}
      </form>
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className="t-meta">{msg.text}</p>}</div>
    </section>
  );
}
