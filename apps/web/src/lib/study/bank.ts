/**
 * Banco e filtros (F3-T10): só itens publicados chegam aqui (vista `study_items`, política do banco).
 * Filtros por área, habilidade aprovada, assunto aprovado e origem (edição e dia do Enem). Quando a
 * combinação não retorna nada, `recoveries` sugere qual filtro tirar para voltar a ter questões.
 */
export interface BankItem {
  itemVersionId: string;
  area: "LC" | "CH" | "CN" | "MT";
  skills: string[];
  subjects: { id: string; name: string }[];
  origins: { year?: number; day: number; booklet: number; color: string; position: number }[];
  preview: string;
}

export interface BankFilters {
  area?: string;
  skill?: string;
  subject?: string;
  /** Ano da edição do Enem ("2025"). */
  year?: string;
  /** "d1" ou "d2" (dia de prova). */
  day?: string;
}

export const FILTER_LABEL: Record<keyof BankFilters, string> = {
  area: "área",
  skill: "habilidade",
  subject: "assunto",
  year: "edição",
  day: "dia de prova",
};

export function matches(item: BankItem, f: BankFilters): boolean {
  if (f.area && item.area !== f.area) return false;
  if (f.skill && !item.skills.includes(f.skill)) return false;
  if (f.subject && !item.subjects.some((s) => s.id === f.subject)) return false;
  if (f.year && !item.origins.some((o) => String(o.year) === f.year)) return false;
  if (f.day && !item.origins.some((o) => `d${o.day}` === f.day)) return false;
  return true;
}

export function filterBank(items: BankItem[], f: BankFilters): BankItem[] {
  return items.filter((i) => matches(i, f));
}

/** Filtros ativos que, retirados sozinhos, devolvem questões (com a contagem). */
export function recoveries(
  items: BankItem[],
  f: BankFilters,
): { drop: keyof BankFilters; count: number }[] {
  const active = (Object.keys(f) as (keyof BankFilters)[]).filter((k) => f[k]);
  return active
    .map((k) => ({
      drop: k,
      count: filterBank(items, { ...f, [k]: undefined }).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Opções de cada filtro dentro do que os demais filtros já deixam (evita combinações vazias). */
export function options(items: BankItem[], f: BankFilters) {
  const without = (k: keyof BankFilters) =>
    filterBank(items, { ...f, [k]: undefined });
  const count = <T extends string>(xs: T[]) => {
    const m = new Map<T, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const skillNum = (c: string) => Number(c.replace(/\D/g, "")) || 0;
  return {
    areas: count(without("area").map((i) => i.area)),
    skills: [...count(without("skill").flatMap((i) => i.skills))].sort(
      (a, b) => skillNum(a[0]) - skillNum(b[0]),
    ),
    subjects: (() => {
      const names = new Map<string, string>();
      const ids = without("subject").flatMap((i) =>
        i.subjects.map((s) => (names.set(s.id, s.name), s.id)),
      );
      return [...count(ids)]
        .map(([id, n]) => ({ id, name: names.get(id)!, n }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    })(),
    years: [...count(
      without("year").flatMap((i) => [
        ...new Set(i.origins.flatMap((o) => (o.year ? [String(o.year)] : []))),
      ]),
    )].sort((a, b) => b[0].localeCompare(a[0])),
    days: count(
      without("day").flatMap((i) => [
        ...new Set(i.origins.map((o) => `d${o.day}`)),
      ]),
    ),
  };
}

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): BankFilters {
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) || undefined;
  const area = one(sp.area);
  const skill = one(sp.habilidade);
  const subject = one(sp.assunto);
  const year = one(sp.edicao);
  const day = one(sp.dia);
  return {
    area: area && ["LC", "CH", "CN", "MT"].includes(area) ? area : undefined,
    skill: skill && /^H\d{1,2}$/.test(skill) ? skill : undefined,
    subject: subject && /^[0-9a-f-]{36}$/.test(subject) ? subject : undefined,
    year: year && /^20\d{2}$/.test(year) ? year : undefined,
    day: day === "d1" || day === "d2" ? day : undefined,
  };
}

export function toQuery(f: BankFilters): string {
  const p = new URLSearchParams();
  if (f.area) p.set("area", f.area);
  if (f.skill) p.set("habilidade", f.skill);
  if (f.subject) p.set("assunto", f.subject);
  if (f.year) p.set("edicao", f.year);
  if (f.day) p.set("dia", f.day);
  const s = p.toString();
  return s ? `?${s}` : "";
}
