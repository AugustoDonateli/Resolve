import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { ReviewHome } from "@/components/review/review-home";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadReviewHome } from "@/lib/study/review";

export const metadata: Metadata = { title: "Revisar" };
export const dynamic = "force-dynamic";

export default async function RevisarPage({
  searchParams,
}: {
  searchParams: Promise<{ min?: string }>;
}) {
  const { min } = await searchParams;
  const minutes = [15, 30, 60].includes(Number(min)) ? Number(min) : 30;
  const home = await loadReviewHome(minutes);
  return (
    <>
      <ScreenHeader title="Revisar" />
      {home ? (
        <ReviewHome home={home} />
      ) : (
        <EmptyState
          icon={RotateCcw}
          title="Entre para revisar"
          body="Quando você errar uma questão, ela entra aqui com datas de revisão: 1, 3, 7, 14 e 30 dias."
          action={{ href: "/entrar", label: "Entrar" }}
        />
      )}
    </>
  );
}
