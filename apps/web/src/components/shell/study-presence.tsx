"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pingStudy } from "@/lib/study/presence-actions";
import { PRESENCE, presenceKind, shouldPing } from "@/lib/study/presence";

/**
 * Tempo de estudo automático: nas páginas de estudo, avisa o servidor a cada 30 s enquanto a página está à vista
 * e a pessoa mexeu nela nos últimos 3 minutos. Não desenha nada.
 */
export function StudyPresence() {
  const pathname = usePathname();
  const kind = presenceKind(pathname);
  useEffect(() => {
    if (!kind) return;
    let lastInput = Date.now();
    const mark = () => {
      lastInput = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "input"] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true, capture: true });
    const tick = () => {
      if (shouldPing(Date.now(), lastInput, document.visibilityState === "visible")) void pingStudy(kind).catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, PRESENCE.everyMs);
    return () => {
      window.clearInterval(id);
      for (const e of events) window.removeEventListener(e, mark, { capture: true });
    };
  }, [kind]);
  return null;
}
