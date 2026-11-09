"""Carga da área editorial (F2-T12): propostas, dúvidas e imagens das páginas.

Entra com a conta de um editor (as políticas do banco valem: nada usa chave de serviço) e:
1. cria um lote por caderno (idempotente pela nota do lote);
2. grava cada proposta de raw/proposals/ com o resultado do validador e abre as dúvidas;
3. renderiza as páginas do PDF em WebP e envia para o bucket "editorial", com um manifesto de
   geometria (MediaBox × CropBox) para sobrepor as caixas da extração;
4. envia os recortes de figura do piloto (docs/validation/f2-t08).

Uso:
  RESOLVE_EDITOR_EMAIL=... RESOLVE_EDITOR_PASSWORD=... python load_editorial.py D1_CD1 D2_CD7 [--fixture] [--gabaritos] [--cruzamento]
--fixture cria também o lote de teste automatizado (cópias de duas questões; não publicável).
--gabaritos grava os gabaritos oficiais de todos os cadernos baixados; --cruzamento grava o resultado
do cruzamento entre cores (F2-T10). Os dois são idempotentes.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
SCALE = 1.5
FIXTURE_NOTE = "lote de teste automatizado (e2e) — não publicar"
FIXTURE_PICK = ["D2_CD7_Q140.json", "D1_CD1_Q010.json"]


def env_local() -> dict:
    out = {}
    p = REPO / "apps" / "web" / ".env.local"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^([A-Z_]+)=(.*)$", line)
            if m:
                out[m.group(1)] = m.group(2)
    return out


class Api:
    def __init__(self):
        e = {**env_local(), **os.environ}
        self.url = e["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
        self.key = e["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
        email, pw = e.get("RESOLVE_EDITOR_EMAIL"), e.get("RESOLVE_EDITOR_PASSWORD")
        if not email or not pw:
            raise SystemExit("Defina RESOLVE_EDITOR_EMAIL e RESOLVE_EDITOR_PASSWORD (conta com papel de editor).")
        tok = self._req("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": pw}, auth=False)
        self.token = tok["access_token"]
        if self.rpc("is_editor", {}) is not True:
            raise SystemExit("A conta informada não tem papel de editor.")

    def _req(self, method, path, body=None, auth=True, headers=None, raw: bytes | None = None, ctype="application/json"):
        h = {"apikey": self.key, "Content-Type": ctype}
        if auth:
            h["Authorization"] = f"Bearer {self.token}"
        h.update(headers or {})
        data = raw if raw is not None else (json.dumps(body, ensure_ascii=False).encode() if body is not None else None)
        req = urllib.request.Request(self.url + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                txt = r.read().decode() or "null"
                return json.loads(txt)
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"{method} {path}: {err.code} {err.read().decode()[:400]}") from None

    def rest(self, method, table, body=None, query=""):
        return self._req(method, f"/rest/v1/{table}{query}", body, headers={"Prefer": "return=representation"})

    def rpc(self, fn, args):
        return self._req("POST", f"/rest/v1/rpc/{fn}", args)

    def upload(self, path: str, data: bytes, ctype: str):
        return self._req("POST", f"/storage/v1/object/editorial/{path}", raw=data, ctype=ctype, headers={"x-upsert": "true"})


def booklet_meta(name: str) -> dict:
    data = json.loads((ROOT / "raw" / "extraction" / f"{name}.json").read_text(encoding="utf-8"))
    return {"file": data["file"], "sha256": data["sha256"], "questions": data["questions"]}


def ensure_batch(api: Api, source_id: str, note: str, publishable: bool = True) -> tuple[str, bool]:
    q = "?select=id&notes=eq." + urllib.parse.quote(note)
    found = api.rest("GET", "ingest_batches", query=q)
    if found:
        return found[0]["id"], False
    row = api.rest("POST", "ingest_batches", {"source_id": source_id, "tool": "tools/ingest/load_editorial.py", "tool_version": "1",
                                              "notes": note, "publishable": publishable})
    return row[0]["id"], True


CHECK_CODE = {"confere": "confere", "anulada nas duas": "anulada_nas_duas", "ANULAÇÃO DIVERGENTE": "anulacao_divergente", "DIVERGE": "diverge",
              "gabarito ausente": "gabarito_ausente", "letra não mapeável automaticamente": "letra_nao_mapeavel"}


def booklets_by_file(api: Api) -> dict[str, dict]:
    """{nome do PDF da prova: {"id", "answer_key_source_id"}} a partir de booklets + sources."""
    rows = api.rest("GET", "booklets", query="?select=id,source_id,answer_key_source_id")
    srcs = {s["id"]: s for s in api.rest("GET", "sources", query="?select=id,sha256,metadata&kind=in.(prova,gabarito)")}
    return {srcs[r["source_id"]]["metadata"]["file"]: {**r, "gabarito_file": srcs[r["answer_key_source_id"]]["metadata"]["file"]} for r in rows if r["answer_key_source_id"]}


def load_answer_keys(api: Api) -> dict:
    """Gabaritos oficiais de todos os cadernos baixados (inclui "ANULADO" e as colunas de língua)."""
    from crossmatch import parse_answer_key

    counts = {}
    existing = {r["booklet_id"] for r in api.rest("GET", "official_answer_keys", query="?select=booklet_id")}
    for file, b in sorted(booklets_by_file(api).items()):
        gb = ROOT / "raw" / "enem-2025" / b["gabarito_file"]
        if b["id"] in existing or not gb.exists():
            counts[file] = "já carregado" if b["id"] in existing else "PDF do gabarito ausente"
            continue
        key = parse_answer_key(gb)
        rows = [{"booklet_id": b["id"], "question_number": n, "foreign_language": lang, "answer": a, "source_id": b["answer_key_source_id"]}
                for (n, lang), a in sorted(key.items(), key=lambda x: (x[0][0], x[0][1] or ""))]
        api.rest("POST", "official_answer_keys", rows)
        counts[file] = len(rows)
    return counts


def load_variant_checks(api: Api) -> dict:
    """Resultado do cruzamento entre cores (data/extraction/enem-2025-cruzamento.json)."""
    report = json.loads((REPO / "data" / "extraction" / "enem-2025-cruzamento.json").read_text(encoding="utf-8"))
    books = booklets_by_file(api)
    counts = {}
    for pair in report["pairs"]:
        a, b = books[pair["a"]["file"]]["id"], books[pair["b"]["file"]]["id"]
        if api.rest("GET", "variant_checks", query=f"?select=id&base_booklet_id=eq.{a}&other_booklet_id=eq.{b}&limit=1"):
            counts[pair["day"]] = "já carregado"
            continue
        rows = [{"base_booklet_id": a, "base_position": r["position_a"], "foreign_language": r["foreign_language"], "other_booklet_id": b,
                 "other_position": r["position_b"], "letter_map": r["letter_map"], "result": CHECK_CODE[r["check"]],
                 "fingerprint": r["fingerprint"], "tool": "tools/ingest/crossmatch.py"}
                for r in pair["rows"] if r.get("position_b")]
        api.rest("POST", "variant_checks", rows)
        counts[pair["day"]] = len(rows)
    return counts


def load_proposals(api: Api, batch_id: str, files: list[Path]) -> dict:
    counts = {"inseridas": 0, "já existiam": 0, "dúvidas": 0, "rebaixadas pelo banco": 0}
    existing = {(r["question_number"], r["foreign_language"]) for r in api.rest("GET", "item_proposals", query=f"?select=question_number,foreign_language&batch_id=eq.{batch_id}")}
    for f in files:
        doc = json.loads(f.read_text(encoding="utf-8"))
        p, v = doc["payload"], doc["validation"]
        if (p["number"], p["foreign_language"]) in existing:
            counts["já existiam"] += 1
            continue
        row = {"batch_id": batch_id, "question_number": p["number"], "foreign_language": p["foreign_language"], "payload": p, "status": v["status"], "validation": v}
        try:
            ins = api.rest("POST", "item_proposals", row)
        except RuntimeError as e:
            if v["status"] != "valida" or "resolve_proposal_incomplete" not in str(e):
                raise
            # O banco não reconhece como completa: entra como dúvida, com o motivo registrado.
            v = {**v, "status": "duvida", "doubts": [*v["doubts"], "banco recusou como completa (proposal_is_complete)"]}
            ins = api.rest("POST", "item_proposals", {**row, "status": "duvida", "validation": v})
            counts["rebaixadas pelo banco"] += 1
        counts["inseridas"] += 1
        for d in v["doubts"]:
            api.rest("POST", "doubt_queue", {"proposal_id": ins[0]["id"], "kind": d[:400]})
            counts["dúvidas"] += 1
    return counts


def upload_pages(api: Api, booklet_file: str, sha: str, pages: set[int]) -> int:
    from PIL import Image  # noqa: F401  (Pillow faz o WebP)

    doc = pdfium.PdfDocument(str(ROOT / "raw" / "enem-2025" / booklet_file))
    manifest = {"booklet_file": booklet_file, "booklet_sha256": sha, "scale": SCALE, "pages": {}}
    for pno in sorted(pages):
        page = doc[pno - 1]
        mx0, my0, mx1, my1 = page.get_mediabox()
        cx0, cy0, cx1, cy1 = page.get_cropbox()
        img = page.render(scale=SCALE).to_pil().convert("RGB")
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=82, method=6)
        api.upload(f"paginas/{sha}/{pno}.webp", buf.getvalue(), "image/webp")
        # bbox da extração está na MediaBox (pdfplumber, origem no topo); a imagem é a CropBox.
        manifest["pages"][str(pno)] = {"width_px": img.width, "height_px": img.height, "dx_pt": cx0 - mx0, "dy_pt": my1 - cy1,
                                       "crop_width_pt": cx1 - cx0, "crop_height_pt": cy1 - cy0}
    api.upload(f"paginas/{sha}/manifesto.json", json.dumps(manifest, indent=1).encode(), "application/json")
    return len(pages)


def upload_figures(api: Api) -> int:
    figs = json.loads((REPO / "data" / "extraction" / "enem-2025-piloto-figuras.json").read_text(encoding="utf-8"))["figures"]
    for f in figs:
        api.upload(f"figuras/{f['sha256']}.png", (REPO / f["png"]).read_bytes(), "image/png")
    return len(figs)


def main() -> int:
    names = [a for a in sys.argv[1:] if not a.startswith("--")]
    api = Api()
    if "--gabaritos" in sys.argv:
        print(f"gabaritos oficiais: {load_answer_keys(api)}")
    if "--cruzamento" in sys.argv:
        print(f"cruzamento entre cores: {load_variant_checks(api)}")
    for name in names:
        meta = booklet_meta(name)
        src = api.rest("GET", "sources", query=f"?select=id&sha256=eq.{meta['sha256']}")
        if not src:
            raise SystemExit(f"{meta['file']}: fonte não registrada (rode a carga de fontes da F2-T06).")
        note = f"Enem 2025 · {meta['file']} · extract.py v0.1 + contract.py (item-proposal/v1)"
        batch_id, new = ensure_batch(api, src[0]["id"], note)
        files = sorted((ROOT / "raw" / "proposals").glob(f"{name}_Q*.json"))
        counts = load_proposals(api, batch_id, files)
        pages = {p for q in meta["questions"] for p in q["pages"]}
        n = upload_pages(api, meta["file"], meta["sha256"], pages)
        print(f"{meta['file']}: lote {'novo' if new else 'existente'} · {counts} · {n} páginas enviadas")
    if "--fixture" in sys.argv:
        meta = booklet_meta(names[0])
        src = api.rest("GET", "sources", query=f"?select=id&sha256=eq.{meta['sha256']}")
        fx_id, _ = ensure_batch(api, src[0]["id"], FIXTURE_NOTE, publishable=False)
        print(f"lote de teste: {load_proposals(api, fx_id, [ROOT / 'raw' / 'proposals' / f for f in FIXTURE_PICK])}")
    if names:
        print(f"figuras do piloto enviadas: {upload_figures(api)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
