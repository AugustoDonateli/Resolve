"""Anotação editorial das questões publicadas (sessão 2 do plano v2).

    python3 anotar.py exportar <pasta>        # questões por área em texto compacto, para ler e anotar
    python3 anotar.py carregar <arquivos.jsonl...>  # grava as propostas (item_annotation_proposals), sessão de editor

Cada linha do .jsonl é uma questão:
  {"q": "<ano>-<posição no caderno azul>[i|e para inglês/espanhol]", "h": "H18", "h2": "H19"|null, "s": "<código do assunto>", "d": 0..3,
   "ev": [["<id do bloco>", "<trecho literal>", "<por que sustenta>"]],
   "dis": {"<letra estável>": ["<tipo>", "<tipo secundário ou nenhum>", "<justificativa>"]},
   "p": ["<passo 1>", "<passo 2>"], "inc": ["<incerteza>"]}
As letras de "dis" são as letras estáveis da questão (as do caderno azul). O trecho de evidência precisa ser cópia
literal do bloco; o carregador acha a posição (UTF-16, como o app) e recusa trecho que não existe.
As propostas não chegam ao aluno: a aprovação é do editor (approve_item_annotation).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

from load_editorial import Api

REPO = Path(__file__).resolve().parents[2]
ORIGIN = "sessão 2 do plano v2 (Claude Code, leitura de cada questão)"


def text_of(blocks) -> list[tuple[str, str]]:
    out = []
    for b in blocks or []:
        t = b.get("text")
        if t is None and b.get("rows"):
            t = " / ".join(" | ".join(str(c) for c in r) for r in b["rows"])
        if t is None and b.get("items"):
            t = " ; ".join(str(i) for i in b["items"])
        kind = b.get("type", "")
        if kind in ("figure", "image"):
            t = f"[figura: {b.get('alt') or b.get('alt_text') or 'sem texto alternativo'}]"
        out.append((b.get("id", "?"), t or f"[{kind}]"))
    return out


KEYS = Path("/tmp/claude-0/-home-user-Resolve/8af7aac1-5545-51e1-bc81-f3299c2829b3/scratchpad/tri")


def load_items(api: Api, keys_dir: Path = KEYS) -> list[dict]:
    """Questões publicadas com o gabarito oficial por posição (chaves-<ano>.json, exportado com CHAVES_SQL de
    tri_inep.py). A letra estável é a letra impressa nos cadernos azul e amarelo (conferido no banco)."""
    rows = api.rest("GET", "study_items", query="?select=item_version_id,item_id,area,foreign_language,stimulus_blocks,command_blocks,alternatives,appearances,annotation_status,stimulus_version_id&annulled=eq.false")
    keys = {y: json.loads((keys_dir / f"chaves-{y}.json").read_text()) for y in (2024, 2025)}
    for r in rows:
        ap = next(a for a in r["appearances"] if a["color"] == "Azul")
        lang = r.get("foreign_language")
        suffix = {"ingles": "i", "espanhol": "e"}.get(lang or "", "")
        r["q"] = f"{ap['year']}-{ap['position']}{suffix}"
        bn = "1" if ap["position"] <= 90 else "7"
        r["key"] = keys[ap["year"]][f"{bn}|{lang or '-'}"][str(ap["position"])]
    rows.sort(key=lambda r: (r["area"], r["q"].split("-")[0], int("".join(c for c in r["q"].split("-")[1] if c.isdigit())), r["q"]))
    return rows


def cmd_exportar(folder: str) -> None:
    api = Api()
    rows = load_items(api)
    stats = {s["item_id"]: s for s in api.rest("GET", "item_response_stats", query="?select=item_id,respondents,correct,alternatives,alternatives_respondents")}
    out = Path(folder)
    out.mkdir(parents=True, exist_ok=True)
    seen_stim: set[str] = set()
    by_area = defaultdict(list)
    for r in rows:
        lines = [f"### {r['q']}  ({r['area']}) gabarito={r['key']}"]
        st = stats.get(r["item_id"])
        if st and st.get("alternatives"):
            tot = st["alternatives_respondents"]
            lines.append("na prova: acerto " + str(round(100 * st["correct"] / st["respondents"])) + "% | marcações " +
                         " ".join(f"{k}:{round(100 * v / tot)}%" for k, v in sorted(st["alternatives"].items())))
        sv = r.get("stimulus_version_id")
        if sv and sv in seen_stim:
            lines.append("[texto-base compartilhado com a questão anterior]")
        else:
            for bid, t in text_of(r["stimulus_blocks"]):
                lines.append(f"<{bid}> {t}")
            if sv:
                seen_stim.add(sv)
        for bid, t in text_of(r["command_blocks"]):
            lines.append(f"<{bid}> {t}")
        for a in r["alternatives"] or []:
            lines.append(f"{a['key']}) " + " ".join(t for _, t in text_of(a["content_blocks"])))
        by_area[r["area"]].append("\n".join(lines))
    for area, chunks in by_area.items():
        (out / f"{area}.txt").write_text("\n\n".join(chunks) + "\n")
        print(area, len(chunks), "questões", sum(len(c) for c in chunks), "caracteres")


def utf16_index(text: str, py_index: int) -> int:
    return len(text[:py_index].encode("utf-16-le")) // 2


def cmd_carregar(files: list[str]) -> None:
    api = Api()
    rows = {r["q"]: r for r in load_items(api)}
    subjects = {s["code"]: (s["id"], s["area_code"]) for s in api.rest("GET", "subjects", query="?select=id,code,area_code&code=not.is.null&kind=in.(objeto,assunto)")}
    open_props = {p["item_version_id"] for p in api.rest("GET", "item_annotation_proposals", query="?status=eq.proposta&select=item_version_id")}
    payloads, problems = [], []
    for f in files:
        for ln, line in enumerate(Path(f).read_text().splitlines(), 1):
            if not line.strip():
                continue
            a = json.loads(line)
            r = rows.get(a["q"])
            where = f"{Path(f).name}:{ln} ({a['q']})"
            if not r:
                problems.append(f"{where}: questão não encontrada")
                continue
            if r["annotation_status"] != "pendentes" or r["item_version_id"] in open_props:
                continue
            sub = subjects.get(a["s"])
            if not sub or sub[1] != r["area"]:
                problems.append(f"{where}: assunto {a['s']} inexistente ou de outra área")
                continue
            blocks = {bid: t for bid, t in text_of(r["stimulus_blocks"]) + text_of(r["command_blocks"])}
            ev = []
            for bid, quote, why in a.get("ev", []):
                t = blocks.get(bid)
                i = t.find(quote) if t else -1
                if i < 0:
                    problems.append(f"{where}: trecho não encontrado em <{bid}>: {quote[:60]}")
                    continue
                ev.append({"block_id": bid, "start_utf16": utf16_index(t, i), "end_utf16": utf16_index(t, i + len(quote)), "quote": quote, "rationale": why})
            wrong = {x["key"] for x in r["alternatives"]} - {r["key"]}
            dis = []
            for k, (typ, sec, why) in a.get("dis", {}).items():
                if k not in wrong:
                    problems.append(f"{where}: distrator {k} é a correta ou não existe")
                    continue
                dis.append({"key": k, "type": typ, "secondary": sec, "rationale": why})
            if {d["key"] for d in dis} != wrong:
                problems.append(f"{where}: faltam distratores {sorted(wrong - {d['key'] for d in dis})}")
            payloads.append({"item_version_id": r["item_version_id"], "origin": ORIGIN, "payload": {
                "schema": "anotacao/v1", "skill": a["h"], "skill_secondary": a.get("h2"), "subject": sub[0], "subject_code": a["s"],
                "content_dependency": a["d"], "evidence": ev, "distractors": dis, "steps": a["p"], "uncertainties": a.get("inc", [])}})
    if problems:
        print("\n".join(problems))
        raise SystemExit(f"{len(problems)} problema(s); nada gravado")
    if __import__("os").environ.get("DUMP"):
        Path(__import__("os").environ["DUMP"]).write_text(json.dumps(payloads, ensure_ascii=False))
    if __import__("os").environ.get("DRY"):
        print("conferência sem gravar:", len(payloads), "propostas válidas")
        return
    for i in range(0, len(payloads), 50):
        api._req("POST", "/rest/v1/item_annotation_proposals", payloads[i:i + 50], headers={"Prefer": "return=minimal"})
    print("propostas gravadas:", len(payloads))


def cmd_figuras(qs: list[str], folder: str = "/home/user/inep/fig") -> None:
    """Baixa as figuras das questões pedidas (sessão de editor), reduzidas para 900 px de largura, numa
    imagem só por questão (empilhadas), para a leitura durante a anotação."""
    import io
    from PIL import Image

    api = Api()
    rows = {r["q"]: r for r in load_items(api)}
    out = Path(folder)
    out.mkdir(parents=True, exist_ok=True)
    for q in qs:
        r = rows[q]
        ids = [b["asset_id"] for blocks in [r["stimulus_blocks"] or [], r["command_blocks"] or []] + [a["content_blocks"] for a in r["alternatives"]]
               for b in blocks if b.get("asset_id")]
        imgs = []
        for aid in ids:
            path = api.rest("GET", "assets", query=f"?id=eq.{aid}&select=storage_path")[0]["storage_path"]
            raw = api._req_raw(f"/storage/v1/object/authenticated/editorial/{path}")
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            if im.width > 900:
                im = im.resize((900, int(im.height * 900 / im.width)))
            imgs.append(im)
        if not imgs:
            print(q, "sem figura")
            continue
        h = sum(i.height for i in imgs) + 10 * (len(imgs) - 1)
        canvas = Image.new("RGB", (max(i.width for i in imgs), h), "white")
        y = 0
        for i in imgs:
            canvas.paste(i, (0, y)); y += i.height + 10
        canvas.save(out / f"{q}.png")
        print(q, len(imgs), "figura(s) →", out / f"{q}.png")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    if cmd == "exportar":
        cmd_exportar(args[0])
    elif cmd == "carregar":
        cmd_carregar(args)
    elif cmd == "figuras":
        cmd_figuras(args)
    else:
        raise SystemExit(__doc__)
