"""Recorte de figuras e tabelas (F2-T08).

Uso: python figures.py   (usa o piloto de data/extraction/enem-2025-piloto.json)

Para cada questão do piloto, agrupa os objetos gráficos da área da questão (imagens, traços
vetoriais, retângulos de tabela) e os rótulos próximos em figuras; liga cada figura de
alternativa à letra; renderiza PNG a 216 dpi; registra coordenadas (pontos do PDF, MediaBox),
página, arquivo de origem e sha256. Verifica que nenhum objeto ou rótulo cruza a borda do recorte.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium

from extract import ALT_FONT, footer_top

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
OUT_DIR = REPO / "docs" / "validation" / "f2-t08"
SCALE = 3.0  # 216 dpi
MARGIN = 4.0  # pt ao redor da figura
HEADER_RE = re.compile(r"QUEST[ÃA]O\s+\d{2,3}", re.I)


def inter(a, b, pad=0.0) -> bool:
    return a[0] - pad < b[2] and b[0] - pad < a[2] and a[1] - pad < b[3] and b[1] - pad < a[3]


def contains(outer, inner, tol=0.5) -> bool:
    return outer[0] - tol <= inner[0] and outer[1] - tol <= inner[1] and inner[2] <= outer[2] + tol and inner[3] <= outer[3] + tol


def union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def box(o) -> tuple[float, float, float, float]:
    return (o["x0"], o["top"], o["x1"], o["bottom"])


def question_region(page, q: dict, pno: int) -> tuple[float, float, float, float]:
    """Área da questão na página: da primeira linha até antes da próxima questão na mesma coluna."""
    b = q["bbox_by_page"][str(pno)]
    x0, top, x1 = b[0] - 6, b[1] - 6, b[2] + 6
    limit = footer_top(page)
    for m in page.search(HEADER_RE.pattern, regex=True, case=False):
        cx = (m["x0"] + m["x1"]) / 2
        if x0 - 10 <= m["x0"] <= x1 and m["top"] > b[1] + 5:
            limit = min(limit, m["top"] - 4)
    px0, ptop, px1, _ = page.bbox
    return (max(x0, px0), max(top, ptop), min(x1, px1), limit)


def figures_on_page(page, q: dict, pno: int) -> list[dict]:
    region = question_region(page, q, pno)
    col_w = region[2] - region[0]
    objs = []
    for o in page.images:
        if (o["x1"] - o["x0"]) >= 12 and inter(box(o), region):
            objs.append(("imagem", box(o)))
    for o in page.curves + page.rects + page.lines:
        bb = box(o)
        thin_rule = (bb[3] - bb[1]) < 3 and (bb[2] - bb[0]) > 0.8 * col_w
        if not thin_rule and contains(region, bb, tol=2):
            objs.append(("vetor", bb))
    if not objs:
        return []
    chars = [c for c in page.chars if c["size"] >= 3 and c["text"].strip() and inter(box(c), region)]
    glyphs = [c for c in chars if ALT_FONT in c.get("fontname", "") and c["text"] in "ABCDE"]

    def letter_for(bb) -> str | None:
        """Alternativa do objeto: glifo à esquerda mais próximo (vertical pesa mais), na zona das alternativas."""
        if not glyphs or bb[3] < min(g["top"] for g in glyphs) - 40:
            return None
        cy = (bb[1] + bb[3]) / 2
        left = [g for g in glyphs if g["x1"] <= bb[0] + 8]
        if not left:
            return None
        best = min(left, key=lambda g: abs((g["top"] + g["bottom"]) / 2 - cy) + 0.3 * (bb[0] - g["x1"]))
        return best["text"]

    # agrupa objetos próximos (≤ 10 pt) da mesma alternativa (ou do texto-base) em figuras
    groups: list[dict] = []
    for kind, bb in objs:
        letter = letter_for(bb)
        hit = [g for g in groups if g["letter"] == letter and inter(g["bbox"], bb, pad=10)]
        merged = {"bbox": bb, "kinds": {kind}, "n": 1, "letter": letter}
        for g in hit:
            merged["bbox"] = union(merged["bbox"], g["bbox"])
            merged["kinds"] |= g["kinds"]
            merged["n"] += g["n"]
            groups.remove(g)
        groups.append(merged)
    groups = [g for g in groups if (g["bbox"][2] - g["bbox"][0]) >= 14 and (g["bbox"][3] - g["bbox"][1]) >= 10]

    # comprimento da linha de cada caractere: rótulo é curto; crédito/parágrafo é texto da questão
    reg_crop = page.crop(region).filter(lambda o: not (o.get("object_type") == "char" and o.get("size", 10) < 3))
    line_of = {}
    for ln in reg_crop.extract_text_lines(return_chars=True):
        n = sum(1 for c in ln["chars"] if c["text"].strip())
        for c in ln["chars"]:
            line_of[(round(c["x0"], 1), round(c["top"], 1))] = n

    for g in groups:
        for _ in range(3):  # rótulos pequenos ao redor e todo texto dentro da figura (tabelas, eixos)
            bb = g["bbox"]
            for c in chars:
                if c in glyphs:
                    continue
                cb = box(c)
                cx, cy = (cb[0] + cb[2]) / 2, (cb[1] + cb[3]) / 2
                inside = bb[0] <= cx <= bb[2] and bb[1] <= cy <= bb[3]
                short = line_of.get((round(c["x0"], 1), round(c["top"], 1)), 0) <= 30
                label = c["size"] < 9.6 and short and inter(bb, cb, pad=16)
                if inside or label:
                    g["bbox"] = union(g["bbox"], cb)
        g["bbox"] = (max(g["bbox"][0], region[0]), max(g["bbox"][1], region[1]), min(g["bbox"][2], region[2]), min(g["bbox"][3], region[3]))
        inner = [c for c in chars if contains(g["bbox"], box(c), tol=1)]
        g["chars_inside"] = len(inner)
        is_table = "vetor" in g["kinds"] and "imagem" not in g["kinds"] and len(inner) > 30 and g["n"] >= 6 and all(
            abs((o[1][2] - o[1][0])) < 2 or abs((o[1][3] - o[1][1])) < 2 or True for o in objs)
        g["kind"] = "tabela" if is_table and _looks_like_grid(page, g["bbox"]) else ("imagem" if g["kinds"] == {"imagem"} else "figura")
        g["alternative"] = g["letter"]
        g["region"] = region
        g["page"] = pno
    # figuras contidas em outra são absorvidas
    groups.sort(key=lambda g: -(g["bbox"][2] - g["bbox"][0]) * (g["bbox"][3] - g["bbox"][1]))
    kept: list[dict] = []
    for g in groups:
        if any(contains(k["bbox"], g["bbox"], tol=2) for k in kept):
            continue
        kept.append(g)
    return sorted(kept, key=lambda g: (g["bbox"][1], g["bbox"][0]))


def _looks_like_grid(page, bb) -> bool:
    edges = [e for e in page.edges if contains(bb, box(e), tol=2)]
    h = sum(1 for e in edges if abs(e["bottom"] - e["top"]) < 1.5)
    v = sum(1 for e in edges if abs(e["x1"] - e["x0"]) < 1.5)
    return h >= 3 and v >= 2


def crop_box(page, g) -> tuple[float, float, float, float]:
    """Figura + margem de até 4 pt por lado, reduzida para não encostar em texto de fora da figura."""
    bb = g["bbox"]
    m = [MARGIN] * 4
    for c in page.chars:
        if c["size"] < 3 or not c["text"].strip():
            continue
        cb = box(c)
        if contains(bb, cb, tol=0.5) or not inter(cb, (bb[0] - MARGIN, bb[1] - MARGIN, bb[2] + MARGIN, bb[3] + MARGIN)):
            continue
        if cb[2] <= bb[0] + 0.5:
            m[0] = min(m[0], max(0.0, bb[0] - cb[2] - 0.3))
        elif cb[0] >= bb[2] - 0.5:
            m[2] = min(m[2], max(0.0, cb[0] - bb[2] - 0.3))
        elif cb[3] <= bb[1] + 0.5:
            m[1] = min(m[1], max(0.0, bb[1] - cb[3] - 0.3))
        elif cb[1] >= bb[3] - 0.5:
            m[3] = min(m[3], max(0.0, cb[1] - bb[3] - 0.3))
    return (bb[0] - m[0], bb[1] - m[1], bb[2] + m[2], bb[3] + m[3])


def cut_check(page, g) -> list[str]:
    """Objetos/rótulos da área da questão que cruzam a borda do recorte (deveria ser vazio).
    Letras A–E (glifos) ficam fora de propósito; texto de outra coluna não conta."""
    crop = crop_box(page, g)
    region = g["region"]
    problems = []
    for o in page.images + page.curves + page.rects:
        bb = box(o)
        if contains(g["region"], bb, tol=2) and inter(crop, bb) and not contains(crop, bb, tol=1):
            if (bb[3] - bb[1]) < 3 and (bb[2] - bb[0]) > 0.8 * (g["region"][2] - g["region"][0]):
                continue  # régua separadora
            problems.append(f"objeto {tuple(round(v) for v in bb)}")
    for c in page.chars:
        if c["size"] < 3 or not c["text"].strip() or ALT_FONT in c.get("fontname", ""):
            continue
        cb = box(c)
        cx = (cb[0] + cb[2]) / 2
        if not (region[0] <= cx <= region[2]):
            continue
        if inter(crop, cb) and not contains(crop, cb, tol=0.5):
            problems.append(f"texto '{c['text']}' em {tuple(round(v) for v in cb)}")
    return problems


def main() -> int:
    pilot = json.loads((REPO / "data" / "extraction" / "enem-2025-piloto.json").read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.png"):
        old.unlink()
    out = []
    docs: dict[str, tuple] = {}
    for q in pilot["questions"]:
        pdf_path = ROOT / "raw" / "enem-2025" / q["booklet_file"]
        if q["booklet_file"] not in docs:
            docs[q["booklet_file"]] = (pdfplumber.open(str(pdf_path)), pdfium.PdfDocument(str(pdf_path)))
        plumb, pdfi = docs[q["booklet_file"]]
        for pno in q["pages"]:
            page = plumb.pages[pno - 1]
            figs = figures_on_page(page, q, pno)
            if not figs:
                continue
            ppage = pdfi[pno - 1]
            img = ppage.render(scale=SCALE).to_pil().convert("RGB")
            cx0, _, _, cy1 = ppage.get_cropbox()
            mx0, _, _, my1 = ppage.get_mediabox()
            dx, dy = cx0 - mx0, my1 - cy1
            for i, g in enumerate(figs, start=1):
                bb = g["bbox"]
                crop_pt = crop_box(page, g)
                px = tuple(round((v - (dx if k % 2 == 0 else dy)) * SCALE) for k, v in enumerate(crop_pt))
                piece = img.crop(px)
                tag = f"{re.search(r'D\d_CD\d+', q['booklet_file']).group()}_Q{q['number']}{'_' + q['foreign_language'] if q['foreign_language'] else ''}_p{pno}_{i}{'_' + g['alternative'] if g['alternative'] else ''}"
                path = OUT_DIR / f"{tag}.png"
                piece.save(path, optimize=True)
                problems = cut_check(page, g)
                out.append({
                    "question": q["number"],
                    "foreign_language": q["foreign_language"],
                    "booklet_file": q["booklet_file"],
                    "booklet_sha256": q["booklet_sha256"],
                    "page": pno,
                    "kind": g["kind"],
                    "role": f"alternativa {g['alternative']}" if g["alternative"] else "texto-base/comando",
                    "bbox_pt": [round(v, 2) for v in crop_pt],
                    "coordinate_system": "pontos do PDF, MediaBox, origem no topo (pdfplumber)",
                    "png": str(path.relative_to(REPO)),
                    "width_px": piece.width,
                    "height_px": piece.height,
                    "dpi": round(72 * SCALE),
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "objects": g["n"],
                    "chars_inside": g["chars_inside"],
                    "cut_check": problems,
                    "alt_text": None,
                    "status": "proposta_para_revisao",
                })
    manifest = {
        "status": "proposta_para_revisao",
        "tool": "tools/ingest/figures.py v0.1",
        "note": "Recortes dos PDFs oficiais do Inep para o piloto. Texto alternativo (alt) será escrito na revisão editorial e não pode revelar a resposta.",
        "figures": out,
    }
    (REPO / "data" / "extraction" / "enem-2025-piloto-figuras.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cut = [f for f in out if f["cut_check"]]
    print(f"{len(out)} recortes · {len(cut)} com objeto/rótulo cruzando a borda")
    for f in out:
        print(f"  Q{f['question']}{(' ' + f['foreign_language']) if f['foreign_language'] else ''} p{f['page']} {f['kind']:7} {f['role']:22} {f['width_px']}×{f['height_px']} obj={f['objects']} txt={f['chars_inside']} {'CORTE: ' + '; '.join(f['cut_check'][:3]) if f['cut_check'] else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
