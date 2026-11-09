"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Preferências de leitura e movimento (T01, plano §2 e §6).
 * Até existir conta (F2-T01), ficam neste aparelho via localStorage.
 * Redução de movimento = preferência do sistema OU opção interna.
 */
export type ThemePref = "system" | "light" | "dark";
export type TextScale = "18" | "20" | "22";

export interface Prefs {
  theme: ThemePref;
  reduceMotion: boolean;
  textScale: TextScale;
}

export const PREFS_KEY = "resolve:prefs";
const DEFAULTS: Prefs = { theme: "system", reduceMotion: false, textScale: "18" };

interface PrefsContextValue extends Prefs {
  /** true quando sistema OU opção interna pedem redução. */
  reduced: boolean;
  set: (patch: Partial<Prefs>) => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

function readStored(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: p.theme === "light" || p.theme === "dark" ? p.theme : "system",
      reduceMotion: p.reduceMotion === true,
      textScale: p.textScale === "20" || p.textScale === "22" ? p.textScale : "18",
    };
  } catch {
    return DEFAULTS;
  }
}

export function applyPrefsToDocument(p: Prefs) {
  const el = document.documentElement;
  if (p.theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", p.theme);
  if (p.reduceMotion) el.setAttribute("data-motion", "reduced");
  else el.removeAttribute("data-motion");
  el.setAttribute("data-text-scale", p.textScale);
}

/** Script inline executado antes da pintura para evitar troca visível de tema. */
export const prefsBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY,
)})||"{}");var e=document.documentElement;if(p.theme==="light"||p.theme==="dark")e.setAttribute("data-theme",p.theme);if(p.reduceMotion===true)e.setAttribute("data-motion","reduced");e.setAttribute("data-text-scale",p.textScale==="20"||p.textScale==="22"?p.textScale:"18");}catch(_){}})();`;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const systemReduced = useReducedMotion() ?? false;

  useEffect(() => {
    // Sincroniza com o armazenamento local após a hidratação (fonte externa).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(readStored());
  }, []);

  // Modalidade de entrada: Radix foca abas por script no clique, o que o navegador
  // trata como :focus-visible. Com ponteiro, o anel das abas fica oculto; qualquer tecla o traz de volta.
  useEffect(() => {
    const el = document.documentElement;
    const pointer = () => el.setAttribute("data-modality", "pointer");
    const keyboard = () => el.setAttribute("data-modality", "keyboard");
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
    };
  }, []);

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível: preferência vale só nesta visita */
      }
      applyPrefsToDocument(next);
      return next;
    });
  }, []);

  const reduced = systemReduced || prefs.reduceMotion;
  const value = useMemo(() => ({ ...prefs, reduced, set }), [prefs, reduced, set]);

  return (
    <PrefsContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>{children}</MotionConfig>
    </PrefsContext.Provider>
  );
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs fora de PrefsProvider");
  return ctx;
}

/** Atalho para coreografias: devolve se o movimento deve ser reduzido. */
export function useReduced(): boolean {
  return usePrefs().reduced;
}
