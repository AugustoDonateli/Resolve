"use client";

import { clsx } from "clsx";
import { BarChart3, BookOpen, CalendarRange, Menu, PenLine, RotateCcw, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DeskLamp } from "@/components/shell/desk-lamp";
import { Wordmark } from "@/components/ui/wordmark";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Sun;
  mobile: boolean;
}

/** Celular: Hoje, Estudar, Revisar, Redação e Mais. No PC, as sete divisórias ficam sempre à vista. */
const NAV: NavItem[] = [
  { href: "/hoje", label: "Hoje", icon: Sun, mobile: true },
  { href: "/estudar", label: "Estudar", icon: BookOpen, mobile: true },
  { href: "/revisar", label: "Revisar", icon: RotateCcw, mobile: true },
  { href: "/redacao", label: "Redação", icon: PenLine, mobile: true },
  { href: "/rotina", label: "Rotina", icon: CalendarRange, mobile: false },
  { href: "/progresso", label: "Progresso", icon: BarChart3, mobile: false },
  { href: "/mais", label: "Mais", icon: Menu, mobile: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/mais") return ["/mais", "/componentes", "/prototipos", "/editor", "/grupos", "/diagnostico"].some((p) => pathname.startsWith(p));
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Como a folha de cada seção chega à mesa (as animações estão em globals.css). */
const ARRIVAL: Record<string, string> = {
  estudar: "caderno",
  revisar: "ficha",
  redacao: "folha",
  rotina: "agenda",
  progresso: "regua",
};
let lastSection: string | null = null;

/**
 * A folha de cima da mesa. É remontada a cada troca de página (chave = caminho): a folha nova chega
 * por cima da pilha com a animação da sua seção. A chegada dura menos de 700 ms, não bloqueia cliques
 * e, com movimento reduzido, vira um esmaecer de 100 ms.
 */
function Sheet({ pathname, children }: { pathname: string; children: ReactNode }) {
  const section = pathname.split("/")[1] ?? "";
  const [kind] = useState(() => (lastSection === null ? "inicio" : lastSection === section ? "pagina" : (ARRIVAL[section] ?? "inicio")));
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const first = lastSection === null;
    lastSection = section;
    // Preserva o foco ao navegar: leva o foco ao título da nova tela.
    if (!first) (ref.current?.querySelector<HTMLElement>("h1") ?? ref.current)?.focus({ preventScroll: true });
  }, [section]);
  // Hoje é a própria mesa: a página põe a folha do dia e os objetos; aqui não há folha única.
  if (pathname === "/hoje")
    return (
      <main id="conteudo" ref={ref} tabIndex={-1} className="w-full pb-24 outline-none md:pb-4">
        {children}
      </main>
    );
  return (
    <>
      <div className="pile hidden md:block" aria-hidden="true" />
      <main
        id="conteudo"
        ref={ref}
        tabIndex={-1}
        className={clsx(
          "sheet sheet-punched arrive min-h-[calc(100dvh-7.5rem)] w-full px-4 pb-28 pt-6 outline-none sm:px-6 md:min-h-[calc(100dvh-3rem)] md:pb-16 md:pl-14 md:pr-12 md:pt-11",
          `arrive-${kind}`,
        )}
      >
        {children}
      </main>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="desk min-h-dvh">
      <DeskLamp />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-paper"
      >
        Ir para o conteúdo
      </a>

      {/* PC: divisórias de fichário saindo por baixo da folha */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[196px] flex-col pb-6 pt-7 md:flex">
        <Link href="/hoje" className="mb-9 ml-7 self-start rounded-control py-1">
          <Wordmark size={32} tone="desk" />
        </Link>
        <nav aria-label="Principal">
          <ul className="flex flex-col items-end gap-1.5">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className={clsx("w-[170px]", item.href === "/mais" && "mt-5")}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className="index-tab t-ui">
                    <Icon aria-hidden="true" className="size-[17px] shrink-0" strokeWidth={2} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="mt-auto pl-7 font-mono text-[10.5px] uppercase leading-4 tracking-[0.1em] text-on-desk-2">
          Preparação
          <br />
          para o ENEM
        </p>
      </aside>

      {/* Celular: marca sobre a mesa */}
      <header className="sticky top-0 z-20 flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center bg-desk px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Link href="/hoje" className="-mx-2 flex min-h-11 items-center rounded-control px-2">
          <Wordmark size={25} tone="desk" />
        </Link>
      </header>

      <div className="relative z-20 md:py-6 md:pl-[196px] md:pr-6">
        <div className="relative mx-auto w-full max-w-[1240px] [perspective:2200px]">
          <Sheet key={pathname} pathname={pathname}>
            {children}
          </Sheet>
        </div>
      </div>

      {/* Celular: cinco divisórias na borda de baixo */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 bg-desk pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5 gap-1 px-1.5 pt-1.5">
          {NAV.filter((n) => n.mobile).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex h-[3.4rem] flex-col items-center justify-center gap-0.5 rounded-t-[7px] text-[12px] font-medium leading-4 transition-[background-color,color,transform] duration-[var(--rs-dur-state)]",
                    active ? "bg-background text-ink" : "translate-y-1 text-on-desk-2",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Cabeçalho de tela: título focável para preservar foco ao navegar. */
export function ScreenHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b-[1.5px] border-ink pb-5 md:mb-10 md:pb-6">
      <div className="min-w-0">
        {kicker && <p className="mb-2 t-kicker">{kicker}</p>}
        <h1 tabIndex={-1} className="t-title text-ink outline-none">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
