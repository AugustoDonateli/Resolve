/**
 * Número digitado pelo aluno, no jeito brasileiro: "43,20", "29 424", "29.424" (milhar) ou "4.5".
 * Devolve null quando não dá para ler um número.
 */
export function parseAnswer(raw: string): number | null {
  let s = raw.trim().replace(/^r\$\s*/i, "").replace(/\s+/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function isRight(raw: string, answer: number, tolerance: number): boolean {
  const n = parseAnswer(raw);
  return n !== null && Math.abs(n - answer) <= tolerance;
}
