"""Carga do tema oficial de redação (F5-T03) como RASCUNHO, pela sessão de um editor.

Lê data/redacao/temas/<arquivo>.json (gerado por temas.py) e:
1. localiza o caderno em `sources` pelo sha256;
2. envia ao bucket "editorial" a página do caderno e os recortes das figuras;
3. cria o tema (origem oficial, fonte e página) e os textos motivadores com a citação impressa.
   Os textos ficam "pendente": a conferência e a publicação são do editor, na tela /editor/temas.

Idempotente: se o tema já existe (mesma fonte e mesmo título), não cria outro.
Uso: RESOLVE_EDITOR_EMAIL=... RESOLVE_EDITOR_PASSWORD=... python load_temas.py [enem-2025]
"""
from __future__ import annotations

import json
import sys
import urllib.parse
from pathlib import Path

from load_editorial import Api

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
DIR = REPO / "data" / "redacao" / "temas"
BLOCK_KEYS = ("id", "type", "text", "asset_ref")  # chaves aceitas pelo banco (private.blocks_are_safe)


def main(name: str = "enem-2025") -> int:
    data = json.loads((DIR / f"{name}.json").read_text(encoding="utf-8"))
    api = Api()
    src = api.rest("GET", "sources", query=f"?select=id&sha256=eq.{data['source']['sha256']}")
    if not src:
        raise SystemExit(f"caderno {data['source']['file']} não está em sources (rode o manifesto da F2-T06)")
    source_id = src[0]["id"]

    api.upload(data["page_image"]["asset_ref"], (DIR / f"{name}-pagina.webp").read_bytes(), "image/webp")
    n_fig = 0
    for t in data["texts"]:
        for b in t["blocks"]:
            if b["type"] == "image":
                api.upload(b["asset_ref"], (DIR / "figuras" / f"{b['png_sha256']}.png").read_bytes(), "image/png")
                n_fig += 1

    q = f"?select=id,status&source_id=eq.{source_id}&title=eq." + urllib.parse.quote(data["theme"])
    found = api.rest("GET", "essay_prompts", query=q)
    if found:
        print(f"tema já existe ({found[0]['status']}): {found[0]['id']} — nada a criar; {n_fig} figura(s) reenviada(s)")
        return 0
    prompt = api.rest("POST", "essay_prompts", {
        "title": data["theme"], "instruction": data["instruction"], "origin": "oficial", "source_id": source_id,
        "source_locator": data["source"]["locator"], "edition": data["edition"], "generation_version": "temas.py/1",
    })[0]
    rows = []
    for t in data["texts"]:
        rows.append({
            "prompt_id": prompt["id"], "position": t["position"],
            "excerpt": "(derivado dos blocos)",
            "blocks": [{k: b[k] for k in BLOCK_KEYS if k in b} for b in t["blocks"]],
            "citation": t["citation"], "source_id": source_id,
            "page_or_locator": f"{data['source']['locator']}, Texto {t['roman']}",
        })
    api.rest("POST", "motivating_texts", rows)
    print(f"tema criado como rascunho: {prompt['id']} · {len(rows)} textos motivadores · {n_fig} figura(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(*sys.argv[1:]))
