"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveFicha } from "@/lib/guide/actions";
import { HOURS_OPTIONS, type FichaDefaults } from "@/lib/guide/types";

const label = "block font-mono text-[11.5px] font-medium uppercase leading-4 tracking-[0.1em] text-ink-2";
const chip =
  "inline-flex min-h-11 cursor-pointer items-center rounded-control border border-line px-3.5 t-ui text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-background has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--rs-link-focus)]";

/**
 * Ficha de identificação, como o cabeçalho de um cartão de prova: três perguntas (curso e onde, horas
 * por semana, língua estrangeira) e a data do 1º dia, que já vem com uma estimativa enquanto não há edital.
 * Tudo é opcional; o que ficar em branco não apaga o que a conta já tinha.
 */
export function FichaForm({
  defaults,
  submitLabel = "Guardar ficha",
  onSaved,
  secondary,
}: {
  defaults: FichaDefaults;
  submitLabel?: string;
  onSaved: () => void;
  /** Ação ao lado do botão principal (ex.: "Depois"). */
  secondary?: { label: string; onClick: () => void };
}) {
  const uid = useId();
  const [course, setCourse] = useState(defaults.course);
  const [institution, setInstitution] = useState(defaults.institution);
  const [hours, setHours] = useState<number | null>(defaults.weeklyHours);
  const [language, setLanguage] = useState(defaults.language);
  const [examDay, setExamDay] = useState(defaults.examDay ?? "");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Horas já guardadas fora das opções (valor antigo): aparecem como opção própria, para não se perderem.
  const hourOptions = hours !== null && !HOURS_OPTIONS.includes(hours as (typeof HOURS_OPTIONS)[number]) ? [...HOURS_OPTIONS, hours].sort((a, b) => a - b) : HOURS_OPTIONS;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMessage(null);
          const r = await saveFicha({
            course: defaults.goalLocked ? "" : course,
            institution: defaults.goalLocked ? "" : institution,
            weeklyHours: hours,
            language,
            examDay: examDay || null,
          });
          if (r.ok) onSaved();
          else setMessage(r.message);
        });
      }}
    >
      {defaults.goalLocked ? (
        <div>
          <p className={label}>Curso</p>
          <p className="mt-1 t-reading text-ink">
            {defaults.course}, {defaults.institution}.{" "}
            <Link href="/progresso/meta" className="t-meta text-link underline">
              Mudar em Meta de curso
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-curso`} className={label}>
              1 · Curso que você quer
            </label>
            <input id={`${uid}-curso`} className="field-line" maxLength={120} autoComplete="off" placeholder="Ex.: Medicina" value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${uid}-onde`} className={label}>
              Onde
            </label>
            <input id={`${uid}-onde`} className="field-line" maxLength={160} autoComplete="off" placeholder="Ex.: UFMG" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
          <p className="t-meta text-ink-2 sm:col-span-2">Ainda não decidiu? Deixe os dois em branco.</p>
        </div>
      )}

      <fieldset>
        <legend className={label}>2 · Horas de estudo por semana</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {hourOptions.map((h) => (
            <label key={h} className={chip}>
              <input type="radio" name={`${uid}-horas`} className="sr-only" checked={hours === h} onChange={() => setHours(h)} />
              {h === 40 ? "40 h ou mais" : `${h} h`}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>3 · Língua estrangeira da prova</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["ingles", "Inglês"],
              ["espanhol", "Espanhol"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className={chip}>
              <input type="radio" name={`${uid}-lingua`} className="sr-only" checked={language === value} onChange={() => setLanguage(value)} />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${uid}-data`} className={label}>
          1º dia de prova
        </label>
        <input
          id={`${uid}-data`}
          type="date"
          min="2026-01-01"
          max="2100-12-31"
          className="field-line max-w-[14rem] tabular"
          aria-describedby={`${uid}-data-nota`}
          value={examDay}
          onChange={(e) => setExamDay(e.target.value)}
        />
        <p id={`${uid}-data-nota`} className="mt-1.5 max-w-[60ch] t-meta text-ink-2">
          {defaults.examDayFromAccount
            ? "Data informada por você. Fica como provisória até o edital do Inep."
            : "O edital do Enem 2027 ainda não saiu. A prova costuma cair em dois domingos de novembro; 7 de novembro é uma estimativa. Troque quando a data oficial sair."}
        </p>
      </div>

      <div aria-live="polite">
        {message && (
          <p role="alert" className="t-ui text-ink">
            {message}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {secondary && (
          <Button type="button" variant="ghost" disabled={pending} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
      </div>
    </form>
  );
}
