"""Rubrica oficial da redação (F5-T02): cinco competências e níveis de 0 a 200.

Fonte: Matrizes de Referência – Enem (Inep, abril de 2026), páginas 29–31, a mesma publicação da
matriz das provas objetivas (data/matriz/enem-matriz-v1.json). Lê a tabela pela geometria: a coluna
de pontuação fica à esquerda de x≈150 e a descrição à direita; as linhas da tabela vêm dos
retângulos sombreados e das réguas horizontais. Confere cada texto contra o texto da página.

Uso: python rubrica.py   → data/redacao/rubrica-enem-v1.json
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
PDF = ROOT / "raw" / "enem-documentos" / "enem_matriz_de_referencia_v1.pdf"
PAGES = (29, 30, 31)
ROMAN = ["I", "II", "III", "IV", "V"]


def clean(lines: list[str]) -> str:
    """Junta linhas: hífen de fim de linha só some quando a palavra continua (minúscula em seguida)."""
    out = ""
    for ln in (l.strip() for l in lines if l.strip()):
        if out.endswith("-") and ln[:1].islower():
            out = out[:-1] + ln
        else:
            out = f"{out} {ln}" if out else ln
    return re.sub(r"\s+", " ", out).strip()


def norm(t: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", t)).strip()


def row_bounds(page, x_split: float) -> list[float]:
    # a divisória varia de página para página (149–153 nas tabelas de níveis, 177 na tabela-resumo)
    near = [r for r in page.rects if abs(r["x1"] - x_split) <= 6]
    tops = {round(r["top"], 1) for r in near} | {round(r["bottom"], 1) for r in near}
    # réguas horizontais (vêm em dois pedaços: célula da pontuação e célula da descrição)
    tops |= {round(l["top"], 1) for l in page.lines if abs(l["top"] - l["bottom"]) < 1 and l["x1"] - l["x0"] > 50}
    return sorted(tops)


def level_rows(page) -> list[tuple[int, str]]:
    """(pontos, descrição) de cada linha das tabelas de níveis da página, na ordem."""
    words = page.extract_words()
    bounds = row_bounds(page, 150)
    rows = []
    for i, w in enumerate(words):
        if w["text"] in ("pontos", "ponto") and w["x0"] < 150 and i > 0 and words[i - 1]["text"].isdigit():
            top = w["top"]
            lo = max((b for b in bounds if b <= top), default=None)
            hi = min((b for b in bounds if b > top), default=None)
            if lo is None or hi is None:
                raise SystemExit(f"página {page.page_number}: linha da tabela sem limites para {words[i - 1]['text']} pontos")
            text = page.crop((150, lo, page.width - 70, hi)).extract_text() or ""
            rows.append((int(words[i - 1]["text"]), clean(text.splitlines())))
    return rows


def competency_titles(page) -> dict[str, str]:
    """Tabela-resumo da página 29: "Competência N" → enunciado."""
    words = page.extract_words()
    bounds = row_bounds(page, 177)
    out = {}
    for i, w in enumerate(words):
        if w["text"] == "Competência" and w["x0"] < 100 and w["top"] < 350 and i + 1 < len(words):
            roman = words[i + 1]["text"]
            lo = max((b for b in bounds if b <= w["top"] + 1), default=None)
            hi = min((b for b in bounds if b > w["top"] + 1), default=None)
            text = page.crop((177, lo, page.width - 70, hi)).extract_text() or ""
            out[roman] = clean(text.splitlines())
    return out


def main() -> int:
    pdf = pdfplumber.open(str(PDF))
    titles = competency_titles(pdf.pages[PAGES[0] - 1])
    rows: list[tuple[int, int, str]] = []
    for pno in PAGES:
        rows += [(pno, s, t) for s, t in level_rows(pdf.pages[pno - 1])]
    if [s for _, s, _ in rows] != [200, 160, 120, 80, 40, 0] * 5:
        raise SystemExit(f"esperadas 5 tabelas de 200 a 0; lidas: {[s for _, s, _ in rows]}")
    # texto corrido da página sem os rótulos de pontuação (na leitura corrida eles caem no meio das frases)
    page_text = {pno: norm(re.sub(r"\b\d{1,3} pontos?\b", " ", pdf.pages[pno - 1].extract_text() or "")) for pno in PAGES}
    comps = []
    for c, roman in enumerate(ROMAN):
        levels = []
        for k in range(6):
            pno, score, text = rows[c * 6 + k]
            # conferência: cada trecho de pelo menos 3 palavras da descrição aparece no texto da página
            words = text.split()
            chunks = [" ".join(words[j : j + 3]) for j in range(0, max(1, len(words) - 2), 3)]
            missing = [ch for ch in chunks if norm(ch) not in page_text[pno]]
            if missing:
                raise SystemExit(f"competência {roman}, {score} pontos: trechos não conferem com a página {pno}: {missing[:3]}")
            levels.append({"score": score, "description": text, "page": pno})
        # cada nível tem texto próprio: linhas da tabela misturadas produziriam textos repetidos
        if len({lv["description"] for lv in levels}) != 6:
            raise SystemExit(f"competência {roman}: níveis com textos repetidos (linhas da tabela não separadas)")
        comps.append({"code": f"C{c + 1}", "roman": roman, "title": titles[roman], "levels": levels})
    out = {
        "source": {
            "title": "Matrizes de Referência – Enem",
            "institution": "Inep/MEC",
            "url": "https://download.inep.gov.br/enem/outros_documentos/enem_matriz_de_referencia_v1.pdf",
            "sha256": hashlib.sha256(PDF.read_bytes()).hexdigest(),
            "pages": list(PAGES),
        },
        "label": "Redação do Enem — competências e níveis (Inep, abril de 2026)",
        "allowed_scores": [0, 40, 80, 120, 160, 200],
        "competencies": comps,
        "note": "Regras de discrepância e consolidação entre avaliadores não constam desta publicação; ficam para a F5-T11 com fonte própria.",
    }
    dest = REPO / "data" / "redacao" / "rubrica-enem-v1.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for c in comps:
        print(c["code"], c["title"][:70], "·", [lv["score"] for lv in c["levels"]])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
