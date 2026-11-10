import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { StartTraining } from "@/components/question/start-training";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { publishedByArea } from "@/lib/study/session";

export const metadata: Metadata = { title: "Estudar" };
export const dynamic = "force-dynamic";

export default async function EstudarPage() {
  const counts = await publishedByArea();
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <ScreenHeader title="Estudar" kicker="Treino livre" />
      {total > 0 ? (
        <div className="flex flex-col gap-6">
          <StartTraining counts={counts!} />
          <p className="t-meta text-ink-2">
            Só questões reais do Enem, conferidas e publicadas.{" "}
            <Link href="/estudar/banco" className="underline">
              Escolher no banco, com filtros
            </Link>{" "}
            ·{" "}
            <Link href="/estudar/demonstracao" className="underline">
              Ver a questão demonstrativa
            </Link>
            .
          </p>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Ainda não há questões publicadas"
          body="O treino usa só questões reais do Enem conferidas uma a uma. Enquanto o primeiro lote é revisado, dá para conhecer a tela com uma questão demonstrativa."
          note="Nenhuma questão inventada entra no banco de estudo."
          action={{
            href: "/estudar/demonstracao",
            label: "Ver questão demonstrativa",
          }}
        />
      )}
    </>
  );
}
