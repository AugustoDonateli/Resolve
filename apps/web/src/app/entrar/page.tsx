import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeskLamp } from "@/components/shell/desk-lamp";
import { Wordmark } from "@/components/ui/wordmark";
import { authEnabled, safeNext } from "@/lib/supabase/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Entrada: a mesa antes da prova. À esquerda, o caderno ainda fechado, com as "instruções" que
 * apresentam o Resolve; à direita, a ficha de identificação, que é o formulário. No celular fica só
 * a ficha, com a marca em cima.
 */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!authEnabled) redirect("/hoje");
  const sp = await searchParams;
  return (
    <main id="conteudo" className="desk relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <DeskLamp />
      <div className="relative flex w-full max-w-[1040px] flex-col items-center justify-center gap-10 md:flex-row md:items-center md:gap-14">
        {/* Capa do caderno (só no PC) */}
        <div
          aria-hidden="true"
          className="relative hidden aspect-[3/4] w-[min(42vw,440px)] shrink-0 flex-col justify-between bg-primary p-9 text-on-primary shadow-sheet md:flex"
          style={{ ["--r" as string]: "-3deg", transform: "rotate(-3deg)", animation: "desk-land 700ms var(--rs-ease-layout) both" }}
        >
          <span className="pointer-events-none absolute inset-4 border border-on-primary/50" />
          <p className="font-mono text-[11px] uppercase leading-5 tracking-[0.1em]">
            Caderno de questões
            <br />
            Preparação para o ENEM
          </p>
          <div>
            <Wordmark size={84} className="!text-on-primary" />
            <p className="mt-5 border-t border-on-primary/50 pt-4 font-mono text-[11px] uppercase tracking-[0.1em]">Leia atentamente as instruções seguintes</p>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 font-reading text-[17px] leading-6">
              <li>Um plano para hoje, feito dos seus horários livres.</li>
              <li>Questões oficiais do Enem, com a correção à caneta.</li>
              <li>Redação, revisão e um simulado inteiro no Dia D.</li>
            </ol>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em]">Aguarde a sua vez de abrir este caderno</p>
        </div>

        {/* Ficha de identificação */}
        <div
          className="relative w-full max-w-[420px] bg-background p-6 shadow-sheet sm:p-9"
          style={{ ["--r" as string]: "0.8deg", transform: "rotate(0.8deg)", animation: "desk-land 700ms 140ms var(--rs-ease-layout) both" }}
        >
          <div className="mb-6 flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-4">
            <div>
              <p className="t-kicker">Ficha de identificação</p>
              <h1 className="mt-1 t-screen">Entre para continuar de onde parou</h1>
            </div>
            <Wordmark size={22} className="mb-1 md:hidden" />
          </div>
          <SignInForm next={safeNext(sp.next)} />
        </div>
      </div>
    </main>
  );
}
