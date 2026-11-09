"""Etiquetagem assistida (F2-T11).

Para cada proposta de questão (contrato item-proposal/v1), pede ao modelo uma sugestão estruturada de
habilidade da Matriz, dependência de conteúdo, evidências e tipo de cada distrator; confere a sugestão
contra a questão e grava proveniência completa. Nada vai direto para o banco principal: a sugestão
fica "sugerida" (sem dúvida) ou "pendente" (qualquer incerteza) para a revisão editorial (F2-T13).

Uso:
  RESOLVE_ANTHROPIC_API_KEY=... python tagging.py raw/proposals/D2_CD7_Q140.json [...]
  python tagging.py --dry-run raw/proposals/D2_CD7_Q140.json     # mostra o pedido, não chama a API

A chave é própria do Resolve (RESOLVE_ANTHROPIC_API_KEY) e o endereço é sempre api.anthropic.com:
o cliente ignora ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY do ambiente para não usar credenciais alheias.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
PROMPT_PATH = ROOT / "prompts" / "etiquetagem-v1.md"
PROMPT_VERSION = "etiquetagem-v1"
SCHEMA_VERSION = "tag-suggestion/v1"
PROVIDER = "anthropic"
MODEL = "claude-opus-5-5"
API_BASE = "https://api.anthropic.com"
KEY_ENV = "RESOLVE_ANTHROPIC_API_KEY"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
LETTERS = "ABCDE"
CONFIDENCE = ["alta", "media", "baixa"]

MATRIX = json.loads((REPO / "data" / "matriz" / "enem-matriz-v1.json").read_text(encoding="utf-8"))
TAXONOMY = json.loads((REPO / "data" / "taxonomia" / "distratores-v0.json").read_text(encoding="utf-8"))


def prompt_text() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def prompt_sha256() -> str:
    return hashlib.sha256(PROMPT_PATH.read_bytes()).hexdigest()


def area_skills(area: str) -> list[dict]:
    a = next(x for x in MATRIX["areas"] if x["code"] == area)
    return [{"code": s["code"], "competency": s["competency"], "description": s["description"]} for s in a["skills"]]


def output_schema(skill_codes: list[str], distractor_codes: list[str]) -> dict:
    """Formato exigido da resposta (structured outputs). Enums fecham habilidade, letra e tipo."""
    s = {"type": "string"}
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["habilidade", "dependencia_conteudo", "evidencias", "distratores", "incertezas"],
        "properties": {
            "habilidade": {
                "type": "object", "additionalProperties": False, "required": ["codigo", "confianca", "justificativa"],
                "properties": {"codigo": {"type": "string", "enum": skill_codes}, "confianca": {"type": "string", "enum": CONFIDENCE}, "justificativa": s},
            },
            "dependencia_conteudo": {
                "type": "object", "additionalProperties": False, "required": ["nivel", "justificativa"],
                "properties": {"nivel": {"type": "string", "enum": ["0", "1", "2", "3"]}, "justificativa": s},
            },
            "evidencias": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": False, "required": ["bloco", "trecho", "justificativa"],
                          "properties": {"bloco": s, "trecho": s, "justificativa": s}},
            },
            "distratores": {
                "type": "array",
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["letra", "tipo", "tipo_secundario", "confianca", "justificativa"],
                    "properties": {
                        "letra": {"type": "string", "enum": list(LETTERS)},
                        "tipo": {"type": "string", "enum": distractor_codes},
                        "tipo_secundario": {"type": "string", "enum": ["nenhum", *distractor_codes]},
                        "confianca": {"type": "string", "enum": CONFIDENCE},
                        "justificativa": s,
                    },
                },
            },
            "incertezas": {"type": "array", "items": s},
        },
    }


def item_blocks(payload: dict) -> list[dict]:
    """Blocos da questão como o modelo os vê: id, papel e texto (figura vira marcador)."""
    out = []
    for b in payload.get("stimulus_blocks", []):
        out.append({"id": b["id"], "papel": "texto-base", "texto": b.get("text") or f"[figura {b.get('asset_ref', '')}: não disponível como texto]"})
    for b in payload.get("command_blocks", []):
        out.append({"id": b["id"], "papel": "comando", "texto": b.get("text", "")})
    for k in LETTERS:
        for b in payload["alternatives"].get(k, []):
            texto = b.get("text") if b.get("type") != "image" else f"[figura {b.get('asset_ref', '')}: não disponível como texto]"
            out.append({"id": b["id"], "papel": f"alternativa {k}", "texto": texto or ""})
    return out


def user_content(payload: dict, answer: str) -> str:
    skills = area_skills(payload["area"])
    taxonomy = [{k: t[k] for k in ("code", "label", "definition", "limits")} for t in TAXONOMY["types"]]
    questao = json.dumps({"numero": payload["number"], "lingua": payload.get("foreign_language"), "blocos": item_blocks(payload)}, ensure_ascii=False, indent=1)
    questao = questao.replace("</", "<\\/")  # o conteúdo não fecha a marcação de dado
    return (
        f"Área: {payload['area']}\n\n"
        f"<habilidades>\n{json.dumps(skills, ensure_ascii=False, indent=1)}\n</habilidades>\n\n"
        f"<taxonomia_distratores versao=\"{TAXONOMY['taxonomy_version']}\">\n{json.dumps(taxonomy, ensure_ascii=False, indent=1)}\n</taxonomia_distratores>\n\n"
        f"<questao>\n{questao}\n</questao>\n\n"
        f"Letra correta segundo o gabarito oficial: {answer}"
    )


def request_params(payload: dict, answer: str) -> dict:
    skills = [s["code"] for s in area_skills(payload["area"])]
    codes = [t["code"] for t in TAXONOMY["types"]]
    return {
        "model": MODEL,
        "max_tokens": 16000,
        "system": prompt_text(),
        "messages": [{"role": "user", "content": user_content(payload, answer)}],
        "output_config": {"effort": "high", "format": {"type": "json_schema", "schema": output_schema(skills, codes)}},
        # Recusa por política: a API repete o pedido em outro modelo; o modelo que respondeu fica registrado.
        "betas": [FALLBACK_BETA],
        "fallbacks": "default",
    }


def make_client():
    import anthropic

    key = os.environ.get(KEY_ENV)
    if not key:
        raise SystemExit(f"Defina {KEY_ENV} (chave da API da Anthropic do projeto Resolve).")
    # Chave explícita: o SDK não consulta credenciais do ambiente; base_url explícito vence ANTHROPIC_BASE_URL.
    return anthropic.Anthropic(api_key=key, base_url=API_BASE)


def call_model(client, params: dict) -> dict:
    """Chama a API e devolve só o necessário para conferir e registrar."""
    r = client.beta.messages.create(**params)
    iterations = getattr(r.usage, "iterations", None) or []
    return {
        "text": next((b.text for b in r.content if b.type == "text"), None),
        "model_served": r.model,
        "fallback_ran": any(getattr(e, "type", "") == "fallback_message" for e in iterations),
        "stop_reason": r.stop_reason,
        "request_id": getattr(r, "_request_id", None),
        "usage": {"input_tokens": r.usage.input_tokens, "output_tokens": r.usage.output_tokens},
    }


def utf16_offset(text: str, index: int) -> int:
    return len(text[:index].encode("utf-16-le")) // 2


def postprocess(raw: dict, payload: dict, answer: str) -> dict:
    """Confere a sugestão contra a questão. Qualquer problema vira incerteza → status "pendente"."""
    problems: list[str] = []
    data = None
    if raw.get("stop_reason") != "end_turn":
        problems.append(f"resposta incompleta ou recusada (stop_reason={raw.get('stop_reason')})")
    if raw.get("text"):
        try:
            data = json.loads(raw["text"])
        except json.JSONDecodeError:
            problems.append("resposta fora do formato JSON")
    elif not problems:
        problems.append("resposta sem conteúdo")
    suggestion: dict = {"skill": None, "content_dependency": None, "evidence": [], "distractors": []}
    if data:
        problems += [f"modelo: {u}" for u in data.get("incertezas", []) if u.strip()]
        skills = {s["code"] for s in area_skills(payload["area"])}
        h = data["habilidade"]
        if h["codigo"] not in skills:
            problems.append(f"habilidade {h['codigo']} fora da área {payload['area']}")
        if h["confianca"] == "baixa":
            problems.append("habilidade com confiança baixa")
        suggestion["skill"] = {"code": h["codigo"], "confidence": h["confianca"], "rationale": h["justificativa"]}
        suggestion["content_dependency"] = {"level": int(data["dependencia_conteudo"]["nivel"]), "rationale": data["dependencia_conteudo"]["justificativa"]}
        texts = {b["id"]: b["texto"] for b in item_blocks(payload)}
        for e in data["evidencias"]:
            t = texts.get(e["bloco"])
            i = t.find(e["trecho"]) if (t and e["trecho"]) else -1
            if t is None:
                problems.append(f"evidência aponta para bloco inexistente ({e['bloco']})")
            elif i < 0:
                problems.append(f"trecho de evidência não encontrado literalmente no bloco {e['bloco']}")
            suggestion["evidence"].append({
                "block_id": e["bloco"], "quote": e["trecho"], "rationale": e["justificativa"],
                "start_utf16": utf16_offset(t, i) if i >= 0 else None,
                "end_utf16": utf16_offset(t, i + len(e["trecho"])) if i >= 0 else None,
            })
        if not data["evidencias"]:
            problems.append("nenhuma evidência indicada")
        wrong = sorted(set(LETTERS) - {answer})
        seen = [d["letra"] for d in data["distratores"]]
        if sorted(seen) != wrong:
            problems.append(f"distratores devem cobrir exatamente {''.join(wrong)} (veio {''.join(seen) or 'nenhum'})")
        for d in data["distratores"]:
            if d["confianca"] == "baixa":
                problems.append(f"distrator {d['letra']} com confiança baixa")
            if d["tipo"] == "nao_classificado" and len(d["justificativa"].strip()) < 10:
                problems.append(f"distrator {d['letra']} não classificado sem justificativa")
            if d["tipo_secundario"] == d["tipo"]:
                problems.append(f"distrator {d['letra']} com tipo secundário igual ao principal")
            suggestion["distractors"].append({
                "letter": d["letra"], "type": d["tipo"], "secondary_type": None if d["tipo_secundario"] == "nenhum" else d["tipo_secundario"],
                "confidence": d["confianca"], "rationale": d["justificativa"],
            })
    return {"status": "pendente" if problems else "sugerida", "uncertainties": problems, **suggestion}


def provenance(raw: dict | None = None) -> dict:
    raw = raw or {}
    return {
        "provider": PROVIDER,
        "model_requested": MODEL,
        "model_served": raw.get("model_served"),
        "fallback_ran": raw.get("fallback_ran", False),
        "prompt_version": PROMPT_VERSION,
        "prompt_sha256": prompt_sha256(),
        "schema_version": SCHEMA_VERSION,
        "taxonomy_version": TAXONOMY["taxonomy_version"],
        "request_id": raw.get("request_id"),
        "stop_reason": raw.get("stop_reason"),
        "usage": raw.get("usage"),
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def suggest(client, payload: dict, answer: str | None) -> dict:
    """Uma questão → uma sugestão com proveniência. Nunca devolve sugestão sem modelo/prompt."""
    base = {"contract": SCHEMA_VERSION, "question": payload["number"], "foreign_language": payload.get("foreign_language"),
            "booklet_file": payload["source"]["booklet_file"], "answer_key": answer}
    if answer is None:
        return {**base, "status": "pendente", "uncertainties": ["gabarito oficial ausente"], "provenance": provenance()}
    if answer == "ANULADO":
        return {**base, "status": "pendente", "uncertainties": ["questão anulada: sem distratores a etiquetar"], "provenance": provenance()}
    import anthropic

    try:
        raw = call_model(client, request_params(payload, answer))
    except anthropic.APIStatusError as e:  # 4xx/5xx: registra e segue; nada é inventado
        return {**base, "status": "pendente", "uncertainties": [f"falha na API ({e.status_code})"],
                "provenance": provenance({"request_id": getattr(e, "request_id", None)})}
    except anthropic.APIConnectionError:
        return {**base, "status": "pendente", "uncertainties": ["falha de conexão com a API"], "provenance": provenance()}
    return {**base, **postprocess(raw, payload, answer), "provenance": provenance(raw)}


def answer_for(payload: dict) -> str | None:
    from crossmatch import parse_answer_key

    m = re.search(r"_(D\d)_CD(\d+)", payload["source"]["booklet_file"])
    gb = ROOT / "raw" / "enem-2025" / f"2025_GB_impresso_{m.group(1)}_CD{m.group(2)}.pdf"
    if not gb.exists():
        return None
    return parse_answer_key(gb).get((payload["number"], payload.get("foreign_language")))


def main() -> int:
    dry = "--dry-run" in sys.argv
    paths = [Path(p) for p in sys.argv[1:] if not p.startswith("--")]
    client = None if dry else make_client()
    out_dir = ROOT / "raw" / "tagging"
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for p in paths:
        payload = json.loads(p.read_text(encoding="utf-8"))["payload"]
        answer = answer_for(payload)
        if dry:
            params = request_params(payload, answer or "?")
            print(json.dumps({k: v for k, v in params.items() if k != "system"}, ensure_ascii=False, indent=1)[:4000])
            continue
        s = suggest(client, payload, answer)
        (out_dir / p.name).write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")
        rows.append({"file": p.name, "status": s["status"], "uncertainties": s["uncertainties"], "model_served": s["provenance"]["model_served"]})
        print(f"{p.name}: {s['status']} · {len(s['uncertainties'])} incerteza(s)")
    if rows:
        summary = {"prompt_version": PROMPT_VERSION, "prompt_sha256": prompt_sha256(), "model_requested": MODEL, "rows": rows}
        (REPO / "data" / "extraction" / "enem-2025-etiquetagem-piloto.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
