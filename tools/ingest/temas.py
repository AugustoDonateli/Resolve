"""Tema oficial de redação (F5-T03): proposta e textos motivadores de um caderno do Enem.

Lê a página da "PROPOSTA DE REDAÇÃO" pela geometria. Duas colunas, separadas pela régua vertical; cada
texto começa no cabeçalho "TEXTO N" em negrito. Os tipos de linha são identificados pela fonte: corpo
em 10 pt, citação em 8 pt e título/legenda em negrito de 10 pt. As figuras são recortadas a 216 dpi.
O texto alternativo das figuras é só uma PROPOSTA: transcreve o que está visível e precisa ser conferido
pelo editor antes da publicação.

Conferências:
- cada trecho de 3 palavras de cada texto aparece no texto corrido da página;
- a mesma proposta, texto a texto, é idêntica nos outros cadernos regulares do dia (cores diferentes);
- o tema é a citação entre aspas da instrução, sem nenhuma palavra acrescentada.

Uso: python temas.py   → data/redacao/temas/enem-2025.json + recortes em data/redacao/temas/figuras/
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
RAW = ROOT / "raw" / "enem-2025"
MAIN = "2025_PV_impresso_D1_CD1.pdf"
OTHERS = ["2025_PV_impresso_D1_CD2.pdf", "2025_PV_impresso_D1_CD3.pdf", "2025_PV_impresso_D1_CD4.pdf"]
OUT = REPO / "data" / "redacao" / "temas"
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
DPI_SCALE = 3  # 72 pt × 3 = 216 dpi, como os recortes das questões (F2-T08)

# Texto alternativo PROPOSTO (transcrição do que se vê na figura; conferir na revisão editorial).
ALT_PROPOSTO = {
    "II": "Dois pictogramas brancos sobre fundo azul. À esquerda, uma pessoa curvada que se apoia numa bengala. "
          "À direita, uma pessoa de postura ereta ao lado da inscrição “60+”.",
    "IV": "Gráfico de rosca sobre pessoas de 65 a 74 anos: 34% contribuem para os gastos, mas não são os mantenedores "
          "principais; 38% são a principal renda, mas contam com outras rendas; 28% sustentam a casa sozinhos.",
}


def norm(t: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", t)).strip()


def join_lines(lines: list[str]) -> str:
    out = ""
    for ln in (l.strip() for l in lines if l.strip()):
        if out.endswith("-") and ln[:1].islower():
            out = out[:-1] + ln
        elif out and (out.endswith("/") or out.endswith(".")) and re.match(r"^[a-z0-9/.-]+\.(br|com|org|gov)", ln):
            out += ln  # endereço quebrado em duas linhas
        else:
            out = f"{out} {ln}" if out else ln
    return re.sub(r"\s+", " ", out).strip()


def proposal_page(pdf) -> int:
    for i, p in enumerate(pdf.pages):
        if "PROPOSTA DE REDA" in (p.extract_text() or ""):
            return i
    raise SystemExit("página da proposta de redação não encontrada")


def line_kind(chars: list[dict]) -> str:
    sizes = [round(c["size"]) for c in chars if c["text"].strip()]
    bold = sum("Bold" in c["fontname"] for c in chars if c["text"].strip())
    if not sizes:
        return "vazia"
    size = max(set(sizes), key=sizes.count)
    if size <= 8:
        return "citacao"
    if bold >= 0.8 * len(sizes):
        return "negrito"
    return "corpo"


def extract(path: Path, with_figures: bool = False) -> dict:
    pdf = pdfplumber.open(str(path))
    pi = proposal_page(pdf)
    page = pdf.pages[pi]
    words = page.extract_words()
    head = next(w for w in words if w["text"] == "PROPOSTA")
    rule = next(l for l in page.lines if abs(l["x0"] - l["x1"]) < 1 and l["bottom"] - l["top"] > 300)
    x_mid, y_top, y_bot = rule["x0"], rule["top"], rule["bottom"]
    instr = page.crop((40, head["bottom"] + 2, page.width - 40, y_top - 1)).extract_text() or ""
    instruction = join_lines(instr.splitlines())
    m = re.search(r"sobre o tema “([^”]+)”", instruction)
    if not m:
        raise SystemExit("tema entre aspas não encontrado na instrução")

    texts: dict[str, dict] = {}
    col_text = []
    for x0, x1 in ((40, x_mid - 1), (x_mid + 1, page.width - 40)):
        col = page.crop((x0, y_top - 2, x1, y_bot + 2))
        col_text.append(norm(join_lines((col.extract_text() or "").splitlines())))
        lines = col.extract_text_lines(return_chars=True)
        col_left = min(l["x0"] for l in lines)
        cur = None
        for ln in lines:
            kind = line_kind(ln["chars"])
            hm = re.fullmatch(r"TEXTO ([IVX]+)", ln["text"].strip())
            if hm and kind == "negrito":
                cur = {"roman": hm.group(1), "top": ln["top"], "col": (x0, x1), "blocks": [], "citation": [], "_par": None}
                texts[cur["roman"]] = cur
                continue
            if cur is None or kind == "vazia":
                continue
            if kind == "citacao":
                cur["citation"].append(ln["text"])
                cur["_par"] = None
            elif kind == "negrito":
                cur["blocks"].append({"type": "heading", "lines": [ln["text"]], "top": ln["top"]})
                cur["_par"] = None
            else:
                indent = ln["x0"] - col_left > 8
                if cur["_par"] is None or indent:
                    cur["_par"] = {"type": "paragraph", "lines": [], "top": ln["top"]}
                    cur["blocks"].append(cur["_par"])
                cur["_par"]["lines"].append(ln["text"])
            cur["bottom"] = ln["bottom"]
        # figuras da coluna: entram no texto cujo cabeçalho está acima, na posição vertical certa
        for im in page.images:
            if not (x0 <= im["x0"] < x1) or not (y_top <= im["top"] <= y_bot):
                continue
            owner = max((t for t in texts.values() if t["top"] < im["top"] and t["col"] == (x0, x1)), key=lambda t: t["top"])
            owner.setdefault("figures", []).append({"bbox": [im["x0"], im["top"], im["x1"], im["bottom"]]})

    out_texts = []
    page_text = " ".join(col_text)  # texto corrido de cada coluna (a leitura da página inteira mistura colunas)
    for pos, roman in enumerate(ROMAN, start=1):
        t = texts.get(roman)
        if not t:
            break
        blocks = []
        figs = t.get("figures", [])
        for k, b in enumerate(t["blocks"]):
            b["text"] = join_lines(b.pop("lines"))
            b["id"] = f"t{pos}b{k + 1}"
        for k, f in enumerate(figs):
            f["id"] = f"t{pos}f{k + 1}"
        # ordem vertical: blocos de texto e figuras intercalados pela posição na página
        seq = [(b["top"], "b", b) for b in t["blocks"]] + [(f["bbox"][1], "f", f) for f in figs]
        for _, kind, obj in sorted(seq, key=lambda s: s[0]):
            if kind == "b":
                blocks.append({"id": obj["id"], "type": obj["type"], "text": obj["text"]})
            else:
                blocks.append({"id": obj["id"], "type": "image", "bbox": [round(v, 2) for v in obj["bbox"]],
                               "text": ALT_PROPOSTO.get(roman, "")})
        citation = join_lines(t["citation"])
        for b in blocks:
            if b["type"] == "image":
                continue
            ws = b["text"].split()
            chunks = [" ".join(ws[j : j + 3]) for j in range(0, max(1, len(ws) - 2), 3)]
            missing = [c for c in chunks if norm(c) not in page_text]
            if missing:
                raise SystemExit(f"{path.name} texto {roman}: trechos não conferem com a página: {missing[:3]}")
        out_texts.append({"position": pos, "roman": roman, "blocks": blocks, "citation": citation})

    res = {"page": pi + 1, "theme": m.group(1), "instruction": instruction, "texts": out_texts}
    if with_figures:
        OUT.joinpath("figuras").mkdir(parents=True, exist_ok=True)
        doc = pdfium.PdfDocument(str(path))
        img = doc[pi].render(scale=DPI_SCALE).to_pil()
        # o desenho segue a CropBox; as coordenadas do pdfplumber seguem a MediaBox
        mx0, my0, mx1, my1 = doc[pi].get_mediabox()
        cx0, cy0, cx1, cy1 = doc[pi].get_cropbox()
        dx, dy = cx0 - mx0, my1 - cy1
        for t in out_texts:
            for b in t["blocks"]:
                if b["type"] != "image":
                    continue
                bx0, by0, bx1, by1 = b["bbox"]
                x0, y0, x1, y1 = ((bx0 - dx) * DPI_SCALE, (by0 - dy) * DPI_SCALE, (bx1 - dx) * DPI_SCALE, (by1 - dy) * DPI_SCALE)
                buf = io.BytesIO()
                img.crop((round(x0), round(y0), round(x1), round(y1))).save(buf, "PNG", optimize=True)
                data = buf.getvalue()
                sha = hashlib.sha256(data).hexdigest()
                (OUT / "figuras" / f"{sha}.png").write_bytes(data)
                b["png_sha256"] = sha
                b["asset_ref"] = f"temas/figuras/{sha}.png"
        page_png = io.BytesIO()
        doc[pi].render(scale=1.5).to_pil().save(page_png, "WEBP", quality=82)
        res["_page_webp"] = page_png.getvalue()
    return res


def comparable(r: dict) -> list:
    return [r["theme"], r["instruction"]] + [
        (t["roman"], t["citation"], [(b["type"], b.get("text") if b["type"] != "image" else None) for b in t["blocks"]])
        for t in r["texts"]
    ]


def main() -> int:
    main_res = extract(RAW / MAIN, with_figures=True)
    for other in OTHERS:
        if comparable(extract(RAW / other)) != comparable(main_res):
            raise SystemExit(f"proposta diverge entre {MAIN} e {other}")
    sha = hashlib.sha256((RAW / MAIN).read_bytes()).hexdigest()
    page_webp = main_res.pop("_page_webp")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "enem-2025-pagina.webp").write_bytes(page_webp)
    out = {
        "contract": "essay-prompt/v1",
        "origin": "oficial",
        "edition": "Enem 2025 — 1º dia (aplicação regular)",
        "source": {"file": MAIN, "sha256": sha, "page": main_res["page"], "locator": f"Caderno 1 Azul, p. {main_res['page']}"},
        "cross_checked_with": OTHERS,
        "theme": main_res["theme"],
        "instruction": main_res["instruction"],
        "texts": main_res["texts"],
        "page_image": {"asset_ref": f"temas/paginas/{sha}-{main_res['page']}.webp",
                       "sha256": hashlib.sha256(page_webp).hexdigest()},
        "note": "Texto alternativo das figuras é proposta de transcrição: conferir na revisão editorial antes de publicar.",
    }
    (OUT / "enem-2025.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(out["theme"])
    for t in out["texts"]:
        kinds = [b["type"] for b in t["blocks"]]
        print(t["roman"], kinds, "·", t["citation"][:90])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
