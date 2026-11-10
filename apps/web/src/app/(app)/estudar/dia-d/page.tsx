import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { ExamCatalog } from "@/components/dia-d/exam-catalog";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadCatalog } from "@/lib/dia-d/data";
import { authEnabled } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Dia D" };
export const dynamic = "force-dynamic";

export default async function DiaDPage() {
  const catalog = await loadCatalog();
  return (
    <>
      <ScreenHeader title="Dia D" kicker="Simulado completo" />
      {catalog ? <ExamCatalog catalog={catalog} /> : (
        <EmptyState icon={ClipboardList} title="Simulado indisponível"
          body={authEnabled ? "O catálogo do Dia D não pôde ser carregado. Tente novamente em instantes." : "O Dia D precisa de uma conta conectada para guardar o cartão e o prazo da prova."}
          action={{ href: "/estudar", label: "Voltar para Estudar" }}
        />
      )}
    </>
  );
}
