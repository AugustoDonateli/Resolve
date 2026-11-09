import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Progresso" };

export default function ProgressoPage() {
  return (
    <>
      <ScreenHeader title="Progresso" />
      <EmptyState
        icon={BarChart3}
        title="Dados insuficientes"
        body="A constelação de habilidades só classifica um nó depois de oito tentativas sem ajuda, em cinco itens e dois dias diferentes."
        note="Protótipo da constelação: F1-T15. Mapa real: F4-T10 a F4-T12."
      />
    </>
  );
}
