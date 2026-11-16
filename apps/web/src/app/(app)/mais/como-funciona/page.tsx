import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { TipBody } from "@/components/guide/first-time-tip";
import { RestartGuide } from "@/components/guide/guide-controls";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadGuide } from "@/lib/guide/data";
import { TIPS, type TipKey } from "@/lib/guide/types";

export const metadata: Metadata = { title: "Como funciona" };
export const dynamic = "force-dynamic";

/** As fichas da primeira vez, guardadas num lugar só, e o caminho para rever o tutorial. */
export default async function ComoFuncionaPage() {
  const state = await loadGuide();
  return (
    <>
      <Link href="/mais" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Mais
      </Link>
      <ScreenHeader title="Como funciona" kicker="As fichas da primeira vez" />
      <div className="flex max-w-[72ch] flex-col gap-10">
        <ul className="flex flex-col">
          {(Object.keys(TIPS) as TipKey[]).map((key) => (
            <li key={key} className="border-b border-line-subtle py-6 first:pt-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="t-section text-ink">{TIPS[key].title}</h2>
                <Link href={TIPS[key].href} className="t-meta text-link underline">
                  Abrir
                </Link>
              </div>
              <TipBody tip={key} />
            </li>
          ))}
        </ul>
        <section aria-labelledby="rever" className="flex flex-col gap-3">
          <h2 id="rever" className="t-section text-ink">
            Rever o tutorial
          </h2>
          {state ? (
            <>
              <p className="t-reading text-ink-2">
                Os primeiros passos voltam para a mesa (ficha, primeira questão e tour) e cada ficha acima aparece de novo na primeira visita. Suas respostas
                e seu histórico não mudam.
              </p>
              <RestartGuide />
            </>
          ) : (
            <p className="t-reading text-ink-2">O tutorial fica guardado na sua conta. Entre para rever.</p>
          )}
        </section>
      </div>
    </>
  );
}
