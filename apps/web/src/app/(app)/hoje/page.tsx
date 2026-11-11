import type { Metadata } from "next";
import { Sun } from "lucide-react";
import { Today } from "@/components/routine/today";
import { DailyQuestion } from "@/components/today/daily-question";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadGoals } from "@/lib/routine/goals";
import { loadDayPlan } from "@/lib/routine/plan";
import { loadStreak } from "@/lib/routine/streak";
import { loadDailyQuestion } from "@/lib/study/daily";

export const metadata: Metadata = { title: "Hoje" };
export const dynamic = "force-dynamic";

export default async function HojePage() {
  const [plan, goals, streak] = await Promise.all([
    loadDayPlan(),
    loadGoals(),
    loadStreak(),
  ]);
  if (!plan)
    return (
      <>
        <ScreenHeader title="Hoje" />
        <EmptyState
          icon={Sun}
          title="Seu dia de estudo começa aqui"
          body="O plano do dia, o foco e a agenda ficam salvos na sua conta. Entre para começar."
          action={{ href: "/entrar", label: "Entrar" }}
        />
      </>
    );
  const ifThen =
    goals?.plans.find((p) => p.archived_at === null) ?? null;
  const daily = await loadDailyQuestion(plan.today);
  return <Today plan={plan} ifThen={ifThen} streak={streak} daily={<DailyQuestion q={daily} today={plan.today} />} />;
}
