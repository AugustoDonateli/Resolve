import type { Metadata } from "next";
import { ScreenHeader } from "@/components/shell/app-shell";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "Componentes" };

export default function ComponentesPage() {
  return (
    <>
      <ScreenHeader title="Componentes" kicker="Estados dos controles essenciais" />
      <Gallery />
    </>
  );
}
