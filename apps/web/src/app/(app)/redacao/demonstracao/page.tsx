import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Correction } from "@/components/essay/correction";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Correção demonstrativa" };

export default function Page() {
  return (
    <>
      <Link href="/redacao" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Redação
      </Link>
      <ScreenHeader title="Correção demonstrativa" kicker="Como a correção por competência aparece" />
      <Correction />
    </>
  );
}
