"""Extração textual de cadernos do Enem (F2-T07).

Uso:
  python extract.py <arquivo.pdf> [--out data/extraction/x.json] [--review raw/review/prefixo]

Preserva página, coluna e caixa (bbox, pontos do PDF) de cada questão e de cada linha.
Segmenta em: texto-base (parágrafos), fonte/créditos, comando e alternativas A–E.
Figuras dentro da área da questão são listadas com a caixa no PDF (o recorte é F2-T08).
A saída é uma PROPOSTA para revisão humana: nada vai ao banco sem conferência (plano §5).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from dataclasses import dataclass, replace, field
from pathlib import Path

import pdfplumber

ALT_FONT = "BundesbahnPi"
QUESTION_RE = re.compile(r"^QUEST[ÃA]O\s+(\d{2,3})\b", re.I)
LANG_RE = re.compile(r"opção (inglês|espanhol)", re.I)
SOURCE_HINT = re.compile(r"(Disponível em|Acesso em|\(adaptado\)|\(fragmento\)|In:|Editora|\b\d{4}\b.*\.$)")
STOP_RE = re.compile(r"^(PROPOSTA DE REDA|INSTRUÇÕES PARA A REDA|FOLHA DE RASCUNHO|RASCUNHO)", re.I)
NOISE_RE = re.compile(r"^(\*[0-9A-Z]+\*|(ENEM20\d\d)+.*|ENEN20\d\d.*|(?:E?N?E?M)?20\d\d(?:E?N?E?M?)?)$")
# rodapé ("2 LINGUAGENS ... | 1º DIA | CADERNO 1 | AZUL") e restos da marca d'água
FOOTER_RE = re.compile(r"([|•]\s*\d+º DIA\s*[|•]|CADERNO \d+\s*[|•]\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+|(?:EN[EM]M?20\d\d){2,}|M20\d\dENEM|(?:ENE4202M){2,}|(?:4202MENE){2,})")


@dataclass
class Line:
    page: int
    column: int
    top: float
    bottom: float
    x0: float
    x1: float
    text: str
    size: float
    alt_letter: str | None = None
    bold: bool = False
    has_index: bool = False


@dataclass
class Question:
    number: int
    language: str | None
    lines: list[Line] = field(default_factory=list)
    figures: list[dict] = field(default_factory=list)


REDACAO_PAGE_RE = re.compile(r"PROPOSTA\s+DE\s+REDA|INSTRUÇÕES\s+PARA\s+A\s+REDA|FOLHA\s+DE\s+RASCUNHO", re.I)


def is_redacao_page(page) -> bool:
    return bool(REDACAO_PAGE_RE.search(page.extract_text(layout=False) or ""))


def footer_top(page) -> float:
    """Topo do rodapé ("… | 1º DIA | CADERNO 1 | AZUL"), localizado na própria página."""
    # 2025 separa com "|"; 2024 com "•"
    hits = page.search(r"\d+º\s*DIA\s*[|•]") or page.search(r"CADERNO\s+\d+\s*[|•]")
    tops = [m["top"] for m in hits if m["top"] > page.height * 0.8]
    return (min(tops) - 4) if tops else page.height - 38


SUB = str.maketrans("0123456789+-−=()", "₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎")
SUP = str.maketrans("0123456789+-−=()", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾")


def body_size_of(raw: list[dict]) -> float:
    sizes = sorted(c["size"] for ln in raw for c in ln["chars"] if c["text"].strip())
    return sizes[len(sizes) // 2] if sizes else 10.0


def reassign_index_chars(raw: list[dict], body: float) -> list[dict]:
    """Linhas formadas só por índices pequenos: cada caractere vai para a linha de base cuja faixa
    vertical está mais próxima (subscrito → linha acima; sobrescrito → linha abaixo)."""
    def index_only(ln: dict) -> bool:
        cs = [c for c in ln["chars"] if c["text"].strip()]
        return (0 < len(cs) <= 8 and all(c["size"] < body * 0.8 for c in cs)
                and all(c["text"].isdigit() or c["text"] in "+-−=()nxyabc" for c in cs)
                and any(c["text"].isdigit() for c in cs))

    base = [ln for ln in raw if not index_only(ln)]
    out = [dict(ln, chars=list(ln["chars"])) for ln in base]
    for ln in raw:
        if not index_only(ln):
            continue
        near = [b for b in out if min(abs(ln["top"] - b["bottom"]), abs(b["top"] - ln["bottom"]), 0 if b["top"] <= ln["top"] <= b["bottom"] else 99) <= 6]
        if not near:
            out.append(dict(ln, chars=list(ln["chars"])))
            continue
        for c in ln["chars"]:
            if not c["text"].strip():
                continue
            cy = (c["top"] + c["bottom"]) / 2
            cand = [b for b in near if b["x0"] - 5 <= c["x0"] <= b["x1"] + 5] or near
            if not cand:
                continue
            best = min(cand, key=lambda b: 0 if b["top"] - 3 <= cy <= b["bottom"] + 3 else min(abs(cy - b["top"]), abs(cy - b["bottom"])))
            best["chars"].append(c)
    return sorted(out, key=lambda l: l["top"])


def line_text(chars: list[dict], body: float) -> tuple[str, int, int]:
    """Texto da linha com índices numéricos convertidos em Unicode. Devolve (texto, convertidos, não convertidos)."""
    from pdfplumber.utils import extract_text as px_text

    # caracteres repetidos na mesma posição (a ligadura "fi" vem duplicada nos cadernos de 2024)
    seen: set = set()
    uniq = []
    for c in chars:
        k = (c["text"], round(c["x0"], 1), round(c["top"], 1))
        if k in seen and c["text"].strip():
            continue
        seen.add(k)
        uniq.append(c)
    chars = uniq
    big = [c for c in chars if c["text"].strip() and c["size"] >= body * 0.8]
    if not big:
        return re.sub(r"\s+", " ", px_text(chars, x_tolerance=1.5, y_tolerance=30, keep_blank_chars=True)).strip(), 0, 0
    tops = sorted(c["top"] for c in big)
    bottoms = sorted(c["bottom"] for c in big)
    base_top, base_bottom = tops[len(tops) // 2], bottoms[len(bottoms) // 2]
    conv = left = 0
    fixed = []
    for c in chars:
        t = c["text"]
        if t.strip() and c["size"] < body * 0.8 and c["size"] < base_bottom - base_top:
            cy = (c["top"] + c["bottom"]) / 2
            table = SUB if cy > (base_top + base_bottom) / 2 else SUP
            new = t.translate(table)
            if new != t:
                conv += 1
            elif t.isalpha():
                left += 1
            t = new
        fixed.append(dict(c, text=t, top=base_top, bottom=base_bottom))
    # keep_blank_chars: o caractere de espaço do PDF separa as palavras mesmo quando o vão entre as letras
    # vizinhas é menor que a tolerância (linhas justificadas apertadas grudavam palavras).
    text = px_text(fixed, x_tolerance=1.5, y_tolerance=30, keep_blank_chars=True).replace("\n", " ").strip()
    # o símbolo de grau vem duplicado em alguns cadernos (dois glifos sobrepostos)
    return re.sub(r"\s+", " ", text).replace("°°", "°"), conv, left


def bands(body, gutter: float, top: float, bottom: float) -> list[tuple[float, float, bool]]:
    """Faixas verticais da página: (y0, y1, largura_total). Uma questão pode ocupar a largura toda
    (linhas que atravessam a calha sem lacuna); o restante segue em duas colunas."""
    lines = body.extract_text_lines(return_chars=True)

    def is_wide(ln: dict) -> bool:
        cs = sorted((c for c in ln["chars"] if c["text"].strip()), key=lambda c: c["x0"])
        if not cs or cs[0]["x0"] > gutter - 20 or cs[-1]["x1"] < gutter + 20:
            return False
        return all(b["x0"] - a["x1"] < 8 for a, b in zip(cs, cs[1:]) if a["x1"] <= gutter + 8 and b["x0"] >= gutter - 8)

    wide = sorted((ln for ln in lines if is_wide(ln)), key=lambda ln: ln["top"])
    if not wide:
        return [(top, bottom, False)]
    groups: list[list[float]] = []
    for ln in wide:
        if groups and ln["top"] - groups[-1][1] < 30:
            groups[-1][1] = ln["bottom"]
        else:
            groups.append([ln["top"], ln["bottom"]])
    right = [ln for ln in lines if ln["x0"] >= gutter - 2]
    out: list[tuple[float, float, bool]] = []
    cursor = top
    for g0, g1 in groups:
        # o cabeçalho "QUESTÃO N" logo acima da faixa larga pertence a ela
        head = [ln for ln in lines if QUESTION_RE.match(ln["text"].strip()) and 0 < g0 - ln["bottom"] < 30 and ln["top"] >= cursor]
        if head:
            g0 = min(ln["top"] for ln in head)
        # a faixa continua para baixo até a coluna da direita voltar
        nxt = [ln["top"] for ln in right if ln["top"] > g1 and not is_wide(ln)]
        g1 = min(nxt) - 1 if nxt else bottom
        if g1 <= cursor + 1:
            continue
        if g0 - 1 > cursor:
            out.append((cursor, g0 - 1, False))
        out.append((max(cursor, g0 - 1), g1, True))
        cursor = g1
    if cursor < bottom - 1:
        out.append((cursor, bottom, False))
    return out


def page_lines(page, pno: int) -> list[Line]:
    w, h = page.width, page.height
    bottom = footer_top(page)
    # remove cabeçalho (código de barras, logotipo), rodapé e o microtexto da marca d'água (corpo 1,5)
    body = page.crop((0, 90, w, bottom)).filter(lambda o: not (o.get("object_type") == "char" and o.get("size", 10) < 3))
    # Duas colunas? Procura a faixa vertical mais vazia no meio da página (a calha nem sempre
    # fica no centro exato). Coluna única: toda faixa central é cruzada pela maioria das linhas.
    rows: dict[int, list[tuple[float, float]]] = {}
    for c in body.chars:
        if c["text"].strip() and c["size"] >= 6:
            rows.setdefault(int(c["top"] // 4), []).append((c["x0"], c["x1"]))
    gutter, best = w / 2, 1.0
    if len(rows) >= 20:
        for x in [w * 0.35 + i * 2 for i in range(int(w * 0.30 / 2))]:
            covered = sum(1 for spans in rows.values() if any(a - 1 <= x <= b + 1 for a, b in spans))
            frac = covered / len(rows)
            if frac < best:
                best, gutter = frac, x
    two_cols = len(rows) >= 20 and best < 0.2
    if two_cols:
        regions = []
        for y0, y1, full in bands(body, gutter, 90, bottom):
            if full:
                regions.append((0, body.crop((0, y0, w, y1))))
            else:
                regions += [(0, body.crop((0, y0, gutter, y1))), (1, body.crop((gutter, y0, w, y1)))]
    else:
        regions = [(0, body)]
    out: list[Line] = []
    for col, reg in regions:
        # y_tolerance maior junta sub/sobrescritos à linha de base (S₁ não vira linha solta)
        raw = reg.extract_text_lines(keep_blank_chars=True, use_text_flow=False, return_chars=True)
        body_sz = body_size_of(raw)
        for ln in reassign_index_chars(raw, body_sz):
            text, n_conv, n_left = line_text(ln["chars"], body_sz)
            if not text or NOISE_RE.match(text):
                continue
            if FOOTER_RE.search(text):
                text = FOOTER_RE.split(text)[0].strip()
                text = re.sub(r"\s*\d{1,2}\s+(LINGUAGENS|CIÊNCIAS|MATEMÁTICA).*$", "", text).strip()
                if not text:
                    continue
            chars = [c for c in ln["chars"] if c["text"].strip()]
            first = chars[0] if chars else None
            alt = first["text"] if first and ALT_FONT in first.get("fontname", "") and first["text"] in "ABCDE" else None
            if alt:  # remove a letra-glifo do início do texto
                text = text[1:].strip() if text.startswith(alt) else text
            sizes = sorted(c["size"] for c in chars) or [0]
            bold = bool(chars) and sum("Bold" in c.get("fontname", "") for c in chars) > 0.6 * len(chars)
            med = sizes[len(sizes) // 2]
            has_index = n_left > 0 or n_conv > 0
            out.append(Line(pno, col, ln["top"], ln["bottom"], ln["x0"], ln["x1"], text, med, alt, bold, has_index))
    return out


def segment(pdf) -> tuple[list[Question], list[str]]:
    questions: list[Question] = []
    warnings: list[str] = []
    language: str | None = None
    current: Question | None = None
    for pno, page in enumerate(pdf.pages, start=1):
        if pno == 1:
            continue  # capa
        if pno == len(pdf.pages) and not re.search(r"QUEST[ÃA]O\s+\d{2,3}", page.extract_text() or "", re.I):
            current = None  # contracapa: grade de cores e instruções, nunca parte de uma questão
            continue
        if is_redacao_page(page):
            current = None  # proposta de redação, instruções ou rascunho: fora de qualquer questão
            continue
        lines = page_lines(page, pno)
        for ln in lines:
            m_lang = LANG_RE.search(ln.text)
            if m_lang and ln.bold:
                language = "ingles" if m_lang.group(1).lower() == "inglês" else "espanhol"
                continue
            if STOP_RE.match(ln.text):
                current = None  # proposta de redação / rascunho: fora de qualquer questão
                continue
            m = QUESTION_RE.match(ln.text)
            if m:
                n = int(m.group(1))
                if n > 5:
                    language = None
                current = Question(n, language if n <= 5 else None)
                questions.append(current)
                continue
            if current is None or ln.bold and re.match(r"^(LINGUAGENS|CIÊNCIAS|MATEMÁTICA|Questões de)", ln.text):
                continue
            current.lines.append(ln)
        # figuras: imagens rasterizadas dentro da página; atribuídas à questão cujas linhas as cercam
        for img in page.images:
            if img["top"] < 90 or img["bottom"] > footer_top(page) or (img["x1"] - img["x0"]) < 40:
                continue
            owner = None
            for q in questions:
                ls = [l for l in q.lines if l.page == pno]
                if not ls:
                    continue
                cx = (img["x0"] + img["x1"]) / 2
                in_col = min(l.x0 for l in ls) - 15 <= cx <= max(l.x1 for l in ls) + 15
                if in_col and min(l.top for l in ls) - 40 <= img["top"] <= max(l.bottom for l in ls) + 20:
                    owner = q
            if owner:
                owner.figures.append({"page": pno, "kind": "imagem", "bbox": [round(img["x0"], 1), round(img["top"], 1), round(img["x1"], 1), round(img["bottom"], 1)]})
        # desenhos vetoriais (gráficos, circuitos, alternativas em figura): agrupa traços por questão
        strokes = [o for o in page.curves + page.rects + page.lines
                   if 90 < o["top"] and o["bottom"] < page.height - 38 and not (o["bottom"] - o["top"] < 4 and o["x1"] - o["x0"] > 250)]
        for q in questions:
            ls = [l for l in q.lines if l.page == pno]
            if not ls:
                continue
            top, bottom = min(l.top for l in ls) - 6, max(l.bottom for l in ls) + 6
            left, right = min(l.x0 for l in ls) - 12, max(l.x1 for l in ls) + 12
            # só traços na faixa vertical E horizontal da questão (não pega a coluna vizinha)
            mine = [o for o in strokes if o["top"] >= top and o["bottom"] <= bottom + 120 and o["x0"] >= left and o["x1"] <= right]
            if len(mine) >= 6:
                q.figures.append({"page": pno, "kind": "vetorial", "strokes": len(mine),
                                  "bbox": [round(min(o["x0"] for o in mine), 1), round(min(o["top"] for o in mine), 1),
                                           round(max(o["x1"] for o in mine), 1), round(max(o["bottom"] for o in mine), 1)]})
    return questions, warnings


def stack_fractions(lines: list[Line]) -> tuple[list[Line], int]:
    """Alternativa em fração empilhada: o numerador vem antes da letra e o denominador depois,
    ambos sobrepostos verticalmente à letra. Junta em "numerador/denominador"."""
    out: list[Line] = []
    i, n_frac = 0, 0
    while i < len(lines):
        ln = lines[i]
        nxt = lines[i + 1] if i + 1 < len(lines) else None
        if out and nxt and ln.alt_letter and not ln.text:
            num = out[-1]
            same = num.page == ln.page == nxt.page and num.column == ln.column == nxt.column
            if (same and not num.alt_letter and not nxt.alt_letter and num.x0 > ln.x0 and nxt.x0 > ln.x0
                    and num.top < ln.top < num.bottom and nxt.top < ln.bottom < nxt.bottom
                    and re.fullmatch(r"[\w,.−\-+ ]{1,12}", num.text) and re.fullmatch(r"[\w,.−\-+ ]{1,12}", nxt.text)):
                out[-1] = replace(ln, top=num.top, bottom=nxt.bottom, x1=max(num.x1, nxt.x1), text=f"{num.text}/{nxt.text}")
                n_frac += 1
                i += 2
                continue
        out.append(ln)
        i += 1
    return out, n_frac


def structure(q: Question) -> dict:
    alts: dict[str, list[Line]] = {}
    pre: list[Line] = []
    cur = None
    lines, n_frac = stack_fractions(q.lines)
    for ln in lines:
        if ln.alt_letter:
            cur = ln.alt_letter
            alts.setdefault(cur, []).append(ln)
        elif cur:
            alts[cur].append(ln)
        else:
            pre.append(ln)
    # fonte/créditos: linha(s) em corpo menor ou com marcas bibliográficas, antes do comando
    body_size = sorted(l.size for l in pre)[len(pre) // 2] if pre else 10
    src_idx = [i for i, l in enumerate(pre) if (l.size < body_size - 0.6 or SOURCE_HINT.search(l.text)) and i > 0]
    if src_idx:
        last_src = src_idx[-1]
        first_src = last_src
        while first_src - 1 in src_idx:
            first_src -= 1
        stimulus, source, command = pre[:first_src], pre[first_src:last_src + 1], pre[last_src + 1:]
    else:
        # sem crédito: comando = último parágrafo (separado por espaço vertical maior)
        cut = len(pre)
        for i in range(len(pre) - 1, 0, -1):
            if pre[i].page == pre[i - 1].page and pre[i].top - pre[i - 1].bottom > 0.6 * (pre[i].bottom - pre[i].top):
                cut = i
                break
        stimulus, source, command = pre[:cut], [], pre[cut:]
        if cut == len(pre):
            stimulus, command = [], pre

    right_edge = {}
    for l in q.lines:
        key = (l.page, l.column)
        right_edge[key] = max(right_edge.get(key, 0), l.x1)

    def paragraphs(ls: list[Line]) -> list[str]:
        paras: list[list[Line]] = []
        for l in ls:
            if paras and l.page == paras[-1][-1].page and l.top - paras[-1][-1].bottom < 0.5 * (l.bottom - l.top) and l.x0 - paras[-1][-1].x0 < 8:
                paras[-1].append(l)
            else:
                paras.append([l])
        out = []
        for p in paras:
            # versos: a maioria das linhas termina bem antes da margem direita → preserva quebras
            inner = p[:-1]
            short = [l for l in inner if l.x1 < right_edge[(l.page, l.column)] - 40]
            verse = len(p) >= 2 and len(short) >= max(1, 0.6 * len(inner))
            out.append("\n".join(re.sub(r"\s+", " ", l.text).strip() for l in p) if verse else join(p))
        return out

    blocks = []
    for i, t in enumerate(paragraphs(stimulus), start=1):
        blocks.append({"id": f"s{i}", "type": "paragraph", "text": t})
    if source:
        blocks.append({"id": "src", "type": "source", "text": join(source)})
    pages = sorted({l.page for l in q.lines})
    warnings = []
    if n_frac:
        warnings.append(f"fração empilhada em {n_frac} alternativa(s): reconstruída como a/b; conferir")
    empty = [k for k, v in alts.items() if not join(v)]
    if empty:
        warnings.append(f"alternativa(s) sem texto {''.join(empty)}: provavelmente figura")
    if sorted(alts) != list("ABCDE"):
        warnings.append(f"alternativas encontradas: {''.join(sorted(alts)) or 'nenhuma'}")
    if not command:
        warnings.append("comando não identificado")
    if q.figures:
        warnings.append("contém figura: conferir se parte do texto está na imagem")
    idx = [l.text[:40] for l in q.lines if l.has_index and l not in source]
    if idx:
        warnings.append(f"índices (sub/sobrescrito) em {len(idx)} linha(s): convertidos quando numéricos; conferir fórmulas")
    return {
        "number": q.number,
        "foreign_language": q.language,
        "pages": pages,
        "bbox_by_page": {str(p): bbox([l for l in q.lines if l.page == p]) for p in pages},
        "stimulus_blocks": blocks,
        "command": join(command),
        "alternatives": {k: join(v) for k, v in sorted(alts.items())},
        "figures": q.figures,
        "warnings": warnings,
        "line_count": len(q.lines),
    }


def join(ls: list[Line]) -> str:
    out = ""
    for l in ls:
        t = l.text
        if out.endswith("-") and t[:1].islower():
            out = out[:-1] + t  # hifenização de fim de linha
        else:
            out = (out + " " + t).strip()
    return re.sub(r"\s+", " ", out).strip()


def bbox(ls: list[Line]) -> list[float]:
    return [round(min(l.x0 for l in ls), 1), round(min(l.top for l in ls), 1), round(max(l.x1 for l in ls), 1), round(max(l.bottom for l in ls), 1)] if ls else []


def review_images(pdf_path: Path, result: list[dict], prefix: Path, numbers: set[tuple[int, str | None]] | None = None) -> list[str]:
    """Desenha a caixa de cada questão (e das figuras) sobre a página original, para conferência."""
    import pypdfium2 as pdfium
    from PIL import ImageDraw

    scale = 1.4
    doc = pdfium.PdfDocument(str(pdf_path))
    pages = sorted({int(p) for q in result if numbers is None or (q["number"], q["foreign_language"]) in numbers for p in q["bbox_by_page"]})
    files = []
    for p in pages:
        page = doc[p - 1]
        img = page.render(scale=scale).to_pil().convert("RGB")
        d = ImageDraw.Draw(img)
        # pdfplumber usa coordenadas da MediaBox (origem no topo); o pdfium desenha a CropBox.
        cx0, cy0, cx1, cy1 = page.get_cropbox()
        mx0, my0, mx1, my1 = page.get_mediabox()
        dx, dy = cx0 - mx0, my1 - cy1

        def T(b):  # caixa [x0, top, x1, bottom] da MediaBox → pixels da imagem renderizada
            return [(b[0] - dx) * scale, (b[1] - dy) * scale, (b[2] - dx) * scale, (b[3] - dy) * scale]

        for q in result:
            if numbers is not None and (q["number"], q["foreign_language"]) not in numbers:
                continue
            b = q["bbox_by_page"].get(str(p))
            if b:
                d.rectangle(T([b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3]), outline=(36, 82, 209), width=3)
                x, y = T(b)[:2]
                d.text((x, y - 14 * scale), f"Q{q['number']}{(' ' + q['foreign_language']) if q['foreign_language'] else ''}", fill=(36, 82, 209))
            for f in q["figures"]:
                if f["page"] == p:
                    d.rectangle(T(f["bbox"]), outline=(232, 140, 174), width=3)
        out = prefix.with_name(f"{prefix.name}_p{p:02d}.png")
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out)
        files.append(str(out))
    return files


def main() -> int:
    pdf_path = Path(sys.argv[1])
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else None
    review = Path(sys.argv[sys.argv.index("--review") + 1]) if "--review" in sys.argv else None
    pdf = pdfplumber.open(str(pdf_path))
    qs, warnings = segment(pdf)
    result = [structure(q) for q in qs]
    doc = {
        "file": pdf_path.name,
        "sha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
        "extractor": "tools/ingest/extract.py v0.1 (pdfplumber)",
        "status": "proposta_para_revisao",
        "questions": result,
        "warnings": warnings,
    }
    n_ok = sum(1 for q in result if not [w for w in q["warnings"] if not w.startswith("contém figura")])
    print(f"{pdf_path.name}: {len(result)} questões · {n_ok} sem alerta estrutural · {sum(bool(q['figures']) for q in result)} com figura")
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if review:
        review_images(pdf_path, result, review)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
