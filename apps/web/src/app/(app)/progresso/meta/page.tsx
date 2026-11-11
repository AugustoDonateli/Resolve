import type { Metadata } from "next";
import { ChevronLeft, Target } from "lucide-react";
import Link from "next/link";
import { CourseGoals } from "@/components/goals/course-goals";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadCourseGoals } from "@/lib/goals/data";

export const metadata: Metadata = { title: "Meta de curso" };
export const dynamic = "force-dynamic";

export default async function MetaPage() {
  const goals = await loadCourseGoals();
  return (
    <>
      <Link href="/progresso" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden className="size-4" /> Progresso
      </Link>
      <ScreenHeader title="Meta de curso" kicker="Onde você quer chegar" />
      {goals ? (
        <>
          <p className="mb-8 max-w-2xl t-reading text-ink-2">
            O Resolve não traz notas de corte nem pesos: eles mudam a cada edição e por instituição. Informe os do curso que você quer,
            com a fonte, e simule a média ponderada com notas que você conhece.
          </p>
          <CourseGoals goals={goals} />
        </>
      ) : (
        <EmptyState icon={Target} title="Entre para definir sua meta" body="A meta de curso fica salva na sua conta." action={{ href: "/entrar", label: "Entrar" }} />
      )}
    </>
  );
}
