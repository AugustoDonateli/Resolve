import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { AccountSection } from "@/components/account/account-section";
import { PrefsForm } from "@/components/prefs/prefs-form";
import { ScreenHeader } from "@/components/shell/app-shell";
import { currentUserIsOwner } from "@/lib/club/data";
import { currentUserIsEditor } from "@/lib/editor/data";

export const metadata: Metadata = { title: "Mais" };

interface Item {
  href: string;
  label: string;
  desc: string;
}

/** Só o que não está na navegação principal. Três grupos; o do editor aparece só para quem é editor. */
const TOGETHER: Item[] = [{ href: "/grupos", label: "Grupos e duelos", desc: "Estudar com colegas: as mesmas questões, cada um no seu tempo" }];
const ACCOUNT: Item[] = [{ href: "/mais/conta", label: "Conta e dados", desc: "Cota de inteligência artificial, termos, baixar seus dados e excluir a conta" }];
const OWNER: Item[] = [{ href: "/mais/clube", label: "Clube", desc: "Convidar pessoas, ver as contas, suspender ou remover" }];
const HELP: Item[] = [
  { href: "/mais/como-funciona", label: "Como funciona", desc: "Triagem, ritmo, Dia D e duelo em uma ficha cada; rever o tutorial" },
  { href: "/mais/ficha", label: "Ficha de identificação", desc: "Curso, horas por semana, língua estrangeira e data da prova" },
];
const EDITOR: Item[] = [
  { href: "/editor/anotacoes", label: "Conferência das anotações", desc: "Aprovar, ajustar ou devolver a anotação de cada questão" },
  { href: "/editor", label: "Revisão editorial", desc: "Propostas extraídas dos PDFs, dúvidas e histórico" },
  { href: "/componentes", label: "Componentes", desc: "Estados de botões, campos e alternativas" },
  { href: "/prototipos", label: "Protótipos de movimento", desc: "Cenas em estudo, fora do caminho do aluno" },
];

function Group({ id, title, items }: { id: string; title: string; items: Item[] }) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="mb-1 t-kicker">
        {title}
      </h2>
      <ul className="flex flex-col border-t border-line-subtle">
        {items.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group flex min-h-16 items-center gap-3 border-b border-line-subtle py-3 hover:bg-surface-subtle/60">
              <span className="flex-1">
                <span className="block t-ui text-ink">{l.label}</span>
                <span className="block t-meta text-ink-2">{l.desc}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 text-ink-2 transition-transform duration-[var(--rs-dur-state)] group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function MaisPage() {
  const [editor, owner] = await Promise.all([currentUserIsEditor(), currentUserIsOwner()]);
  return (
    <>
      <ScreenHeader title="Mais" kicker="Conta, ajuda e o que não está nas abas" />
      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        <div className="flex flex-col gap-10">
          <Group id="mais-junto" title="Estudar junto" items={TOGETHER} />
          <Group id="mais-ajuda" title="Ajuda" items={HELP} />
          <Group id="mais-conta" title="Sua conta" items={ACCOUNT} />
          {owner && <Group id="mais-dono" title="Dono do clube" items={OWNER} />}
          {editor && <Group id="mais-editor" title="Editor" items={EDITOR} />}
        </div>
        <div className="flex flex-col gap-8">
          <AccountSection />
          <section aria-labelledby="prefs-title" className="rounded-panel border border-line-subtle bg-surface p-5 sm:p-6">
            <h2 id="prefs-title" className="mb-1 t-section">
              Preferências
            </h2>
            <p className="mb-5 t-meta text-ink-2">Com a conta conectada, ficam salvas nela; em modo local, só neste aparelho.</p>
            <PrefsForm />
          </section>
        </div>
      </div>
    </>
  );
}
