import { comandoEmLinguagens } from "./content/comando-em-linguagens";
import { leituraDeGraficos } from "./content/leitura-de-graficos";
import { porcentagem } from "./content/porcentagem";
import type { Lesson } from "./types";

/** Lições publicadas, na ordem do piloto (plano v2, 2A.4). */
export const LESSONS: Lesson[] = [porcentagem, leituraDeGraficos, comandoEmLinguagens];

export function lessonBySlug(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}
