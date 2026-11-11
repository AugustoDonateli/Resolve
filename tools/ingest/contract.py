"""Contrato de estruturação e fila de dúvidas (F2-T09).

- validate(payload) → {"status": "valida"|"duvida"|"rejeitada", "errors": [...], "doubts": [...]}
  rejeitada: viola o contrato (JSON Schema) ou contém conteúdo perigoso (HTML, script,
             URL javascript:/data:, caracteres de controle ou de inversão de direção);
  duvida:    estrutura incompleta ou incerta (alternativa sem conteúdo, comando ausente,
             figura não ligada, índice de letra, avisos do extrator);
  valida:    pronta para revisão editorial (nunca para publicação direta).
- from_extraction(...) converte a saída de extract.py (+ recortes de figures.py) em proposta.

Uso: python contract.py raw/extraction/D1_CD1.json raw/extraction/D2_CD7.json
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

from jsonschema import Draft202012Validator

REPO = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((REPO / "data" / "contracts" / "item-proposal.v1.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA)
CONTRACT = "item-proposal/v1"

# Conteúdo perigoso: marcação/HTML, esquemas de URL executáveis, manipuladores de evento.
# Tag HTML exige o nome colado ao "<" (assim "2 < x e x > 1" continua sendo matemática).
HTML_TAG = re.compile(r"<[a-zA-Z][a-zA-Z0-9-]*(?:[\s/][^<>]*)?>|</[a-zA-Z][^<>]*>|<[!?]")
DANGEROUS = re.compile(r"(javascript\s*:|vbscript\s*:|data\s*:\s*text/html|\bon[a-z]{3,}\s*=|&#x?0*3c;?|&lt;\s*script)", re.I)
BIDI = re.compile("[‪-‮⁦-⁩‎‏]")
ZERO_WIDTH = re.compile("[​-‍⁠﻿]")

AREA_BY_RANGE = [((1, 45), "LC"), ((46, 90), "CH"), ((91, 135), "CN"), ((136, 180), "MT")]


def area_for(number: int) -> str:
    return next(a for (lo, hi), a in AREA_BY_RANGE if lo <= number <= hi)


def text_problems(t: str) -> list[str]:
    out = []
    if HTML_TAG.search(t):
        out.append("marcação HTML no texto")
    if DANGEROUS.search(t):
        out.append("padrão executável (javascript:, on*=, entidade de '<')")
    if BIDI.search(t):
        out.append("caractere de inversão de direção de texto")
    if any(unicodedata.category(ch) == "Cc" and ch not in "\n\t" for ch in t):
        out.append("caractere de controle")
    return out


def iter_blocks(p: dict):
    for b in p.get("stimulus_blocks", []):
        yield "texto-base", b
    for b in p.get("command_blocks", []):
        yield "comando", b
    for k, blocks in (p.get("alternatives") or {}).items():
        for b in blocks:
            yield f"alternativa {k}", b


def validate(p: dict) -> dict:
    errors = [f"contrato: {'/'.join(map(str, e.absolute_path)) or '(raiz)'}: {e.message}" for e in VALIDATOR.iter_errors(p)]
    doubts: list[str] = []
    if not errors:
        ids = [b["id"] for _, b in iter_blocks(p)]
        if len(ids) != len(set(ids)):
            errors.append("contrato: ids de bloco repetidos")
        fig_ids = {f["id"] for f in p["figures"]}
        for where, b in iter_blocks(p):
            for prob in text_problems(b.get("text", "")):
                errors.append(f"conteúdo perigoso em {where} ({b['id']}): {prob}")
            if ZERO_WIDTH.search(b.get("text", "")):
                doubts.append(f"caractere invisível em {where} ({b['id']})")
            if b["type"] == "image" and b.get("asset_ref") not in fig_ids:
                errors.append(f"contrato: {where} aponta para figura inexistente ({b.get('asset_ref')})")
        for prob in text_problems(json.dumps(p["producer"], ensure_ascii=False)):
            errors.append(f"conteúdo perigoso em producer: {prob}")
        if p["area"] != area_for(p["number"]):
            errors.append(f"área {p['area']} incompatível com a questão {p['number']}")
        if p["source"]["day"] == 1 and p["number"] <= 5 and p["foreign_language"] is None:
            errors.append("questões 1–5 do dia 1 exigem opção de língua estrangeira")
        if (p["number"] > 5 or p["source"]["day"] != 1) and p["foreign_language"] is not None:
            errors.append("opção de língua só vale para as questões 1–5 do dia 1")
        # dúvidas estruturais
        for k, blocks in p["alternatives"].items():
            if all(b["type"] != "image" and not b.get("text", "").strip() for b in blocks):
                doubts.append(f"alternativa {k} sem conteúdo")
        if not any(b.get("text", "").strip() for b in p["command_blocks"]):
            doubts.append("comando vazio")
        doubts.extend(p["doubts"])
    status = "rejeitada" if errors else ("duvida" if doubts else "valida")
    return {"status": status, "errors": errors, "doubts": sorted(set(doubts))}


def from_extraction(q: dict, booklet: dict, figures: list[dict] | None = None, producer: dict | None = None) -> dict:
    """Converte uma questão de extract.py (e recortes de figures.py) numa proposta v1."""
    figures = [f for f in (figures or []) if f["question"] == q["number"] and f["foreign_language"] == q["foreign_language"]]
    figs = []
    for i, f in enumerate(figures, start=1):
        figs.append({"id": f"fig{i}", "role": f["role"], "kind": f["kind"], "page": f["page"], "bbox_pt": f["bbox_pt"], "png_sha256": f["sha256"]})
    by_alt = {f["role"][-1]: f["id"] for f in figs if f["role"].startswith("alternativa")}
    alts = {}
    for k in "ABCDE":
        text = q["alternatives"].get(k, "")
        blocks = [{"id": f"a{k.lower()}", "type": "paragraph", "text": text}] if text else []
        if k in by_alt:
            blocks.append({"id": f"a{k.lower()}img", "type": "image", "asset_ref": by_alt[k]})
        alts[k] = blocks or [{"id": f"a{k.lower()}", "type": "paragraph", "text": ""}]
    stim = [dict(b) for b in q["stimulus_blocks"]]
    stim += [{"id": f["id"] + "b", "type": "table" if f["kind"] == "tabela" else "image", "asset_ref": f["id"]} for f in figs if f["role"] == "texto-base/comando" and f["kind"] != "tabela"]
    for f in figs:
        if f["role"] == "texto-base/comando" and f["kind"] == "tabela":
            stim.append({"id": f["id"] + "b", "type": "image", "asset_ref": f["id"]})
    doubts = [w for w in q["warnings"] if not w.startswith("contém figura")]
    if any(w.startswith("contém figura") for w in q["warnings"]) and not figs:
        doubts.append("figura detectada sem recorte (F2-T08)")
    return {
        "contract": CONTRACT,
        "source": {
            "booklet_file": booklet["file"],
            "booklet_sha256": booklet["sha256"],
            "day": int(booklet["day"]),
            "booklet": int(booklet["booklet"]),
            "pages": q["pages"],
            "bbox_by_page": q["bbox_by_page"],
        },
        "number": q["number"],
        "foreign_language": q["foreign_language"],
        "area": area_for(q["number"]),
        "stimulus_blocks": stim,
        "command_blocks": [{"id": "c1", "type": "paragraph", "text": q["command"]}] if q["command"] else [{"id": "c1", "type": "paragraph", "text": ""}],
        "alternatives": alts,
        "figures": figs,
        "producer": producer or {"kind": "extrator", "tool": "tools/ingest/extract.py", "version": "0.1"},
        "doubts": doubts,
    }


def _booklet_meta(path: Path, data: dict) -> dict:
    m = re.search(r"_D(\d)_CD(\d+)", data["file"])
    return {"file": data["file"], "sha256": data["sha256"], "day": m.group(1), "booklet": m.group(2)}


def main() -> int:
    figs_path = REPO / "data" / "extraction" / "enem-2025-piloto-figuras.json"
    figures = json.loads(figs_path.read_text(encoding="utf-8"))["figures"] if figs_path.exists() else []
    summary = {"contract": CONTRACT, "booklets": []}
    out_dir = Path(__file__).resolve().parent / "raw" / "proposals"
    out_dir.mkdir(parents=True, exist_ok=True)
    for arg in sys.argv[1:]:
        path = Path(arg)
        data = json.loads(path.read_text(encoding="utf-8"))
        meta = _booklet_meta(path, data)
        rows = []
        for q in data["questions"]:
            figs = [f for f in figures if f["booklet_file"] == data["file"]]
            p = from_extraction(q, meta, figs)
            v = validate(p)
            rows.append({"number": q["number"], "foreign_language": q["foreign_language"], **v})
            (out_dir / f"{path.stem}_Q{q['number']:03d}{'_' + q['foreign_language'] if q['foreign_language'] else ''}.json").write_text(
                json.dumps({"payload": p, "validation": v}, ensure_ascii=False, indent=2), encoding="utf-8")
        counts = {s: sum(1 for r in rows if r["status"] == s) for s in ("valida", "duvida", "rejeitada")}
        kinds: dict[str, int] = {}
        for r in rows:
            for d in r["doubts"]:
                k = re.sub(r"\d+", "#", d.split(":")[0])
                kinds[k] = kinds.get(k, 0) + 1
        summary["booklets"].append({"file": data["file"], "sha256": data["sha256"], "counts": counts, "doubt_kinds": kinds,
                                    "queue": [r for r in rows if r["status"] != "valida"]})
        print(f"{data['file']}: {counts} · dúvidas por tipo: {kinds}")
    (REPO / "data" / "extraction" / f"enem-{os.environ.get('ENEM_ANO', '2025')}-validacao-contrato.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
