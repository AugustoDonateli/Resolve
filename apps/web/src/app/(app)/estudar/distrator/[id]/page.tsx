import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { RealSkill } from "@/components/skills/real-skill";
import { DemoSkill } from "@/components/skills/demo-skill";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadSession } from "@/lib/study/session";
import { loadTaxonomy } from "@/lib/study/taxonomy";

export const metadata: Metadata = { title: "Caça ao distrator" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taxonomy = await loadTaxonomy();
  const demo = id === "demonstracao";
  const session = demo ? null : await loadSession(id);
  return (
    <>
      <Link href="/estudar/distrator" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Caça ao distrator
      </Link>
      <ScreenHeader title="Caça ao distrator" kicker={demo ? "Demonstração" : "Treino de habilidade"} />
      {demo ? <DemoSkill skill="distrator" taxonomy={taxonomy} /> : <RealSkill skill="distrator" session={session!} taxonomy={taxonomy} />}
    </>
  );
}
