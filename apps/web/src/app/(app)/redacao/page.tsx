import type { Metadata } from "next";
import { Correction } from "@/components/essay/correction";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Redação" };

export default function RedacaoPage() {
  return (
    <>
      <ScreenHeader title="Redação" kicker="Correção por competência" />
      <Correction />
    </>
  );
}
