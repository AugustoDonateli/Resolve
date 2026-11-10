import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { SchedulePlanner } from "@/components/routine/schedule-planner";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadSchedule } from "@/lib/routine/schedule";

export const metadata: Metadata = { title: "Rotina" };
export const dynamic = "force-dynamic";

export default async function RotinaPage() {
  const data = await loadSchedule();
  return (
    <>
      <ScreenHeader title="Rotina e metas" />
      {data ? (
        <SchedulePlanner data={data} />
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="Planeje sua primeira semana"
          body="Horários livres e compromissos fixos ficam salvos na sua conta. Entre para começar."
          action={{ href: "/entrar", label: "Entrar" }}
        />
      )}
    </>
  );
}
