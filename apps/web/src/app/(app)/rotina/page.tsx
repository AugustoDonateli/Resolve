import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { DayPlanPanel } from "@/components/routine/day-plan";
import { GoalsPanel } from "@/components/routine/goals-panel";
import { SchedulePlanner } from "@/components/routine/schedule-planner";
import { StreakCard } from "@/components/routine/streak-card";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadGoals } from "@/lib/routine/goals";
import { loadDayPlan } from "@/lib/routine/plan";
import { loadSchedule } from "@/lib/routine/schedule";
import { loadStreak } from "@/lib/routine/streak";

export const metadata: Metadata = { title: "Rotina" };
export const dynamic = "force-dynamic";

export default async function RotinaPage() {
  const [data, goals, plan, streak] = await Promise.all([
    loadSchedule(),
    loadGoals(),
    loadDayPlan(),
    loadStreak(),
  ]);
  return (
    <>
      <ScreenHeader title="Rotina e metas" />
      {data && goals && plan ? (
        <div className="flex flex-col gap-12">
          <DayPlanPanel plan={plan} />
          {streak && <StreakCard s={streak} />}
          <SchedulePlanner data={data} />
          <GoalsPanel goals={goals.goals} plans={goals.plans} />
        </div>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="Planeje sua primeira semana"
          body="Horários livres, compromissos fixos, metas e planos se-então ficam salvos na sua conta. Entre para começar."
          action={{ href: "/entrar", label: "Entrar" }}
        />
      )}
    </>
  );
}
