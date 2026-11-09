"""Cruzamento de cadernos (F2-T10).

Uso: python crossmatch.py [--review]   (dia 1: Caderno 1 Azul × Caderno 2 Amarelo; dia 2: Caderno 7 Azul × Caderno 5 Amarelo)

1. Lê os gabaritos oficiais (inclui "Anulado" e as opções inglês/espanhol das questões 1–5).
2. Casa cada questão entre as duas cores pela impressão digital do conteúdo (texto-base + comando),
   independente da posição no caderno.
3. Mapeia as letras impressas pelo texto das alternativas; quando a alternativa é figura, pelo
   sha256 do bitmap embutido no PDF e, por último, por comparação visual conservadora.
4. Confere: a alternativa correta numa cor é a mesma alternativa correta na outra, depois do mapeamento.
--review gera folhas lado a lado em docs/validation/f2-t10/ para a conferência humana (REVIEW).
"""
from __future__ import annotations

import difflib
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

from extract import segment, structure

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
RAW = ROOT / "raw" / "enem-2025"
PAIRS = [("D1", "1", "2"), ("D2", "7", "5")]


def parse_answer_key(path: Path) -> dict[tuple[int, str | None], str]:
    """{(questão, língua|None): 'A'..'E' ou 'ANULADO'}."""
    return parse_answer_text(pdfplumber.open(str(path)).pages[0].extract_text() or "")


def parse_answer_text(text: str) -> dict[tuple[int, str | None], str]:
    key: dict[tuple[int, str | None], str] = {}
    ans = r"(Anulado|ANULADO|[A-E])\b"
    for line in text.splitlines():
        line = line.strip()
        m = re.match(rf"^(\d{{1,3}})\s+{ans}\s+{ans}\s+(\d{{1,3}})\s+{ans}$", line)
        if m and int(m.group(1)) <= 5:  # 1 inglês espanhol 46 X
            n = int(m.group(1))
            key[(n, "ingles")] = m.group(2).upper()
            key[(n, "espanhol")] = m.group(3).upper()
            key[(int(m.group(4)), None)] = m.group(5).upper()
            continue
        for n, a in re.findall(rf"(\d{{1,3}})\s+{ans}", line):
            key[(int(n), None)] = a.upper()
    return key


def norm(t: str) -> str:
    t = unicodedata.normalize("NFKC", t).casefold()
    return re.sub(r"[^\w]+", "", t)


def norm_alt(t: str) -> str:
    """Normalização leve para alternativas: preserva sinais (−, +, <, =) que distinguem respostas."""
    t = unicodedata.normalize("NFKC", t).casefold().replace("\u2212", "-")
    return re.sub(r"\s+", "", t)


def content_key(q: dict) -> str:
    stim = " ".join(b["text"] for b in q["stimulus_blocks"])
    return norm(stim + " " + q["command"])


def fingerprint(q: dict) -> str:
    """Impressão digital canônica: conteúdo + conjunto de alternativas (independe de posição e letra)."""
    alts = sorted(norm(v) for v in q["alternatives"].values())
    return hashlib.sha256((content_key(q) + "|" + "|".join(alts)).encode()).hexdigest()


def extract(day: str, booklet: str) -> dict:
    path = RAW / f"2025_PV_impresso_{day}_CD{booklet}.pdf"
    qs, _ = segment(pdfplumber.open(str(path)))
    return {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "questions": [structure(q) for q in qs]}


