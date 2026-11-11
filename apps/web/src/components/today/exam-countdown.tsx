import { clsx } from "clsx";
import Link from "next/link";
import { inFinalStretch, longExamDate } from "@/lib/routine/exam";

/** Contagem até o 1º dia (data informada pela conta, provisória até o edital). */
export function ExamCountdown({ examDay, days }: { examDay: string | null; days: number | null }) {
  if (!examDay || days === null || days < 0) return null;
  const final = inFinalStretch(days);
  return (
    <Link
      href="/rotina#prova"
      title={`1º dia em ${longExamDate(examDay)} (data informada por você; provisória até o edital do Inep)`}
      className={clsx(
        "flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-4 t-meta hover:border-line",
        final ? "border-transparent bg-mark-yellow text-on-mark" : "border-line-subtle bg-surface text-ink",
      )}
    >
      {final && <span className="font-medium">Reta final ·</span>}
      <span>
        {days === 0 ? (
          <span className="font-medium">A prova é hoje</span>
        ) : (
          <>
            Prova em <span className="font-medium tabular">{days} {days === 1 ? "dia" : "dias"}</span>
          </>
        )}
      </span>
    </Link>
  );
}
