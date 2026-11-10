import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { DemoFeed } from "@/components/review/demo-feed";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Revisão por cartões" };

export default function Page() {
  return (
    <>
      <Link href="/revisar" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Revisar
      </Link>
      <ScreenHeader title="Revisão por cartões" kicker="Demonstração" />
      <p className="mb-8 max-w-xl t-reading text-ink-2">
        Os cartões reais de conceitos e fórmulas entram na sua fila a partir dos erros e são revisados aqui, um por vez, até acabar. Nada desta
        demonstração é gravado.
      </p>
      <DemoFeed />
    </>
  );
}
