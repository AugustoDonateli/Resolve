import { z } from "zod";

/** Contrato das preferências (cliente ↔ servidor ↔ banco). */
export const prefsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  reduceMotion: z.boolean(),
  textScale: z.enum(["18", "20", "22"]),
});
export type PrefsInput = z.infer<typeof prefsSchema>;

export interface PrefsRow {
  theme: string;
  reduced_motion: boolean;
  text_scale: number;
}

export function rowToPrefs(row: PrefsRow): PrefsInput {
  const parsed = prefsSchema.safeParse({ theme: row.theme, reduceMotion: row.reduced_motion, textScale: String(row.text_scale) });
  return parsed.success ? parsed.data : { theme: "system", reduceMotion: false, textScale: "18" };
}

export function prefsToRow(p: PrefsInput): PrefsRow {
  return { theme: p.theme, reduced_motion: p.reduceMotion, text_scale: Number(p.textScale) };
}
