"""Microdados do Enem → parâmetros de TRI, validação do cálculo e taxas de acerto reais.

Uso (o zip do Inep fica fora do repositório; ver README, "TRI e microdados"):

    python3 tri_inep.py provas    <zip> <ano> <chaves.json>      # identifica as provas dos cadernos do banco
    python3 tri_inep.py ler       <zip> <ano> [--amostra 6000]   # uma passada nos resultados: amostra + contagens
    python3 tri_inep.py validar   <ano>                          # ajusta e testa a escala com a amostra
    python3 tri_inep.py cruzar    <ano-da-escala> <ano-testado>  # a escala de um ano reproduz as notas do outro?
    python3 tri_inep.py manifesto <zip> <ano> <baixado-em-iso>   # hash, tamanho e arquivos do zip → data/manifests
    python3 tri_inep.py fontes    <saida.sql> <ano> [<ano> ...]  # migração com as fontes (hash de cada zip)
    python3 tri_inep.py carregar  <modelo.json> <ano> [<ano> ...] # carga com a sessão de um editor (RESOLVE_EDITOR_*)

`chaves.json` é o gabarito do banco por caderno, exportado com a consulta em `CHAVES_SQL`.
Nada é inventado: parâmetro ausente ou item abandonado pelo Inep fica inválido com o motivo;
a escala da nota só é registrada se a validação contra as notas oficiais passar.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import random
import sys
import urllib.parse
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np

from tri_engine import ModelConfig, eap_many

REPO = Path(__file__).resolve().parents[2]
WORK = Path("/home/user/inep")  # zips e saídas intermediárias (fora do repositório)
DATA = REPO / "data" / "tri"
AREAS = ("LC", "CH", "CN", "MT")
LANG = {"0": "ingles", "1": "espanhol", "": None}

CHAVES_SQL = """
select b.booklet_number, bi.position, coalesce(bi.foreign_language, iv.foreign_language) fl,
  (select m.printed_letter from booklet_alternative_maps m join alternatives al on al.id = m.alternative_id
    where m.booklet_item_id = bi.id and al.is_correct) letter
