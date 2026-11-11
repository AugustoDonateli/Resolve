import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { AccountSection } from "@/components/account/account-section";
import { PrefsForm } from "@/components/prefs/prefs-form";
import { ScreenHeader } from "@/components/shell/app-shell";
import { currentUserIsEditor } from "@/lib/editor/data";

export const metadata: Metadata = { title: "Mais" };

const LINKS = [
  { href: "/rotina", label: "Rotina e metas", desc: "Semana, compromissos e planos se-então" },
  { href: "/grupos", label: "Grupos e duelos", desc: "Estudar com colegas: as mesmas questões, cada um no seu tempo" },
  { href: "/progresso", label: "Progresso", desc: "Constelação de habilidades" },
  { href: "/prototipos", label: "Protótipos de movimento", desc: "Passagem, envelope e replay (F1)" },
  { href: "/componentes", label: "Componentes", desc: "Estados de botões, campos e alternativas" },
];

export default async function MaisPage() {
  const editor = await currentUserIsEditor();
  const links = editor ? [{ href: "/editor", label: "Revisão editorial", desc: "Propostas extraídas dos PDFs, dúvidas e histórico" }, ...LINKS] : LINKS;
  return (
    <>
      <ScreenHeader title="Mais" />
      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="prefs-title" className="rounded-panel border border-line-subtle bg-surface p-5 sm:p-6">
          <h2 id="prefs-title" className="mb-1 t-section">
            Preferências
          </h2>
          <p className="mb-5 t-meta text-ink-2">Com a conta conectada, ficam salvas nela; em modo local, só neste aparelho.</p>
          <PrefsForm />
        </section>
        <div className="flex flex-col gap-6">
        <AccountSection />
        <nav aria-label="Outras áreas">
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-16 items-center gap-3 rounded-card border border-line-subtle bg-surface px-4 py-3 transition-colors duration-[var(--rs-dur-state)] hover:border-line">
                  <span className="flex-1">
                    <span className="block t-ui">{l.label}</span>
                    <span className="block t-meta text-ink-2">{l.desc}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 text-ink-2" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        </div>
      </div>
    </>
  );
}
