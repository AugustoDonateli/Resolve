import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { DayPlanPanel } from "@/components/routine/day-plan";
import { GoalsPanel } from "@/components/routine/goals-panel";
import { SchedulePlanner } from "@/components/routine/schedule-planner";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadGoals } from "@/lib/routine/goals";
import { loadDayPlan } from "@/lib/routine/plan";
import { loadSchedule } from "@/lib/routine/schedule";

export const metadata: Metadata = { title: "Rotina" };
export const dynamic = "force-dynamic";

export default async function RotinaPage() {
  const [data, goals, plan] = await Promise.all([
    loadSchedule(),
    loadGoals(),
    loadDayPlan(),
  ]);
  return (
    <>
      <ScreenHeader title="Rotina e metas" />
      {data && goals && plan ? (
        <div className="flex flex-col gap-12">
          <DayPlanPanel plan={plan} />
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
