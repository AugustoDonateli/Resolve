"use client";

import { clsx } from "clsx";
import { BarChart3, BookOpen, CalendarRange, Menu, PenLine, RotateCcw, Sun } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { duration, ease } from "@resolve/ui/motion";
import { useReduced } from "@/components/prefs/prefs";
import { Wordmark } from "@/components/ui/wordmark";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Sun;
  mobile: boolean;
}

/** Celular: Hoje, Estudar, Revisar, Redação e Mais (plano §6, navegação). */
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
  if (href === "/mais") return ["/mais", "/componentes", "/prototipos"].some((p) => pathname.startsWith(p));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReduced();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Preserva o foco ao navegar: leva o foco ao conteúdo principal da nova tela.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h1 = mainRef.current?.querySelector<HTMLElement>("h1");
    (h1 ?? mainRef.current)?.focus({ preventScroll: false });
  }, [pathname]);

  const indicator = { type: "tween" as const, duration: reduced ? 0 : duration.state / 1000, ease: ease.state };

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-paper"
      >
        Ir para o conteúdo
      </a>

      {/* PC: lateral de 216 px */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[216px] flex-col border-r border-line-subtle bg-background px-3 pb-6 pt-6 md:flex">
        <Link href="/hoje" className="mb-8 self-start rounded-control px-3 py-1">
          <Wordmark size={30} />
        </Link>
        <LayoutGroup id="nav-desktop">
          <nav aria-label="Principal">
            <ul className="flex flex-col gap-0.5">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href} className={clsx(item.href === "/mais" && "mt-4")}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "relative flex min-h-11 items-center gap-3 rounded-control px-3 t-ui transition-colors duration-[var(--rs-dur-state)]",
                        active ? "text-ink" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-indicator"
                          transition={indicator}
                          className="absolute inset-0 rounded-control bg-surface shadow-paper"
                          aria-hidden="true"
                        >
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
                        </motion.span>
                      )}
                      <Icon aria-hidden="true" className="relative size-[18px]" strokeWidth={2} />
                      <span className="relative">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </LayoutGroup>
        <p className="mt-auto px-3 t-meta text-ink-2">Preparação para o ENEM</p>
      </aside>

      {/* Celular: cabeçalho com marca */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line-subtle bg-background/95 px-4 backdrop-blur md:hidden">
        <Link href="/hoje" className="rounded-control">
          <Wordmark size={24} />
        </Link>
      </header>

      <div className="md:pl-[216px]">
        <main
          id="conteudo"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 outline-none sm:px-6 md:px-8 md:pb-16 md:pt-10"
        >
          {children}
        </main>
      </div>

      {/* Celular: cinco destinos */}
      <LayoutGroup id="nav-mobile">
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {NAV.filter((n) => n.mobile).map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium leading-4",
                      active ? "text-ink" : "text-ink-2",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-mobile-indicator"
                        transition={indicator}
                        aria-hidden="true"
                        className="absolute top-0 h-[3px] w-10 rounded-b-full bg-primary"
                      />
                    )}
                    <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 2} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </LayoutGroup>
    </div>
  );
}

/** Cabeçalho de tela: título focável para preservar foco ao navegar. */
export function ScreenHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div>
        {kicker && <p className="mb-1 t-meta text-ink-2">{kicker}</p>}
        <h1 tabIndex={-1} className="t-screen text-ink outline-none">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