from booklets b join applications a on a.id = b.application_id
join booklet_items bi on bi.booklet_id = b.id join item_versions iv on iv.id = bi.item_version_id
where a.year = :ano and a.type = 'regular' and iv.published_at is not null
"""


def member(zf: zipfile.ZipFile, stem: str) -> str:
    names = [n for n in zf.namelist() if n.upper().endswith(".CSV") and stem in n.upper().rsplit("/", 1)[-1]]
    if len(names) != 1:
        raise SystemExit(f"arquivo {stem} não encontrado (ou ambíguo) no zip: {names}")
    return names[0]


def open_member(zip_path: str, zf: zipfile.ZipFile, name: str):
    """Arquivo dentro do zip. O zip de 2025 comprime RESULTADOS com Deflate64, que o zipfile não lê;
    nesse caso o `unzip` do sistema (Info-ZIP 6, com suporte a Deflate64) descompacta em fluxo."""
    if zf.getinfo(name).compress_type == 9:
        import subprocess
        return subprocess.Popen(["unzip", "-p", zip_path, name], stdout=subprocess.PIPE).stdout
    return zf.open(name)


def read_items(zf: zipfile.ZipFile, ano: int) -> list[dict]:
    with zf.open(member(zf, f"ITENS_PROVA_{ano}")) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="latin1"), delimiter=";"))


def num(v: str) -> float | None:
    return float(v) if v not in ("", None) else None


# ---------------------------------------------------------------- provas


def cmd_provas(zip_path: str, ano: int, chaves_path: str) -> None:
    """Acha, para cada caderno do banco, a prova do Inep cujo gabarito bate posição a posição."""
    zf = zipfile.ZipFile(zip_path)
    rows = read_items(zf, ano)
    keys = json.loads(Path(chaves_path).read_text())  # {"<caderno>|<lingua ou ->": {"<posição>": "<letra>"}}
    by = defaultdict(list)
    for r in rows:
        by[r["CO_PROVA"]].append(r)
    out = {"ano": ano, "cadernos": {}, "regulares": {}}
    for key in sorted({k.split("|")[0] for k in keys}, key=int):
        found = defaultdict(list)
        for cp, rs in sorted(by.items()):
            if any(r["IN_ITEM_ADAPTADO"] == "1" for r in rs):
                continue
            tot = ok = 0
            for r in rs:
                k = f"{key}|{LANG[r['TP_LINGUA']] or '-'}"
                pos = r["CO_POSICAO"]
                if k in keys and pos in keys[k]:
                    tot += 1
                    ok += keys[k][pos] == r["TX_GABARITO"]
            if tot >= 40 and ok == tot:  # todas as posições do banco batem (anuladas não estão no banco)
                found[rs[0]["SG_AREA"]].append((cp, rs[0]["TX_COR"], tot))
        for area, hits in found.items():
            if len(hits) != 1:
                raise SystemExit(f"caderno {key}, {area}: {len(hits)} provas batem ({hits}); conferir antes de seguir")
            cp, cor, tot = hits[0]
            out["cadernos"].setdefault(key, {})[area] = {"co_prova": cp, "cor": cor, "conferidas": tot}
    # provas da mesma aplicação: mesmo conjunto de itens, sem adaptação
    for caderno in out["cadernos"].values():
        for area, info in caderno.items():
            itens = {r["CO_ITEM"] for r in by[info["co_prova"]]}
            same = sorted(cp for cp, rs in by.items()
                          if rs[0]["SG_AREA"] == area and {r["CO_ITEM"] for r in rs} == itens
                          and not any(r["IN_ITEM_ADAPTADO"] == "1" for r in rs))
            prev = out["regulares"].setdefault(area, same)
            if prev != same:
                raise SystemExit(f"{area}: cadernos do banco em aplicações diferentes ({prev} × {same})")
    for area in AREAS:
        if area not in out["regulares"]:
            raise SystemExit(f"nenhuma prova de {area} identificada")
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / f"enem-{ano}-provas.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(out, ensure_ascii=False, indent=1))


# ---------------------------------------------------------------- leitura dos resultados


def effective(area: str, lingua: str, gab: str) -> tuple[str, str | None] | None:
    """Gabarito na ordem da string de respostas. Em Linguagens o gabarito tem 50 posições (5 de inglês,
    5 de espanhol, 40 comuns) e a resposta tem 45 (as 5 da língua escolhida e as 40 comuns)."""
    if area != "LC":
        return gab, None
    if lingua == "0":
        return gab[:5] + gab[10:], "0"
    if lingua == "1":
        return gab[5:10] + gab[10:], "1"
    return None


def order_for(rs: list[dict], area: str, lingua: str | None) -> list[dict]:
    """Itens da prova na ordem da string de respostas (posição; em Linguagens, a língua escolhida primeiro)."""
    if area != "LC":
        return sorted(rs, key=lambda r: int(r["CO_POSICAO"]))
    own = sorted((r for r in rs if r["TP_LINGUA"] == lingua), key=lambda r: int(r["CO_POSICAO"]))
    com = sorted((r for r in rs if r["TP_LINGUA"] == ""), key=lambda r: int(r["CO_POSICAO"]))
    return own + com


def cmd_ler(zip_path: str, ano: int, amostra: int) -> None:
    """Uma passada no arquivo de resultados: marcações por prova, língua e posição (todos os presentes das
    provas da aplicação dos cadernos do banco, versões não adaptadas) e uma amostra aleatória por área
    (reservatório) para a validação."""
    provas = json.loads((DATA / f"enem-{ano}-provas.json").read_text())
    regular = {area: set(cps) for area, cps in provas["regulares"].items()}
    zf = zipfile.ZipFile(zip_path)
    name = member(zf, f"RESULTADOS_{ano}")
    rng = random.Random(ano)
    seen = defaultdict(int)
    sample: dict[str, list] = {a: [] for a in AREAS}
    buffers: dict[str, bytearray] = defaultdict(bytearray)  # "<prova>|<língua>" → respostas concatenadas
    widths: dict[str, int] = {}
    with open_member(zip_path, zf, name) as f:
        reader = csv.reader(io.TextIOWrapper(f, encoding="latin1"), delimiter=";")
        head = next(reader)
        col = {h: i for i, h in enumerate(head)}
        ix = {a: tuple(col[f"{k}_{a}"] for k in ("CO_PROVA", "TP_PRESENCA", "TX_RESPOSTAS", "TX_GABARITO", "NU_NOTA")) for a in AREAS}
        il = col["TP_LINGUA"]
        for n, row in enumerate(reader):
            for area in AREAS:
                icp, ipr, irs, igb, int_ = ix[area]
                cp = row[icp]
                if cp not in regular[area] or row[ipr] != "1" or not row[int_]:
                    continue
                lingua = row[il] if area == "LC" else ""
                eff = effective(area, lingua, row[igb])
                resp = row[irs]
                if eff is None or len(resp) != len(eff[0]):
                    continue
                key = f"{cp}|{lingua}"
                widths.setdefault(key, len(resp))
                if widths[key] != len(resp):
                    continue
                buffers[key] += resp.encode("latin1")
                seen[area] += 1
                rec = (cp, lingua, resp, row[igb], float(row[int_]))
                if len(sample[area]) < amostra:
                    sample[area].append(rec)
                else:
                    j = rng.randrange(seen[area])
                    if j < amostra:
                        sample[area][j] = rec
            if n % 1_000_000 == 0:
                print(f"{n:,} linhas", file=sys.stderr)
    counts = {}
    for key, buf in buffers.items():
        arr = np.frombuffer(bytes(buf), dtype=np.uint8).reshape(-1, widths[key])
        counts[key] = [{chr(v): int(n) for v, n in enumerate(np.bincount(arr[:, i], minlength=256)) if n} for i in range(arr.shape[1])]
    out = {"ano": ano, "arquivo": name, "presentes": dict(seen), "contagens": counts, "amostra": sample}
    (WORK / f"leitura-{ano}.json").write_text(json.dumps(out))
    print({a: len(s) for a, s in sample.items()}, dict(seen))


# ---------------------------------------------------------------- validação


def item_table(ano: int) -> dict[str, list[dict]]:
    zf = zipfile.ZipFile(WORK / f"microdados_enem_{ano}.zip")
    by = defaultdict(list)
    for r in read_items(zf, ano):
        by[r["CO_PROVA"]].append(r)
    for rs in by.values():
        rs.sort(key=lambda r: (int(r["CO_POSICAO"]), r["TP_LINGUA"]))
    return by


def scored_vector(rs: list[dict], area: str, lingua: str, resp: str, gab: str):
    """Parâmetros e acertos dos itens com parâmetro válido, na ordem da string de respostas.
    A ordem é conferida letra a letra contra o gabarito do participante; linha que não bate fica fora."""
    eff = effective(area, lingua, gab)
    if eff is None:
        return None
    g_eff, lang = eff
    order = order_for(rs, area, lang)
    if len(order) != len(g_eff) or len(resp) != len(g_eff):
        return None
    a, b, c, x = [], [], [], []
    for r, g, ch in zip(order, g_eff, resp):
        if g == "X" or r["IN_ITEM_ABAN"] == "1" or r["NU_PARAM_A"] == "":
            continue  # anulado ou abandonado pelo Inep: fora da nota oficial
        if r["TX_GABARITO"] != g:
            return None
        a.append(float(r["NU_PARAM_A"])); b.append(float(r["NU_PARAM_B"])); c.append(float(r["NU_PARAM_C"]))
        x.append(ch == g)
    return np.array(a), np.array(b), np.array(c), np.array(x)


GRID = (-4.0, 4.0, 40)  # "No Enem, utilizam-se 40 pontos de quadratura e a priori com distribuição normal" (procedimentos de análise)


def thetas(ano: int, area: str, cfg: ModelConfig):
    """θ (EAP) e nota oficial da amostra. Fica fora quem deixou a área inteira em branco: o Inep dá nota 0 a
    esses participantes (regra da prova, não do cálculo)."""
    lido = json.loads((WORK / f"leitura-{ano}.json").read_text())
    table = item_table(ano)
    groups = defaultdict(list)
    blank = 0
    for cp, lingua, resp, gab, nota in lido["amostra"][area]:
        if set(resp) <= {"."}:
            blank += 1
            continue
        v = scored_vector(table[cp], area, lingua, resp, gab)
        if v is not None:
            groups[(cp, lingua)].append((v, nota))
    th, nt = [], []
    for rows in groups.values():
        a, b, c, _ = rows[0][0]
        t, _sd = eap_many(np.array([r[0][3] for r in rows]), a, b, c, cfg)
        th.extend(t); nt.extend(r[1] for r in rows)
    return np.array(th), np.array(nt), blank


def errors(pred, real) -> dict:
    e = pred - real
    return {"erro_medio_abs": round(float(np.abs(e).mean()), 3), "erro_p95": round(float(np.percentile(np.abs(e), 95)), 3),
            "erro_max": round(float(np.abs(e).max()), 3), "vies": round(float(e.mean()), 3), "n": int(len(e))}


def cmd_validar(ano: int) -> dict:
    """Para cada área: θ por EAP (priori normal padrão, grade do Inep), escala nota = intercepto + inclinação·θ
    ajustada em metade da amostra e conferida na outra metade. Testa D = 1 e D = 1,7."""
    report = {"ano": ano, "grade": GRID, "priori": {"kind": "normal", "mean": 0, "sd": 1}, "areas": {}}
    for area in AREAS:
        out = {}
        for D in (1.0, 1.7):
            cfg = ModelConfig(D=D, prior_mean=0, prior_sd=1, q_from=GRID[0], q_to=GRID[1], q_points=GRID[2])
            th, nt, blank = thetas(ano, area, cfg)
            idx = np.random.default_rng(ano).permutation(len(th)); half = len(th) // 2
            slope, intercept = np.polyfit(th[idx[:half]], nt[idx[:half]], 1)
            out[f"D={D:g}"] = {"inclinacao": round(float(slope), 4), "intercepto": round(float(intercept), 4),
                               "ajuste_n": int(half), "teste": errors(intercept + slope * th[idx[half:]], nt[idx[half:]]),
                               "em_branco_fora": blank}
        best = min(out, key=lambda k: out[k]["teste"]["erro_medio_abs"])
        report["areas"][area] = {"configs": out, "escolhida": best}
        print(area, best, out[best])
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / f"validacao-{ano}.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    return report


def cmd_cruzar(ano_escala: int, ano_teste: int) -> None:
    """Aplica a escala ajustada num ano às notas oficiais do outro: se o erro continua no arredondamento,
    as duas edições estão na mesma escala e um só modelo serve para as duas."""
    rep = json.loads((DATA / f"validacao-{ano_escala}.json").read_text())
    cross = {}
    for area in AREAS:
        best = rep["areas"][area]["escolhida"]; conf = rep["areas"][area]["configs"][best]
        D = float(best.split("=")[1])
        cfg = ModelConfig(D=D, prior_mean=0, prior_sd=1, q_from=GRID[0], q_to=GRID[1], q_points=GRID[2])
        th, nt, _ = thetas(ano_teste, area, cfg)
        cross[area] = errors(conf["intercepto"] + conf["inclinacao"] * th, nt)
        print(area, f"escala de {ano_escala} nas notas de {ano_teste}:", cross[area])
    path = DATA / f"validacao-{ano_teste}.json"
    rt = json.loads(path.read_text())
    rt.setdefault("escala_de_outro_ano", {})[str(ano_escala)] = cross
    path.write_text(json.dumps(rt, ensure_ascii=False, indent=1))


# ---------------------------------------------------------------- manifesto e SQL

AREA_LABEL = {"LC": "Linguagens", "CH": "Ciências Humanas", "CN": "Ciências da Natureza", "MT": "Matemática"}
RIGHTS = "Microdados públicos do Inep; uso com citação da fonte. Uso no Resolve: parâmetros de TRI e taxas de acerto agregadas, sem dado individual."


def cmd_manifesto(zip_path: str, ano: int, retrieved_at: str) -> None:
    zp = Path(zip_path)
    h = hashlib.sha256()
    with zp.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    zf = zipfile.ZipFile(zp)
    man = {
        "edition": f"microdados-enem-{ano}",
        "url": f"https://download.inep.gov.br/microdados/microdados_enem_{ano}.zip",
        "source_page": "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem",
        "sha256": h.hexdigest(), "bytes": zp.stat().st_size, "retrieved_at": retrieved_at,
        "files": [{"name": i.filename, "bytes": i.file_size} for i in zf.infolist() if not i.is_dir()],
        "notes": ["Baixado com a verificação TLS ligada (intermediário em tools/ingest/certs). O zip fica fora do repositório."],
    }
    out = REPO / "data" / "manifests" / f"microdados-enem-{ano}.json"
    out.write_text(json.dumps(man, ensure_ascii=False, indent=1))
    print(out, man["sha256"], man["bytes"])


def q(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def item_rows(ano: int):
    """Uma linha por item de cada caderno do banco: posição, língua, código do Inep, parâmetros, motivo de exclusão
    e marcações por letra impressa (todas as respostas daquela prova e língua)."""
    provas = json.loads((DATA / f"enem-{ano}-provas.json").read_text())
    lido = json.loads((WORK / f"leitura-{ano}.json").read_text())
    table = item_table(ano)
    rows = []
    for bn, areas in provas["cadernos"].items():
        for area, info in areas.items():
            rs = table[info["co_prova"]]
            langs = ("0", "1") if area == "LC" else ("",)
            for lingua in langs:
                order = order_for(rs, area, lingua or None)
                counts = lido["contagens"].get(f"{info['co_prova']}|{lingua}")
                for i, r in enumerate(order):
                    if area == "LC" and r["TP_LINGUA"] not in (lingua, ""):
                        continue
                    if area == "LC" and lingua == "1" and r["TP_LINGUA"] == "":
                        continue  # itens comuns entram uma vez (na passada da língua inglesa, somando as duas línguas)
                    c = {k: 0 for k in "ABCDE"} | {".": 0, "*": 0}
                    if area == "LC" and r["TP_LINGUA"] == "":
                        # itens comuns: soma das duas línguas (posições 6–45 vêm depois das 5 da língua)
                        for lg in ("0", "1"):
                            cc = lido["contagens"].get(f"{info['co_prova']}|{lg}")
                            if cc:
                                for k, n in cc[i].items():
                                    c[k if k in c else "*"] = c.get(k if k in c else "*", 0) + n
                    elif counts:
                        for k, n in counts[i].items():
                            c[k if k in c else "*"] = c.get(k if k in c else "*", 0) + n
                    aban = r["IN_ITEM_ABAN"] == "1"
                    has = r["NU_PARAM_A"] != "" and not aban
                    reason = None
                    if aban:
                        reason = f"Abandonado pelo Inep na calibração ({(r['TX_MOTIVO_ABAN'] or 'motivo não informado').lower()}); fora da nota oficial."
                    elif not has:
                        reason = "Sem parâmetro nos microdados do Inep."
                    rows.append({
                        "bn": int(bn), "pos": int(r["CO_POSICAO"]), "lang": LANG[r["TP_LINGUA"]] or "-", "area": area,
                        "co_item": r["CO_ITEM"], "gabarito": r["TX_GABARITO"],
                        "a": num(r["NU_PARAM_A"]) if has else None, "b": num(r["NU_PARAM_B"]) if has else None,
                        "c": num(r["NU_PARAM_C"]) if has else None, "reason": reason, "counts": c,
                    })
    return rows


def item_totals(ano: int) -> dict[str, dict]:
    """Por código de item: presentes que receberam o item em qualquer prova da mesma aplicação (versões não
    adaptadas), acertos e em branco. Em Linguagens, os itens de língua contam só quem escolheu aquela língua."""
    provas = json.loads((DATA / f"enem-{ano}-provas.json").read_text())
    lido = json.loads((WORK / f"leitura-{ano}.json").read_text())
    table = item_table(ano)
    tot: dict[str, dict] = {}
    for area, cps in provas["regulares"].items():
        for cp in cps:
            for lingua in (("0", "1") if area == "LC" else ("",)):
                counts = lido["contagens"].get(f"{cp}|{lingua}")
                if not counts:
                    continue
                order = order_for(table[cp], area, lingua or None)
                for i, r in enumerate(order):
                    t = tot.setdefault(r["CO_ITEM"], {"respondents": 0, "correct": 0, "blank": 0, "area": area})
                    n = sum(counts[i].values())
                    t["respondents"] += n
                    t["correct"] += counts[i].get(r["TX_GABARITO"], 0)
                    t["blank"] += counts[i].get(".", 0)
    return tot


def cmd_fontes(out_path: str, anos: list[int]) -> None:
    """Migração com as fontes (um registro por zip de microdados, com hash e as provas identificadas)."""
    parts = ["-- Gerado por tools/ingest/tri_inep.py fontes: microdados do Inep usados para parâmetros de TRI e taxas de acerto."]
    for ano in anos:
        man = json.loads((REPO / "data" / "manifests" / f"microdados-enem-{ano}.json").read_text())
        provas = json.loads((DATA / f"enem-{ano}-provas.json").read_text())
        lido = json.loads((WORK / f"leitura-{ano}.json").read_text())
        parts.append(
            "insert into public.sources (title, institution, url, edition, kind, retrieved_at, sha256, bytes, rights_status, metadata) values ("
            + ", ".join(q(v) for v in (f"Microdados do Enem {ano}", "Inep", man["url"], str(ano), "microdados", man["retrieved_at"],
                                        man["sha256"], man["bytes"], RIGHTS,
                                        {"manifest": f"data/manifests/microdados-enem-{ano}.json", "provas": provas["cadernos"],
                                         "provas_da_aplicacao": provas["regulares"], "presentes": lido["presentes"]}))
            + ") on conflict (url, sha256) do nothing;")
    Path(out_path).write_text("\n".join(parts) + "\n")
    print(out_path)


def _in(ids) -> str:
    return "in.(" + ",".join(str(i) for i in ids) + ")"


def cmd_carregar(model: dict, anos: list[int]) -> None:
    """Carga com a sessão de um editor (as políticas valem; nenhuma chave de serviço): parâmetros por item,
    código oficial do item, taxas de acerto e a versão do modelo de cada área. Idempotente."""
    from load_editorial import Api

    api = Api()
    D = model["D"]
    sets: dict[tuple[int, str], str] = {}
    for ano in anos:
        man = json.loads((REPO / "data" / "manifests" / f"microdados-enem-{ano}.json").read_text())
        src = api.rest("GET", "sources", query=f"?url=eq.{urllib.parse.quote(man['url'], safe='')}&sha256=eq.{man['sha256']}&select=id")
        if len(src) != 1:
            raise SystemExit(f"fonte dos microdados {ano} não registrada (aplique a migração de fontes antes)")
        src_id = src[0]["id"]
        app_id = api.rest("GET", "applications", query=f"?year=eq.{ano}&type=eq.regular&select=id")[0]["id"]
        rows = item_rows(ano)
        bns = sorted({r["bn"] for r in rows})
        booklets = {b["id"]: b["booklet_number"] for b in api.rest("GET", "booklets", query=f"?application_id=eq.{app_id}&booklet_number={_in(bns)}&select=id,booklet_number")}
        bis = api.rest("GET", "booklet_items", query=(f"?booklet_id={_in(booklets)}&select=id,booklet_id,position,foreign_language,"
                                                       "item_versions!inner(item_id,foreign_language,review_status)&item_versions.review_status=eq.published"))
        where = {}
        for bi in bis:
            lang = bi["foreign_language"] or bi["item_versions"]["foreign_language"] or "-"
            where[(booklets[bi["booklet_id"]], bi["position"], lang)] = (bi["id"], bi["item_versions"]["item_id"])
        maps: dict[str, dict[str, str]] = defaultdict(dict)
        ids = [v[0] for v in where.values()]
        for i in range(0, len(ids), 80):
            for m in api.rest("GET", "booklet_alternative_maps", query=f"?booklet_item_id={_in(ids[i:i + 80])}&select=booklet_item_id,printed_letter,alternatives(stable_key)"):
                maps[m["booklet_item_id"]][m["printed_letter"]] = m["alternatives"]["stable_key"]
        # ligação posição → item do banco, com as conferências da migração antiga
        linked, code_of = [], {}
        for r in rows:
            hit = where.get((r["bn"], r["pos"], r["lang"]))
            if hit:
                linked.append({**r, "booklet_item_id": hit[0], "item_id": hit[1]})
                if code_of.setdefault(hit[1], r["co_item"]) != r["co_item"]:
                    raise SystemExit(f"{ano}: item {hit[1]} ligado a dois códigos do Inep")
        missing = set(where.values()) - {(x["booklet_item_id"], x["item_id"]) for x in linked}
        if missing:
            raise SystemExit(f"{ano}: {len(missing)} posições publicadas sem item do Inep")
        n_codes = api.rpc("set_official_item_codes", {"p_codes": code_of})
        print(ano, "itens ligados:", len(code_of), "códigos gravados agora:", n_codes)
        areas = {a["code"]: a["id"] for a in api.rest("GET", "areas", query="?select=id,code")}
        for area in AREAS:
            label = f"Inep · Enem {ano} · aplicação regular · {AREA_LABEL[area]}"
            got = api.rest("GET", "parameter_sets", query=f"?label=eq.{urllib.parse.quote(label, safe='')}&select=id")
            if not got:
                got = api.rest("POST", "parameter_sets", [{
                    "label": label, "source_id": src_id, "application_id": app_id, "area_id": areas[area], "model_family": "3pl",
                    "scale_constant": D, "note": f"Parâmetros a, b, c na escala (0,1) do Enem, como publicados em ITENS_PROVA_{ano}. Itens abandonados pelo Inep ficam inválidos com o motivo."}])
            sets[(ano, area)] = got[0]["id"]
            seen, payload = set(), []
            for x in linked:
                if x["area"] != area or x["item_id"] in seen:
                    continue
                seen.add(x["item_id"])
                payload.append({"parameter_set_id": got[0]["id"], "item_id": x["item_id"], "a": x["a"], "b": x["b"], "c": x["c"],
                                "valid": x["reason"] is None, "exclusion_reason": x["reason"]})
            api._req("POST", "/rest/v1/item_parameters?on_conflict=parameter_set_id,item_id", payload,
                     headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
            print(ano, area, "parâmetros:", len(payload), "válidos:", sum(p["valid"] for p in payload))
        totals = item_totals(ano)
        population = (f"Participantes presentes da aplicação regular do Enem {ano}, todas as cores de prova com os mesmos itens "
                      "(versões adaptadas fora); nos itens de língua estrangeira, só quem escolheu aquela língua.")
        alts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        alt_n: dict[str, int] = defaultdict(int)
        for x in linked:
            mp = maps.get(x["booklet_item_id"], {})
            if len(mp) != 5:
                continue
            for letter, key in mp.items():
                alts[x["item_id"]][key] += x["counts"].get(letter, 0)
            alt_n[x["item_id"]] += sum(x["counts"].values())
        stats = []
        for item_id, co in code_of.items():
            t = totals.get(co)
            if not t or t["respondents"] <= 0:
                continue
            stats.append({"item_id": item_id, "source_id": src_id, "population": population, "respondents": t["respondents"],
                          "correct": t["correct"], "blank": t["blank"],
                          "alternatives": dict(alts[item_id]) if item_id in alts else None,
                          "alternatives_respondents": alt_n.get(item_id) or None,
                          "note": "Marcações por alternativa contadas nos cadernos do banco, com a letra impressa convertida pela tabela de letras de cada caderno."})
        api._req("POST", "/rest/v1/item_response_stats?on_conflict=item_id,source_id", stats,
                 headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        print(ano, "taxas de acerto:", len(stats))
    latest = max(anos)
    for area in AREAS:
        mid = f"enem-inep-{area.lower()}-v1"
        api._req("POST", "/rest/v1/tri_model_versions?on_conflict=id", [{
            "id": mid, "parameter_set_id": sets[(latest, area)], "prior_config": model["prior"], "integration_config": model["integration"],
            "transform_config": model["transform"][area], "interval_z": model["interval_z"], "transform_source": model["transform_source"][area],
            "code_version": model["code_version"], "validation_status": model["status"][area], "validation_note": model["notes"][area]}],
            headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        for ano in anos:
            if ano != latest:
                api._req("POST", "/rest/v1/tri_model_parameter_sets?on_conflict=model_id,parameter_set_id",
                         [{"model_id": mid, "parameter_set_id": sets[(ano, area)]}], headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        print("modelo", mid, model["status"][area])


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    if cmd == "provas":
        cmd_provas(args[0], int(args[1]), args[2])
    elif cmd == "ler":
        amostra = int(args[args.index("--amostra") + 1]) if "--amostra" in args else 6000
        cmd_ler(args[0], int(args[1]), amostra)
    elif cmd == "validar":
        cmd_validar(int(args[0]))
    elif cmd == "cruzar":
        cmd_cruzar(int(args[0]), int(args[1]))
    elif cmd == "manifesto":
        cmd_manifesto(args[0], int(args[1]), args[2])
    elif cmd == "fontes":
        cmd_fontes(args[0], [int(a) for a in args[1:]])
    elif cmd == "carregar":
        cmd_carregar(json.loads(Path(args[0]).read_text()), [int(a) for a in args[1:]])
    else:
        raise SystemExit(__doc__)
