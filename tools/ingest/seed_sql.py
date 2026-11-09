"""Gera a migração de carga da matriz v1 e das fontes da edição 2025 (F2-T02/F2-T06).

Lê data/matriz/enem-matriz-v1.json e data/manifests/*.json e escreve SQL determinístico.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def q(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def main() -> int:
    out = Path(sys.argv[1])
    m = json.loads((REPO / "data/matriz/enem-matriz-v1.json").read_text(encoding="utf-8"))
    docs = json.loads((REPO / "data/manifests/enem-documentos.json").read_text(encoding="utf-8"))
    ed = json.loads((REPO / "data/manifests/enem-2025.json").read_text(encoding="utf-8"))
    mf = next(f for f in docs["files"] if f["kind"] == "matriz")
    assert mf["sha256"] == m["source"]["sha256"], "matriz do JSON difere do arquivo do manifesto"

    rights_inep = "Publicação do Inep; reprodução permitida com citação da fonte. Uso no Resolve: estudo pessoal; republicação ampla a revisar antes de abrir ao público."
    sources = [{
        "title": m["source"]["title"], "url": mf["url"], "edition": "v1 (abril de 2026)", "kind": "matriz",
        "retrieved_at": mf["retrieved_at"], "sha256": mf["sha256"], "bytes": mf["bytes"], "pages": mf["pages"],
        "rights": m["source"]["rights"], "meta": {"manifest": "data/manifests/enem-documentos.json", "file": mf["file"]},
    }]
    for f in ed["files"]:
        if f["status"] != "baixado":
            continue
        sources.append({
            "title": f"Enem 2025 · {'Caderno de questões' if f['kind'] == 'prova' else 'Gabarito'} · {f['day_code'].replace('D', 'Dia ')} · Caderno {f['booklet']} ({f.get('color') or 'cor não identificada'})",
            "url": f["url"], "edition": "2025", "kind": f["kind"], "retrieved_at": f["retrieved_at"], "sha256": f["sha256"],
            "bytes": f["bytes"], "pages": f["pages"], "rights": rights_inep,
            "meta": {**{k: f.get(k) for k in ("day_code", "booklet", "color", "variant", "application", "file")}, "manifest": "data/manifests/enem-2025.json"},
        })
    cover = next(f for f in ed["files"] if f.get("kind") == "prova" and f.get("booklet") == 1)
    rules = {
        "source_note": "Instruções da capa do Caderno 1 (dia 1) e do Caderno 5 (dia 2) da aplicação regular de 2025.",
        "options_per_item": 5,
        "days": [
            {"day": 1, "duration_minutes": 330, "start_time_local": None, "essay": True, "items": [
                {"area": "LC", "from": 1, "to": 45, "foreign_language": {"from": 1, "to": 5, "options": ["ingles", "espanhol"]}},
                {"area": "CH", "from": 46, "to": 90}]},
            {"day": 2, "duration_minutes": 300, "start_time_local": None, "essay": False, "items": [
                {"area": "CN", "from": 91, "to": 135}, {"area": "MT", "from": 136, "to": 180}]},
        ],
        "start_time_note": "Horário de início não consta no caderno; registrar com fonte oficial antes de usar no Dia D.",
    }
    payload = {
        "sources": sources,
        "matrix": {"label": m["label"], "source_sha256": mf["sha256"], "axes": m["cognitive_axes"], "areas": m["areas"]},
        "profile": {"label": "Enem 2025 · aplicação regular (referência)", "year": 2025, "rules": rules, "source_sha256": cover["sha256"]},
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    assert "$j$" not in blob
    L = ["-- Gerado por tools/ingest/seed_sql.py a partir de data/matriz e data/manifests — não editar à mão.", f"""do $$
declare
  d jsonb := $j${blob}$j$::jsonb;
  v uuid; a jsonb; c jsonb; sk jsonb; s jsonb; v_area uuid; v_comp uuid;
begin
  for s in select * from jsonb_array_elements(d->'sources') loop
    insert into public.sources (title, institution, url, edition, kind, retrieved_at, sha256, bytes, pages, rights_status, metadata)
    values (s->>'title', 'Inep/MEC', s->>'url', s->>'edition', s->>'kind', (s->>'retrieved_at')::timestamptz, s->>'sha256',
            (s->>'bytes')::bigint, (s->>'pages')::int, s->>'rights', s->'meta')
    on conflict (url, sha256) do nothing;
  end loop;

  insert into public.matrix_versions (label, source_id, status)
  select d->'matrix'->>'label', id, 'draft' from public.sources where sha256 = d->'matrix'->>'source_sha256'
  returning id into v;

  for a in select * from jsonb_array_elements(d->'matrix'->'axes') loop
    insert into public.cognitive_axes (matrix_version_id, code, roman, label, description)
    values (v, a->>'code', a->>'roman', a->>'label', a->>'description');
  end loop;

  for a in select * from jsonb_array_elements(d->'matrix'->'areas') loop
    insert into public.areas (matrix_version_id, code, label) values (v, a->>'code', a->>'label') returning id into v_area;
    for c in select * from jsonb_array_elements(a->'competencies') loop
      insert into public.competencies (matrix_version_id, area_id, code, number, description, source_page)
      values (v, v_area, c->>'code', (c->>'number')::smallint, c->>'description', (c->>'page')::int);
    end loop;
    for sk in select * from jsonb_array_elements(a->'skills') loop
      select id into v_comp from public.competencies where competencies.area_id = v_area and code = sk->>'competency';
      insert into public.skills (matrix_version_id, competency_id, area_id, code, number, description, source_page)
      values (v, v_comp, v_area, sk->>'code', (sk->>'number')::smallint, sk->>'description', (sk->>'page')::int);
    end loop;
  end loop;

  update public.matrix_versions set status = 'published' where id = v;

  insert into public.exam_profiles (label, target_year, matrix_version_id, day_rules_json, status, source_id)
  select d->'profile'->>'label', (d->'profile'->>'year')::smallint, v, d->'profile'->'rules', 'reference', id
  from public.sources where sha256 = d->'profile'->>'source_sha256';
end $$;
"""]
    out.write_text("\n".join(L), encoding="utf-8")
    print(f"{out} · {len(L)} linhas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
