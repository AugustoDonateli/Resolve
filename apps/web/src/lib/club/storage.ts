import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Todos os arquivos de uma pasta do armazenamento pessoal, descendo nas subpastas. */
export async function listPersonalFiles(supabase: Client, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  const { data, error } = await supabase.storage.from("pessoal").list(prefix, { limit: 1000 });
  if (error) throw new Error(`arquivos: ${error.message}`);
  const out: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    // Pastas vêm sem id; arquivos, com.
    if (item.id === null) out.push(...(await listPersonalFiles(supabase, path, depth + 1)));
    else out.push(path);
  }
  return out;
}

/** Apaga todos os arquivos pessoais sob o prefixo (pasta da conta). Devolve quantos apagou. */
export async function removePersonalFiles(supabase: Client, prefix: string): Promise<number> {
  const files = await listPersonalFiles(supabase, prefix);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from("pessoal").remove(files.slice(i, i + 100));
    if (error) throw new Error(`arquivos: ${error.message}`);
  }
  return files.length;
}
