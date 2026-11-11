import type { Metadata } from "next";
import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { GroupForms } from "@/components/groups/group-forms";
import { ScreenHeader } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { loadMyGroups } from "@/lib/groups/data";

export const metadata: Metadata = { title: "Grupos" };
export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const groups = await loadMyGroups();
  if (!groups)
    return (
      <>
        <ScreenHeader title="Grupos" kicker="Estudar junto" />
        <EmptyState icon={Users} title="Estude com colegas" body="Grupos e duelos ficam na sua conta. Entre para começar." action={{ href: "/entrar", label: "Entrar" }} />
      </>
    );
  return (
    <>
      <ScreenHeader title="Grupos" kicker="Estudar junto" />
      <div className="flex flex-col gap-10">
        {groups.length > 0 && (
          <nav aria-label="Seus grupos">
            <ul className="flex flex-col border-t border-line-subtle">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/grupos/${g.id}`} className="group flex min-h-16 items-center justify-between gap-4 border-b border-line-subtle py-3 hover:bg-surface-subtle/60">
                    <span>
                      <span className="block font-display text-[24px] leading-tight text-ink">{g.name}</span>
                      <span className="block t-meta text-ink-2">
                        {g.members} {g.members === 1 ? "pessoa" : "pessoas"}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 text-ink-2 transition-transform duration-[var(--rs-dur-state)] group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <GroupForms />
        <p className="max-w-2xl t-meta text-ink-2">
          No grupo, os outros veem só o apelido que você escolher e, em cada duelo, quantas questões você respondeu e acertou.
          Nada do seu plano, das suas redações ou do seu histórico aparece.
        </p>
      </div>
    </>
  );
}
