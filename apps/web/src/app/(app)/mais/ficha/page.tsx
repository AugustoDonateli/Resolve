import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { FichaEditor } from "@/components/guide/guide-controls";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadFicha } from "@/lib/guide/data";

export const metadata: Metadata = { title: "Ficha de identificação" };
export const dynamic = "force-dynamic";

export default async function FichaPage() {
  const ficha = await loadFicha();
  return (
    <>
      <Link href="/mais" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Mais
      </Link>
      <ScreenHeader title="Ficha de identificação" kicker="Curso, horas, língua e data da prova" />
      <div className="max-w-[60ch]">
        {ficha ? <FichaEditor defaults={ficha} /> : <p className="t-reading text-ink-2">A ficha fica guardada na sua conta. Entre para preencher.</p>}
      </div>
    </>
  );
}
