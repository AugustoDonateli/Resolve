"""Recorte piloto de 10 questões representativas (F2-T07) + imagens de conferência.

Uso: python pilot.py   (requer raw/extraction/D1_CD1.json e D2_CD7.json gerados por extract.py)
"""
from __future__ import annotations

import json
from pathlib import Path

from extract import review_images

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
PICK = [
    ("D1_CD1", 1, "ingles", "língua estrangeira (inglês), texto longo com crédito"),
    ("D1_CD1", 1, "espanhol", "língua estrangeira (espanhol): mesma posição, outra opção"),
    ("D1_CD1", 3, "ingles", "poema recuado (versos e estrofes)"),
    ("D1_CD1", 45, None, "atravessa páginas; charge (imagem)"),
    ("D1_CD1", 63, None, "Humanas com gráfico e nota de rodapé da figura"),
    ("D2_CD7", 105, None, "diagrama com rótulos (texto dentro da figura)"),
    ("D2_CD7", 106, None, "fórmulas químicas com índices sub/sobrescritos"),
    ("D2_CD7", 119, None, "alternativas em figura vetorial (circuitos)"),
    ("D2_CD7", 140, None, "Matemática sem comando identificado automaticamente"),
    ("D2_CD7", 169, None, "tabela + alternativas em figura"),
]


def main() -> int:
    out_dir = REPO / "docs" / "validation" / "f2-t07"
    out_dir.mkdir(parents=True, exist_ok=True)
    picked = []
    for book, number, lang, why in PICK:
        data = json.loads((ROOT / "raw" / "extraction" / f"{book}.json").read_text(encoding="utf-8"))
        q = next(q for q in data["questions"] if q["number"] == number and q["foreign_language"] == lang)
        picked.append({"booklet_file": data["file"], "booklet_sha256": data["sha256"], "why": why, **q})
    doc = {
        "status": "proposta_para_revisao",
        "extractor": "tools/ingest/extract.py v0.1",
        "note": "Texto extraído automaticamente de PDFs oficiais do Inep. Não publicado; serve para conferência do processo.",
        "questions": picked,
    }
    (REPO / "data" / "extraction").mkdir(parents=True, exist_ok=True)
    (REPO / "data" / "extraction" / "enem-2025-piloto.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for book in ("D1_CD1", "D2_CD7"):
        data = json.loads((ROOT / "raw" / "extraction" / f"{book}.json").read_text(encoding="utf-8"))
        nums = {(n, l) for b, n, l, _ in PICK if b == book}
        files = review_images(ROOT / "raw" / "enem-2025" / f"2025_PV_impresso_{book}.pdf", data["questions"], out_dir / book, nums)
        print(book, len(files), "imagens")
    print("piloto:", len(picked), "questões")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
