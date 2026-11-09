import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Rotina" };

export default function RotinaPage() {
  return (
    <>
      <ScreenHeader title="Rotina e metas" />
      <EmptyState
        icon={CalendarRange}
        title="Planeje sua primeira semana"
        body="Horários livres, compromissos fixos, metas e planos se-então ficam aqui. O protótipo do dia já funciona em Hoje."
        note="Semana completa: F4-T13 a F4-T16."
        action={{ href: "/hoje", label: "Ver o dia em Hoje" }}
      />
    </>
  );
}
