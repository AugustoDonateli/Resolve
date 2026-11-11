import Link from "next/link";
import { inFinalStretch, longExamDate } from "@/lib/routine/exam";

/**
 * Contagem até o 1º dia, como carimbo de data na folha (data informada pela conta, provisória até o
 * edital). Na reta final ganha o rótulo por extenso; a cor nunca é a única pista.
 */
export function ExamCountdown({ examDay, days }: { examDay: string | null; days: number | null }) {
  if (!examDay || days === null || days < 0) return null;
  const final = inFinalStretch(days);
  return (
    <Link
      href="/rotina#prova"
      title={`1º dia em ${longExamDate(examDay)} (data informada por você; provisória até o edital do Inep)`}
      className="stamp stamp-hit !grid size-[5.6rem] shrink-0 !rounded-full !p-0 text-center text-pen hover:[filter:none]"
    >
      <span className="flex flex-col items-center leading-none">
        <span className="text-[9px]">{days === 0 ? "a prova" : final ? "reta final" : "faltam"}</span>
        <span className="my-0.5 font-display text-[34px] font-normal normal-case leading-none tracking-normal tabular">{days === 0 ? "é hoje" : days}</span>
        {days > 0 && <span className="text-[9px]">{days === 1 ? "dia" : "dias"}</span>}
      </span>
    </Link>
  );
}
