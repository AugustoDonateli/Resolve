import type { Metadata } from "next";
import { Constellation } from "@/components/progress/constellation";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Constelação" };

export default function ConstelacaoPage() {
  return (
    <>
      <ScreenHeader title="Constelação como evidência" kicker="Protótipo F1-T15 · M05 · teste R0-P03" />
      <Constellation />
    </>
  );
}