def match_items(a: list[dict], b: list[dict]) -> list[tuple[dict, dict | None, str]]:
    index = {}
    for q in b:
        index.setdefault((content_key(q), q["foreign_language"]), []).append(q)
    used: set[int] = set()
    out = []
    for qa in a:
        cands = [q for q in index.get((content_key(qa), qa["foreign_language"]), []) if id(q) not in used]
        if len(cands) == 1:
            used.add(id(cands[0]))
            out.append((qa, cands[0], "conteúdo idêntico"))
            continue
        # tolerância para pequenas diferenças de extração
        ka = content_key(qa)
        best, ratio = None, 0.0
        for qb in b:
            if id(qb) in used or qb["foreign_language"] != qa["foreign_language"]:
                continue
            r = difflib.SequenceMatcher(None, ka, content_key(qb), autojunk=False).quick_ratio()
            if r > ratio:
                best, ratio = qb, r
        if best is not None and ratio >= 0.97:
            r = difflib.SequenceMatcher(None, ka, content_key(best), autojunk=False).ratio()
            if r >= 0.95:
                used.add(id(best))
                out.append((qa, best, f"conteúdo semelhante ({r:.3f})"))
                continue
        out.append((qa, None, "sem par"))
    return out


def map_letters(qa: dict, qb: dict) -> dict[str, str | None]:
    tb = {}
    for k, v in qb["alternatives"].items():
        tb.setdefault(norm_alt(v), []).append(k)
    out = {}
    for k, v in qa["alternatives"].items():
        hits = tb.get(norm_alt(v), []) if norm_alt(v) else []
        out[k] = hits[0] if len(hits) == 1 else None
    return out


def figure_crops(pdf_path: Path, q: dict) -> dict:
    """Recorte renderizado (tons de cinza) da figura de cada alternativa da questão."""
    import pypdfium2 as pdfium
    from figures import SCALE, crop_box, figures_on_page

    plumb = pdfplumber.open(str(pdf_path))
    doc = pdfium.PdfDocument(str(pdf_path))
    crops: dict = {}
    for pno in q["pages"]:
        page = plumb.pages[pno - 1]
        figs = [g for g in figures_on_page(page, q, pno) if g["alternative"]]
        if not figs:
            continue
        pp = doc[pno - 1]
        img = pp.render(scale=SCALE).to_pil().convert("L")
        cx0, _, _, cy1 = pp.get_cropbox()
        mx0, _, _, my1 = pp.get_mediabox()
        dx, dy = cx0 - mx0, my1 - cy1
        for g in figs:
            c = crop_box(page, g)
            crops[g["alternative"]] = img.crop(tuple(round((v - (dx if k % 2 == 0 else dy)) * SCALE) for k, v in enumerate(c)))
    return crops


def image_hashes(pdf_path: Path, q: dict) -> dict[str, tuple[str, ...]]:
    """sha256 dos bitmaps embutidos no PDF dentro da figura de cada alternativa (comparação exata)."""
    from figures import figures_on_page

    plumb = pdfplumber.open(str(pdf_path))
    out: dict[str, tuple[str, ...]] = {}
    for pno in q["pages"]:
        page = plumb.pages[pno - 1]
        for g in figures_on_page(page, q, pno):
            if not g["alternative"]:
                continue
            x0, t, x1, b = g["bbox"]
            ims = [i for i in page.images if i["x0"] >= x0 - 2 and i["x1"] <= x1 + 2 and i["top"] >= t - 2 and i["bottom"] <= b + 2]
            if ims:
                out[g["alternative"]] = tuple(sorted(hashlib.sha256(i["stream"].get_data()).hexdigest() for i in ims))
    return out


def map_by_images(pa: Path, qa: dict, pb: Path, qb: dict) -> dict[str, str | None]:
    ha, hb = image_hashes(pa, qa), image_hashes(pb, qb)
    inv: dict[tuple[str, ...], list[str]] = {}
    for k, v in hb.items():
        inv.setdefault(v, []).append(k)
    return {k: (inv[v][0] if len(inv.get(v, [])) == 1 else None) for k, v in ha.items()}


