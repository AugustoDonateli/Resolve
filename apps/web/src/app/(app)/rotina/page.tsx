import type { Metadata } from "next";
import { ArrowRight, CalendarRange } from "lucide-react";
import Link from "next/link";
import { GoalsPanel } from "@/components/routine/goals-panel";
import { SchedulePlanner } from "@/components/routine/schedule-planner";
import { StreakCard } from "@/components/routine/streak-card";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadGoals } from "@/lib/routine/goals";
import { loadSchedule } from "@/lib/routine/schedule";
import { loadStreak } from "@/lib/routine/streak";

export const metadata: Metadata = { title: "Rotina" };
export const dynamic = "force-dynamic";

/**
 * Rotina: planejar a semana (horários, metas, planos se-então e sequência).
 * O dia em si — plano, foco e agenda — fica em Hoje.
 */
export default async function RotinaPage() {
  const [data, goals, streak] = await Promise.all([
    loadSchedule(),
    loadGoals(),
    loadStreak(),
  ]);
  return (
    <>
      <ScreenHeader title="Rotina e metas" kicker="Planejar a semana">
        {data && (
          <Link
            href="/hoje"
            className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 t-ui text-link hover:bg-surface-subtle"
          >
            Plano de hoje <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </ScreenHeader>
      {data && goals ? (
        <div className="flex flex-col gap-16">
          <div id="semana" className="scroll-mt-24">
            <SchedulePlanner data={data} />
          </div>
          <div className="border-t border-line-subtle pt-10">
            <GoalsPanel goals={goals.goals} plans={goals.plans} />
          </div>
          {streak && (
            <div className="border-t border-line-subtle pt-10">
              <StreakCard s={streak} />
            </div>
          )}
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
