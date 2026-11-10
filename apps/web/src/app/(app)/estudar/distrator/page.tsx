import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { StartSkill } from "@/components/skills/start-skill";
import { ScreenHeader } from "@/components/shell/app-shell";
import { publishedByArea } from "@/lib/study/session";

export const metadata: Metadata = { title: "Caça ao distrator" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const counts = await publishedByArea();
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <Link href="/estudar" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Caça ao distrator" kicker="Treino de eliminação" />
      <p className="mb-8 max-w-2xl t-reading text-ink-2">Responda a questão e, depois, classifique cada alternativa errada: por que ela atrai? Extrapolação, redução, isca de palavra… A comparação com a revisão editorial só aparece depois da sua classificação.</p>
      <StartSkill skill="distrator" available={total} />
    </>
  );
}
