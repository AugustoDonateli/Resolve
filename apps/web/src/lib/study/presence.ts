/** Em que tipo de estudo está cada página (para o tempo automático). Fora destas páginas, o tempo não conta. */
export type PresenceKind = "questoes" | "revisao" | "redacao" | "simulado" | "diagnostico";

export function presenceKind(pathname: string): PresenceKind | null {
  if (pathname.startsWith("/estudar/dia-d/")) return "simulado";
  if (pathname.startsWith("/estudar/")) return "questoes";
  if (pathname === "/revisar" || pathname.startsWith("/revisar/")) return "revisao";
  if (pathname.startsWith("/redacao/")) return "redacao";
  if (pathname === "/diagnostico" || pathname.startsWith("/diagnostico/")) return "diagnostico";
  return null;
}

/** Regra tempo-v2 no navegador: avisa a cada 30 s, só com a página à vista e alguma ação nos últimos 3 minutos. */
export const PRESENCE = { everyMs: 30_000, idleMs: 180_000 } as const;

export function shouldPing(now: number, lastInput: number, visible: boolean): boolean {
  return visible && now - lastInput < PRESENCE.idleMs;
}
