import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Revisar" };

export default function RevisarPage() {
  return (
    <>
      <ScreenHeader title="Revisar" />
      <EmptyState
        icon={RotateCcw}
        title="Nenhuma revisão ainda"
        body="Quando você errar uma questão, ela entra aqui com datas de revisão: 1, 3, 7, 14 e 30 dias."
        note="Fila de revisão: F3-T06 a F3-T08, depois do banco revisado (F2)."
        action={{ href: "/estudar", label: "Resolver uma questão" }}
      />
    </>
  );
}
