import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EssayPhoto {
  path: string;
  url: string | null;
  createdAt: string | null;
}

/** Pasta das fotos de uma redação no armazenamento pessoal (primeiro segmento = id da conta). */
export const photoFolder = (userId: string, essayId: string) => `${userId}/redacao/${essayId}`;

/** Fotos da folha manuscrita de uma redação da própria conta, com link assinado de 1 hora. */
export async function loadEssayPhotos(essayId: string): Promise<EssayPhoto[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const folder = photoFolder(auth.user.id, essayId);
  const { data } = await supabase.storage.from("pessoal").list(folder, { sortBy: { column: "name", order: "asc" } });
  const files = (data ?? []).filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name));
  if (!files.length) return [];
  const { data: signed } = await supabase.storage.from("pessoal").createSignedUrls(files.map((f) => `${folder}/${f.name}`), 3600);
  return files.map((f, i) => ({ path: `${folder}/${f.name}`, url: signed?.[i]?.signedUrl ?? null, createdAt: f.created_at ?? null }));
}
