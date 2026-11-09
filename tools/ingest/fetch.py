"""Baixa os arquivos oficiais de uma edição e gera o manifesto (F2-T06).

Uso: python fetch.py enem-2025 [--only-required]
Lê sources/<edição>.json, baixa para raw/<edição>/, confere sha256 contra o manifesto
anterior (se houver) e grava data/manifests/<edição>.json.
"""
from __future__ import annotations

import hashlib
import json
import re
import os
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
INTERMEDIATE = ROOT / "certs" / "rnp-icpedu-gr46-ov-tls-ca-2025.pem"


def ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    ctx.load_verify_locations(cafile=str(INTERMEDIATE))
    return ctx


def download(url: str, dest: Path, ctx: ssl.SSLContext, attempts: int = 4) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Resolve-ingest/0.1 (importacao editorial)"})
    for i in range(attempts):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=120) as r, open(dest.with_suffix(".part"), "wb") as f:
                while chunk := r.read(1 << 16):
                    f.write(chunk)
            dest.with_suffix(".part").rename(dest)
            return
        except Exception as e:  # rede instável: tenta de novo com espera crescente
            if i == attempts - 1:
                raise
            print(f"  tentativa {i + 1} falhou ({e}); repetindo", file=sys.stderr)
            time.sleep(2 ** (i + 1))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


COVER = re.compile(r"CADERNO\s+(\d+)\s*(?:\|\s*)?\n?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç]+)")


def pdf_info(path: Path) -> dict:
    doc = pdfium.PdfDocument(str(path))
    first = doc[0].get_textpage().get_text_range() if len(doc) else ""
    info: dict = {"pages": len(doc), "first_page_excerpt": " ".join(first.split())[:400]}
    m = COVER.search(first)
    if m:
        info["cover_booklet"] = int(m.group(1))
        info["color"] = m.group(2).capitalize()
    doc.close()
    return info


def main() -> int:
    edition = sys.argv[1]
    only_required = "--only-required" in sys.argv
    spec = json.loads((ROOT / "sources" / f"{edition}.json").read_text(encoding="utf-8"))
    raw = ROOT / "raw" / edition
    raw.mkdir(parents=True, exist_ok=True)
    out_path = REPO / "data" / "manifests" / f"{edition}.json"
    previous = {}
    if out_path.exists():
        previous = {f["file"]: f for f in json.loads(out_path.read_text(encoding="utf-8"))["files"]}

    ctx = ssl_context()
    files = []
    for entry in spec["files"]:
        name = entry["url"].rsplit("/", 1)[-1]
        record = {**entry, "file": name}
        if only_required and not entry.get("download", True):
            files.append({**record, "status": "listado_nao_baixado"})
            continue
        if not entry.get("download", True):
            files.append({**record, "status": "listado_nao_baixado"})
            continue
        dest = raw / name
        if not dest.exists():
            print(f"baixando {name}")
            download(entry["url"], dest, ctx)
        digest = sha256(dest)
        old = previous.get(name)
        if old and old.get("sha256") and old["sha256"] != digest:
            print(f"ATENÇÃO: {name} mudou desde o manifesto anterior", file=sys.stderr)
        record.update(
            status="baixado",
            sha256=digest,
            bytes=dest.stat().st_size,
            retrieved_at=old.get("retrieved_at") if old and old.get("sha256") == digest else datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )
        if name.lower().endswith(".pdf"):
            record.update(pdf_info(dest))
            if "booklet" in record and record.get("cover_booklet") not in (None, record["booklet"]):
                print(f"ATENÇÃO: {name}: capa indica caderno {record['cover_booklet']}", file=sys.stderr)
                record["status"] = "divergente"
        files.append(record)

    # Gabaritos: a ordem do texto extraído não traz a cor de forma confiável; usa a da prova do mesmo caderno.
    colors = {(f.get("day_code"), f.get("booklet")): f.get("color") for f in files if f.get("kind") == "prova" and f.get("color")}
    for f in files:
        if f.get("kind") == "gabarito" and f.get("status") == "baixado":
            f["color"] = colors.get((f.get("day_code"), f.get("booklet")))
            f["color_source"] = "capa da prova do mesmo caderno"

    manifest = {
        "edition": edition,
        "source_page": spec["source_page"],
        "notes": spec.get("notes", []),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "files": files,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ok = sum(1 for f in files if f["status"] == "baixado")
    print(f"manifesto: {out_path.relative_to(REPO)} · {ok} baixados · {len(files) - ok} apenas listados")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