def map_by_figures(pa: Path, qa: dict, pb: Path, qb: dict) -> dict[str, str | None]:
    """Mapeia letras comparando as figuras das alternativas entre as duas cores.

    Janelas do mesmo tamanho, ancoradas no canto superior esquerdo (o recorte pode ter alguns pontos
    a mais num dos cadernos), reduzidas 4×. Aceita só par mútuo e inequívoco: a melhor distância
    precisa ser menor que metade da segunda, nos dois sentidos."""
    ca, cb = figure_crops(pa, qa), figure_crops(pb, qb)
    if not ca or not cb:
        return {}
    w = min(im.width for im in [*ca.values(), *cb.values()])
    h = min(im.height for im in [*ca.values(), *cb.values()])

    def sig(im):
        return im.crop((0, 0, w, h)).resize((max(1, w // 4), max(1, h // 4))).tobytes()

    sa, sb = {k: sig(v) for k, v in ca.items()}, {k: sig(v) for k, v in cb.items()}
    d = {(i, j): sum(abs(x - y) for x, y in zip(va, vb)) / (255 * len(va)) for i, va in sa.items() for j, vb in sb.items()}

    def unambiguous(row: dict) -> str | None:
        ranked = sorted(row, key=row.get)
        if len(ranked) == 1:
            return ranked[0]
        return ranked[0] if row[ranked[0]] < 0.5 * row[ranked[1]] else None

    out: dict[str, str | None] = {}
    for i in sa:
        j = unambiguous({j: d[(i, j)] for j in sb})
        back = unambiguous({k: d[(k, j)] for k in sa}) if j else None
        out[i] = j if j and back == i else None
    return out


REVIEW = [("D1", 1, "ingles"), ("D1", 1, "espanhol"), ("D1", 10, None), ("D1", 45, None), ("D2", 107, None),
          ("D2", 123, None), ("D2", 135, None), ("D2", 137, None), ("D2", 153, None), ("D2", 169, None)]


def question_image(pdf_path: Path, q: dict, scale: float = 1.5):
    """Recorte da questão inteira (todas as páginas, empilhadas) para conferência visual."""
    import pypdfium2 as pdfium
    from PIL import Image

    doc = pdfium.PdfDocument(str(pdf_path))
    parts = []
    for pno in q["pages"]:
        x0, top, x1, bottom = q["bbox_by_page"][str(pno)]
        pp = doc[pno - 1]
        cx0, _, _, cy1 = pp.get_cropbox()
        mx0, _, _, my1 = pp.get_mediabox()
        dx, dy = cx0 - mx0, my1 - cy1
        img = pp.render(scale=scale).to_pil().convert("RGB")
        parts.append(img.crop((round((x0 - 4 - dx) * scale), round((top - 22 - dy) * scale), round((x1 + 4 - dx) * scale), round((bottom + 4 - dy) * scale))))
    out = Image.new("RGB", (max(p.width for p in parts), sum(p.height for p in parts)), "white")
    y = 0
    for p in parts:
        out.paste(p, (0, y))
        y += p.height
    return out


def review_sheets(report: dict, extracted: dict) -> list[str]:
    from PIL import Image, ImageDraw, ImageFont

    out_dir = REPO / "docs" / "validation" / "f2-t10"
    out_dir.mkdir(parents=True, exist_ok=True)
    try:  # fonte com acentos; a padrão do Pillow não tem "á"
        font = ImageFont.truetype("DejaVuSans.ttf", 18)
    except OSError:
        font = ImageFont.load_default(size=18)
    names = []
    for day, num, lang in REVIEW:
        pair = next(p for p in report["pairs"] if p["day"] == day)
        row = next(r for r in pair["rows"] if r["position_a"] == num and r["foreign_language"] == lang)
        A, B = extracted[(day, "a")], extracted[(day, "b")]
        qa = next(q for q in A["questions"] if q["number"] == num and q["foreign_language"] == lang)
        qb = next(q for q in B["questions"] if q["number"] == row["position_b"] and q["foreign_language"] == lang)
        ia, ib = question_image(RAW / A["file"], qa), question_image(RAW / B["file"], qb)
        head = 100
        sheet = Image.new("RGB", (ia.width + ib.width + 30, max(ia.height, ib.height) + head), "white")
        d = ImageDraw.Draw(sheet)
        tag = f" ({lang})" if lang else ""
        letters = " ".join(f"{k}→{v or '?'}" for k, v in row["letter_map"].items())
        d.text((10, 6), f"Esquerda: {A['file']} · Q{num}{tag} · gabarito {row['answer_a']}", fill="black", font=font)
        d.text((10, 32), f"Direita: {B['file']} · Q{row['position_b']}{tag} · gabarito {row['answer_b']}", fill="black", font=font)
        d.text((10, 58), f"Automático: {row['check']} · letras {letters}", fill="black", font=font)
        sheet.paste(ia, (0, head))
        sheet.paste(ib, (ia.width + 30, head))
        d.line([(ia.width + 15, head), (ia.width + 15, sheet.height)], fill="gray", width=2)
        name = f"{day}_Q{num:03d}{'_' + lang if lang else ''}_x_Q{row['position_b']:03d}.png"
        sheet.save(out_dir / name, optimize=True)
        names.append(name)
    return names


def main() -> int:
    report = {"status": "cruzamento_automatico_para_revisao", "pairs": []}
    extracted = {}
    for day, ca, cb in PAIRS:
        A, B = extract(day, ca), extract(day, cb)
        extracted[(day, "a")], extracted[(day, "b")] = A, B
        ka = parse_answer_key(RAW / f"2025_GB_impresso_{day}_CD{ca}.pdf")
        kb = parse_answer_key(RAW / f"2025_GB_impresso_{day}_CD{cb}.pdf")
        rows = []
        for qa, qb, how in match_items(A["questions"], B["questions"]):
            row = {"position_a": qa["number"], "foreign_language": qa["foreign_language"], "position_b": qb["number"] if qb else None, "match": how,
                   "fingerprint": fingerprint(qa)}
            if qb:
                lm = map_letters(qa, qb)
                methods = []
                for name, fn in (("bitmap idêntico (sha256 da imagem embutida)", map_by_images),
                                 ("comparação visual das figuras", map_by_figures)):
                    if all(v is not None for v in lm.values()):
                        break
                    found = {k: v for k, v in fn(RAW / A["file"], qa, RAW / B["file"], qb).items() if v and lm.get(k) is None}
                    if found:
                        lm.update(found)
                        methods.append(f"{name}: {''.join(sorted(found))}")
                if methods:
                    row["letter_map_method"] = "texto + " + "; ".join(methods)
                aa, ab = ka.get((qa["number"], qa["foreign_language"])), kb.get((qb["number"], qb["foreign_language"]))
                row.update(letter_map=lm, answer_a=aa, answer_b=ab, fingerprint_b=fingerprint(qb))
                if aa == "ANULADO" or ab == "ANULADO":
                    row["check"] = "anulada nas duas" if aa == ab else "ANULAÇÃO DIVERGENTE"
                elif aa is None or ab is None:
                    row["check"] = "gabarito ausente"
                elif lm.get(aa) is None:
                    row["check"] = "letra não mapeável automaticamente"
                else:
                    row["check"] = "confere" if lm[aa] == ab else "DIVERGE"
                row["same_fingerprint"] = row["fingerprint"] == row["fingerprint_b"]
            rows.append(row)
        counts: dict[str, int] = {}
        for r in rows:
            k = r.get("check", "sem par")
            counts[k] = counts.get(k, 0) + 1
        permuted = sum(1 for r in rows if r.get("letter_map") and any(k != v for k, v in r["letter_map"].items() if v))
        moved = sum(1 for r in rows if r.get("position_b") and r["position_b"] != r["position_a"])
        report["pairs"].append({"day": day, "a": {"file": A["file"], "sha256": A["sha256"], "answer_key_items": len(ka)},
                                "b": {"file": B["file"], "sha256": B["sha256"], "answer_key_items": len(kb)},
                                "counts": counts, "items_in_other_position": moved, "items_with_permuted_letters": permuted, "rows": rows})
        print(f"{day}: {A['file']} × {B['file']} · {len(rows)} itens · {counts} · posição diferente: {moved} · letras permutadas: {permuted}")
    if "--review" in sys.argv:
        print("folhas de conferência:", ", ".join(review_sheets(report, extracted)))
    (REPO / "data" / "extraction" / "enem-2025-cruzamento.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
