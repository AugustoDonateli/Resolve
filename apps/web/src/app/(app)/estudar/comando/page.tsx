import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { StartSkill } from "@/components/skills/start-skill";
import { ScreenHeader } from "@/components/shell/app-shell";
import { publishedByArea } from "@/lib/study/session";

export const metadata: Metadata = { title: "Comando primeiro" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const counts = await publishedByArea();
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <Link href="/estudar" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Estudar
      </Link>
      <ScreenHeader title="Comando primeiro" kicker="Treino de leitura" />
      <p className="mb-8 max-w-2xl t-reading text-ink-2">Leia o comando antes do texto, decida o que procurar, libere o texto e marque o trecho que responde. Depois responda. Acerto e evidência são medidas separadas: dá para acertar sem ter encontrado a evidência, e o contrário.</p>
      <StartSkill skill="comando" available={total} />
    </>
  );
}
