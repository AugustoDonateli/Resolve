import type { Metadata } from "next";
import Link from "next/link";
import { DeskLamp } from "@/components/shell/desk-lamp";
import { Wordmark } from "@/components/ui/wordmark";
import { TERMS, TERMS_VERSION } from "@/lib/club/terms";

export const metadata: Metadata = { title: "Termos e privacidade" };

const fmt = (v: string) => v.split("-").reverse().join("/");

/** Termos e privacidade, abertos a qualquer pessoa (inclusive antes de criar a conta). */
export default function TermosPage() {
  return (
    <main id="conteudo" className="desk relative min-h-dvh px-4 py-10">
      <DeskLamp />
      <article className="relative mx-auto max-w-[72ch] bg-background p-6 shadow-sheet sm:p-10">
        <div className="mb-8 flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
          <div>
            <p className="t-kicker">Versão de {fmt(TERMS_VERSION)}</p>
            <h1 className="mt-1 t-title">Termos e privacidade</h1>
          </div>
          <Wordmark size={24} className="mb-1" />
        </div>
        <p className="mb-8 t-reading text-ink-2">O que o Resolve guarda, quem vê o quê e como sair. Em poucas linhas, sem letra miúda.</p>
        <div className="flex flex-col gap-8">
          {TERMS.map((s) => (
            <section key={s.title}>
              <h2 className="mb-2 t-section">{s.title}</h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 t-reading text-ink marker:text-ink-2">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-line-subtle pt-5 t-meta text-ink-2">
          Dúvidas: fale com quem convidou você para o Resolve.{" "}
          <Link href="/entrar" className="text-link underline">
            Voltar para Entrar
          </Link>
        </p>
      </article>
    </main>
  );
}
