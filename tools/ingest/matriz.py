"""Extrai a matriz de referência das provas objetivas (F2-T02).

Fonte: INEP, "Matrizes de Referência – Enem" (enem_matriz_de_referencia_v1.pdf, publicada
on-line em abril de 2026). Gera data/matriz/enem-matriz-v1.json com eixos cognitivos,
competências de área e habilidades, cada uma com a página de origem.
Falha se a estrutura não fechar (30 habilidades por área, numeração contínua).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
PDF = ROOT / "raw" / "enem-documentos" / "enem_matriz_de_referencia_v1.pdf"
OUT = REPO / "data" / "matriz" / "enem-matriz-v1.json"

AREAS = [
    ("LC", "Linguagens, Códigos e suas Tecnologias", r"^LINGUAGENS, CÓDIGOS"),
    ("MT", "Matemática e suas Tecnologias", r"^MATEMÁTICA( E SUAS)?$|^MATEMÁTICA E SUAS TECNOLOGIAS$"),
    ("CN", "Ciências da Natureza e suas Tecnologias", r"^CIÊNCIAS DA NATUREZA"),
    ("CH", "Ciências Humanas e suas Tecnologias", r"^CIÊNCIAS HUMANAS"),
]
CONTINUATION = re.compile(r"^(E SUAS TECNOLOGIAS|TECNOLOGIAS|E SUAS|SUAS TECNOLOGIAS)$")
NOISE = re.compile(r"^(VOLTAR PARA|O SUMÁRIO|\d+ MATRIZES DE REFERÊNCIA|MATRIZES DE REFERÊNCIA)")
SECTION_END = "SEÇÃO 2"


HYPHENATED: set[str] = set()  # compostos com hífen no meio da linha (ex.: matérias-primas)


def clean(s: str) -> str:
    """Junta linhas; hífen de quebra de linha só sai se a forma com hífen não existir no documento."""
    s = re.sub(r"\s+", " ", s).strip()

    def fix(m: re.Match) -> str:
        a, b = m.group(1), m.group(2)
        return f"{a}-{b}" if f"{a}-{b}".lower() in HYPHENATED or b[:1].isupper() else a + b

    return re.sub(r"(\w+)- (\w+)", fix, s)


def main() -> int:
    digest = hashlib.sha256(PDF.read_bytes()).hexdigest()
    pdf = pdfplumber.open(str(PDF))
    full = "\n".join(p.extract_text() or "" for p in pdf.pages)
    HYPHENATED.update(w.lower() for w in re.findall(r"\w+-\w+", full))
    lines: list[tuple[int, str]] = []
    started = False
    for pno, page in enumerate(pdf.pages, start=1):
        for raw in (page.extract_text() or "").splitlines():
            line = raw.strip()
            if line == "SEÇÃO 1":  # corpo do documento (o sumário cita "SEÇÃO 1 – ...")
                started = True
            if not started or not line or NOISE.match(line):
                continue
            if line.startswith(SECTION_END):
                started = False
                break
            lines.append((pno, line))
        if lines and not started and any(l.startswith("Competência de área") for _, l in lines):
            break

    # Eixos cognitivos (I–V)
    axes = []
    text_all = "\n".join(l for _, l in lines)
    for m in re.finditer(r"^(I{1,3}|IV|V)\. (.+?) \((\w\w)\): (.+?)(?=^\s*(?:I{1,3}|IV|V)\. |^LINGUAGENS|\Z)", text_all, re.S | re.M):
        axes.append({"code": m.group(3), "roman": m.group(1), "label": clean(m.group(2)), "description": clean(m.group(4))})

    areas = []
    current = None
    comp = None
    skill = None
    mode = None  # "comp" | "skill"
    for pno, line in lines:
        hit = next((a for a in AREAS if re.match(a[2], line)), None)
        if hit:
            current = {"code": hit[0], "label": hit[1], "competencies": [], "skills": []}
            areas.append(current)
            comp = skill = None
            mode = None
            continue
        if current is None:
            continue
        if CONTINUATION.match(line):
            continue
        m = re.match(r"^Competência de área (\d+)$", line)
        if m:
            comp = {"code": f"C{int(m.group(1))}", "number": int(m.group(1)), "description": "", "page": pno}
            current["competencies"].append(comp)
            mode, skill = "comp", None
            continue
        m = re.match(r"^H(\d+) [–-] (.*)$", line)
        if m and comp:
            skill = {"code": f"H{int(m.group(1))}", "number": int(m.group(1)), "competency": comp["code"], "description": m.group(2), "page": pno}
            current["skills"].append(skill)
            mode = "skill"
            continue
        if mode == "comp":
            comp["description"] += " " + line
        elif mode == "skill" and skill:
            skill["description"] += " " + line

    errors = []
    for a in areas:
        for c in a["competencies"]:
            c["description"] = clean(c["description"])
        for s in a["skills"]:
            s["description"] = clean(s["description"])
        nums = [s["number"] for s in a["skills"]]
        if nums != list(range(1, 31)):
            errors.append(f"{a['code']}: habilidades {nums}")
        cnums = [c["number"] for c in a["competencies"]]
        if cnums != list(range(1, len(cnums) + 1)):
            errors.append(f"{a['code']}: competências {cnums}")
        for s in a["skills"]:
            if len(s["description"]) < 15 or not s["description"].endswith("."):
                errors.append(f"{a['code']} {s['code']}: descrição suspeita: {s['description']!r}")
    if [a["code"] for a in areas] != ["LC", "MT", "CN", "CH"]:
        errors.append(f"áreas encontradas: {[a['code'] for a in areas]}")
    if len(axes) != 5:
        errors.append(f"eixos cognitivos: {len(axes)}")

    out = {
        "source": {
            "title": "Matrizes de Referência – Enem",
            "institution": "Inep/MEC",
            "url": "https://download.inep.gov.br/enem/outros_documentos/enem_matriz_de_referencia_v1.pdf",
            "published": "abril de 2026 (on-line)",
            "sha256": digest,
            "rights": "É permitida a reprodução total ou parcial desta publicação, desde que citada a fonte (p. 4).",
        },
        "label": "Matriz de Referência do Enem — provas objetivas (v1, 2026)",
        "cognitive_axes": axes,
        "areas": areas,
    }
    if errors:
        print("ESTRUTURA NÃO FECHOU:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ok · {OUT.relative_to(REPO)} · " + ", ".join(f"{a['code']}: {len(a['competencies'])} competências/{len(a['skills'])} habilidades" for a in areas))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
