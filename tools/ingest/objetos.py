"""Objetos de conhecimento da matriz do Enem (anexo da matriz v1) → árvore de conteúdos.

Lê o PDF oficial (o mesmo do manifesto data/manifests/enem-documentos.json, conferido pelo hash) e grava
data/matriz/enem-objetos-v1.json: área → disciplina (quando a área divide) → tema → objeto, com a página.
A estrutura vem da tipografia do anexo: área em Black 34, disciplina em Bold 18, tema em Bold 15, objeto
como item com "•" em Regular 17 e continuação em Regular 13 recuada.

Uso: python3 objetos.py <matriz.pdf>
"""
from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

REPO = Path(__file__).resolve().parents[2]
AREAS = {
    "LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS": "LC",
    "MATEMÁTICA E SUAS TECNOLOGIAS": "MT",
    "CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS": "CN",
    "CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS": "CH",
}


def kind(line) -> str:
    chars = [c for c in line["chars"] if c["text"].strip()]
    font = Counter(c["fontname"].split("+")[-1] for c in chars).most_common(1)[0][0]
    size = round(Counter(round(c["size"]) for c in chars).most_common(1)[0][0])
    if "Black" in font and size >= 30:
        return "area"
    if "Bold" in font and size >= 17:
        return "disciplina"
    if "Bold" in font and size >= 14:
        return "tema"
    if line["text"].lstrip().startswith("•"):
        return "objeto"
    return "continua"


def main(pdf_path: str) -> None:
    raw = Path(pdf_path).read_bytes()
    docs = json.loads((REPO / "data/manifests/enem-documentos.json").read_text())
    mf = next(f for f in docs["files"] if f["kind"] == "matriz")
    if hashlib.sha256(raw).hexdigest() != mf["sha256"]:
        raise SystemExit("PDF diferente do registrado no manifesto")
    areas: dict[str, dict] = {}
    area = disc = tema = None
    area_buf: list[str] = []
    last = None  # o que recebe linhas de continuação
    with pdfplumber.open(pdf_path) as pdf:
        start = max(i for i, p in enumerate(pdf.pages) if "OBJETOS DE CONHECIMENTO" in (p.extract_text() or ""))
        for pn in range(start + 1, len(pdf.pages)):
            for line in pdf.pages[pn].extract_text_lines(return_chars=True):
                text = line["text"].strip()
                if "CARTILHA" in text or text.startswith("REDAÇÃO DO ENEM"):
                    break  # fim do anexo: começa outro documento no mesmo arquivo
                if not text or text.startswith(("MATRIZES DE REFERÊNCIA", "VOLTAR PARA", "O SUMÁRIO")) or text in ("ENEM",):
                    continue
                k = kind(line)
                if k == "area":
                    area_buf.append(text)
                    name = " ".join(area_buf)
                    if name in AREAS:
                        area = AREAS[name]
                        areas.setdefault(area, {"code": area, "disciplinas": []})
                        area_buf, disc, tema, last = [], None, None, None
                    continue
                area_buf = []
                if area is None:
                    continue
                a = areas[area]
                if k == "disciplina":
                    disc = {"label": text.title() if text.isupper() else text, "temas": [], "page": pn + 1}
                    a["disciplinas"].append(disc)
                    tema, last = None, None
                elif k == "tema":
                    if last is not None and last.get("_tema_open"):
                        last["label"] += " " + text
                        continue
                    if disc is None:  # área sem divisão por disciplina
                        disc = {"label": None, "temas": [], "page": pn + 1}
                        a["disciplinas"].append(disc)
                    tema = {"label": text, "objetos": [], "page": pn + 1, "_tema_open": True}
                    disc["temas"].append(tema)
                    last = tema
                elif k == "objeto":
                    if tema is None:
                        raise SystemExit(f"objeto sem tema na página {pn + 1}: {text}")
                    tema.pop("_tema_open", None)
                    obj = {"label": text.lstrip("• ").strip(), "page": pn + 1}
                    tema["objetos"].append(obj)
                    last = obj
                else:
                    if last is None:
                        continue
                    last["label"] += " " + text
    # a área inicial (LC) aparece com o nome depois do primeiro tema na página: os temas lidos antes do nome
    # caíram em área nula; o arquivo oficial começa por Linguagens, então isso não acontece se o nome vier antes.
    for a in areas.values():
        for d in a["disciplinas"]:
            for t in d["temas"]:
                t.pop("_tema_open", None)
    total = sum(len(t["objetos"]) for a in areas.values() for d in a["disciplinas"] for t in d["temas"])
    out = {
        "source": {"title": "Matrizes de referência do Enem, v1 (abril de 2026), anexo: objetos de conhecimento",
                   "url": mf["url"], "sha256": mf["sha256"]},
        "areas": [areas[c] for c in ("LC", "MT", "CN", "CH") if c in areas],
        "total_objetos": total,
    }
    # códigos curtos (área.tema.objeto[.assunto]) e subdivisões do Resolve
    extra = json.loads((REPO / "data/matriz/assuntos-resolve-v1.json").read_text())
    for a in out["areas"]:
        ti = 0
        for d in a["disciplinas"]:
            for t in d["temas"]:
                ti += 1
                t["code"] = f"{a['code']}.{ti}"
                for oi, o in enumerate(t["objetos"], 1):
                    o["code"] = f"{t['code']}.{oi}"
                    for prefix, subs in extra.get(a["code"], {}).items():
                        if o["label"].startswith(prefix):
                            o["assuntos"] = [{"code": f"{o['code']}.{si}", "label": lab} for si, lab in enumerate(subs, 1)]
    used = {k for a in out["areas"] for d in a["disciplinas"] for t in d["temas"] for o in t["objetos"] if "assuntos" in o
            for k in extra.get(a["code"], {}) if o["label"].startswith(k)}
    missing = {k for a in extra if a != "nota" for k in extra[a]} - used
    if missing:
        raise SystemExit(f"subdivisões sem objeto oficial correspondente: {missing}")
    path = REPO / "data/matriz/enem-objetos-v1.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for a in out["areas"]:
        print(a["code"], [(d["label"], len(d["temas"]), sum(len(t["objetos"]) for t in d["temas"])) for d in a["disciplinas"]])
    print("objetos:", total, "→", path)


