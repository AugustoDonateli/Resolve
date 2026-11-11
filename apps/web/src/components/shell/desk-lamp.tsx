"use client";

import { useEffect, useRef } from "react";
import { useReduced } from "@/components/prefs/prefs";

/**
 * Luminária da mesa: uma luz morna que acompanha o cursor com atraso. Só com mouse e com movimento
 * ligado; sem isso fica parada no canto de cima. Não cobre nada clicável.
 */
export function DeskLamp() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let lx = 34, ly = 18, tx = 34, ty = 18, raf = 0;
    const tick = () => {
      lx += (tx - lx) * 0.06;
      ly += (ty - ly) * 0.06;
      el.style.setProperty("--lx", `${lx.toFixed(2)}%`);
      el.style.setProperty("--ly", `${ly.toFixed(2)}%`);
      raf = Math.abs(tx - lx) + Math.abs(ty - ly) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 100;
      ty = (e.clientY / window.innerHeight) * 100;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);
  return <div ref={ref} className="desk-lamp" aria-hidden="true" />;
}
