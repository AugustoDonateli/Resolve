/**
 * CARTÕES DEMONSTRATIVOS — só para experimentar a revisão por gestos. Não entram na fila real.
 * Conteúdo escolar básico, sem fonte oficial do Resolve.
 */
import type { FeedCard } from "@/components/review/card-feed";

export const demoCards: FeedCard[] = [
  { id: "d1", kind: "formula", front: "Área do círculo de raio r", back: "A = π · r²", source: "cartão demonstrativo" },
  { id: "d2", kind: "conceito", front: "O que é tese numa redação dissertativo-argumentativa?", back: "A posição que o texto defende sobre o problema do tema; os argumentos existem para sustentá-la.", source: "cartão demonstrativo" },
  { id: "d3", kind: "formula", front: "Velocidade média", back: "v = Δs / Δt", source: "cartão demonstrativo" },
];
