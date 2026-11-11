/** Reta final (regra da plataforma `reta-final-v1`, não do Inep): os últimos 60 dias antes do 1º dia. */
export const FINAL_STRETCH_DAYS = 60;

/** Dias inteiros de `today` até `examDay` (ambos "AAAA-MM-DD"); negativo depois da prova. */
export function daysUntil(today: string, examDay: string): number {
  const toUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((toUtc(examDay) - toUtc(today)) / 86_400_000);
}

export function inFinalStretch(days: number | null): boolean {
  return days !== null && days >= 0 && days <= FINAL_STRETCH_DAYS;
}

/** "2027-11-07" → "7 de novembro de 2027". */
export function longExamDate(day: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))),
  );
}
