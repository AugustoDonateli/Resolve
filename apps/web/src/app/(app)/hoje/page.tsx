import type { Metadata } from "next";
import { Sun } from "lucide-react";
import { FirstSteps } from "@/components/guide/first-steps";
import { Today } from "@/components/routine/today";
import { DailyQuestion } from "@/components/today/daily-question";
import { DeskObjects } from "@/components/today/desk-objects";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadFicha, loadGuide } from "@/lib/guide/data";
import { currentStep } from "@/lib/guide/types";
import { loadGoals } from "@/lib/routine/goals";
import { loadDayPlan } from "@/lib/routine/plan";
import { loadStreak } from "@/lib/routine/streak";
import { loadDailyQuestion } from "@/lib/study/daily";
import { loadDeskCounts } from "@/lib/today/desk";

export const metadata: Metadata = { title: "Hoje" };
export const dynamic = "force-dynamic";

export default async function HojePage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const [plan, goals, streak, guide, { tour }] = await Promise.all([
    loadDayPlan(),
    loadGoals(),
    loadStreak(),
    loadGuide(),
    searchParams,
  ]);
  if (!plan)
    return (
      <div className="sheet min-h-[60dvh] px-4 pb-16 pt-6 sm:px-6 md:pl-14 md:pr-12 md:pt-11">
        <ScreenHeader title="Hoje" />
        <EmptyState
          icon={Sun}
          title="Seu dia de estudo começa aqui"
          body="O plano do dia, o foco e a agenda ficam salvos na sua conta. Entre para começar."
          action={{ href: "/entrar", label: "Entrar" }}
        />
      </div>
    );
  const ifThen =
    goals?.plans.find((p) => p.archived_at === null) ?? null;
  const step = guide ? currentStep(guide.guide) : null;
  const [daily, counts, ficha] = await Promise.all([
    loadDailyQuestion(plan.today),
    loadDeskCounts(),
    step === "ficha" ? loadFicha() : Promise.resolve(null),
  ]);
  const autoTour = tour === "1";
  return (
    <Today
      plan={plan}
      ifThen={ifThen}
      streak={streak}
      guide={guide && (step || autoTour) ? <FirstSteps guide={guide.guide} ficha={ficha} autoTour={autoTour} /> : undefined}
      daily={<DailyQuestion q={daily} today={plan.today} />}
      desk={<DeskObjects counts={counts} />}
    />
  );
}