def carregar() -> None:
    """Grava a árvore em subjects com a sessão de um editor (RESOLVE_EDITOR_*). Idempotente pelo código."""
    import urllib.parse
    from load_editorial import Api

    api = Api()
    data = json.loads((REPO / "data/matriz/enem-objetos-v1.json").read_text())
    src = api.rest("GET", "sources", query=f"?kind=eq.matriz&sha256=eq.{data['source']['sha256']}&select=id")[0]["id"]
    have = {r["code"]: r["id"] for r in api.rest("GET", "subjects", query="?select=id,code&code=not.is.null")}

    def put(code, label, area, kind, parent, position, page, official, note=None):
        if code in have:
            return have[code]
        row = {"code": code, "label": label[:200], "area_code": area, "kind": kind, "parent_id": parent, "position": position,
               "source_page": page, "source_id": src if official else None, "note": note}
        have[code] = api.rest("POST", "subjects", [row])[0]["id"]
        return have[code]

    n = 0
    for a in data["areas"]:
        for di, d in enumerate(a["disciplinas"], 1):
            dpar = put(f"{a['code']}.D{di}", d["label"], a["code"], "disciplina", None, di, d["page"], True) if d["label"] else None
            for t in d["temas"]:
                tid = put(t["code"], t["label"], a["code"], "tema", dpar, int(t["code"].split(".")[-1]), t["page"], True)
                for o in t["objetos"]:
                    oid = put(o["code"], o["label"], a["code"], "objeto", tid, int(o["code"].split(".")[-1]), o["page"], True)
                    n += 1
                    for x in o.get("assuntos", []):
                        put(x["code"], x["label"], a["code"], "assunto", oid, int(x["code"].split(".")[-1]), None, False,
                            "Subdivisão do Resolve dentro do objeto oficial (não é texto da matriz).")
                        n += 1
    print("árvore gravada:", len(have), "nós;", n, "objetos e assuntos")


if __name__ == "__main__":
    if sys.argv[1] == "carregar":
        carregar()
    else:
        main(sys.argv[1])
