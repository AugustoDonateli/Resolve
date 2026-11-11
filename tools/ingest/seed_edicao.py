"""Gera a migração de carga de uma edição já baixada (fontes, perfil de referência, aplicação e cadernos).

Uso: python seed_edicao.py 2024 <saida.sql>
Lê data/manifests/enem-<ano>.json. As regras do perfil (duração, faixas, redação) devem ter sido
conferidas nas capas dos cadernos da edição; o script exige a frase de duração nas capas.
"""
import json, re, sys
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]

def main() -> int:
    year, out = sys.argv[1], Path(sys.argv[2])
    man = f"data/manifests/enem-{year}.json"
    ed = json.loads((REPO / man).read_text(encoding="utf-8"))
    files = [f for f in ed["files"] if f.get("status") == "baixado"]
    cover1 = next(f for f in files if f["kind"] == "prova" and f["day_code"] == "D1")
    cover2 = next(f for f in files if f["kind"] == "prova" and f["day_code"] == "D2")
    for f, phrase in ((cover1, "cinco horas e trinta minutos"), (cover2, "cinco horas.")):
        with pdfplumber.open(ROOT / "raw" / f"enem-{year}" / f["file"]) as p:
            assert phrase in p.pages[0].extract_text().replace("\n", " "), f"capa de {f['file']} sem '{phrase}'"
    rights = "Publicação do Inep; reprodução permitida com citação da fonte. Uso no Resolve: estudo pessoal; republicação ampla a revisar antes de abrir ao público."
    sources = [{
        "title": f"Enem {year} · {'Caderno de questões' if f['kind'] == 'prova' else 'Gabarito'} · {f['day_code'].replace('D', 'Dia ')} · Caderno {f['booklet']} ({f['color']})",
        "url": f["url"], "edition": year, "kind": f["kind"], "retrieved_at": f["retrieved_at"], "sha256": f["sha256"],
        "bytes": f["bytes"], "pages": f["pages"], "rights": rights,
        "meta": {**{k: f.get(k) for k in ("day_code", "booklet", "color", "variant", "application", "file")}, "manifest": man},
    } for f in files]
    rules = {
        "source_note": f"Instruções da capa do Caderno {cover1['booklet']} (dia 1) e do Caderno {cover2['booklet']} (dia 2) da aplicação regular de {year}.",
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
    label = f"Enem {year} · aplicação regular"
    d = {"sources": sources, "year": int(year), "profile": {"label": f"{label} (referência)", "rules": rules, "source_sha256": cover1["sha256"]}, "label": label, "manifest": man}
    blob = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    assert "$j$" not in blob
    out.write_text(f"""-- Gerado por tools/ingest/seed_edicao.py {year} a partir de {man} — não editar à mão.
-- Fontes, perfil de referência (regras conferidas nas capas), aplicação regular e cadernos da edição {year}.
do $$
declare d jsonb := $j${blob}$j$::jsonb; s jsonb;
begin
  for s in select * from jsonb_array_elements(d->'sources') loop
    insert into public.sources (title, institution, url, edition, kind, retrieved_at, sha256, bytes, pages, rights_status, metadata)
    values (s->>'title', 'Inep/MEC', s->>'url', s->>'edition', s->>'kind', (s->>'retrieved_at')::timestamptz, s->>'sha256',
            (s->>'bytes')::bigint, (s->>'pages')::int, s->>'rights', s->'meta')
    on conflict (url, sha256) do nothing;
  end loop;
  insert into public.exam_profiles (label, target_year, matrix_version_id, day_rules_json, status, source_id)
  select d->'profile'->>'label', (d->>'year')::smallint, (select id from public.matrix_versions where status = 'published' limit 1),
         d->'profile'->'rules', 'reference', s2.id
  from public.sources s2 where s2.sha256 = d->'profile'->>'source_sha256'
  on conflict (label) do nothing;
  insert into public.applications (year, type, label, profile_id)
  select (d->>'year')::smallint, 'regular', d->>'label', p.id from public.exam_profiles p where p.label = d->'profile'->>'label'
  on conflict (year, type, label) do nothing;
  insert into public.booklets (application_id, day, booklet_number, color, variant, source_id, answer_key_source_id)
  select a.id, substr(s1.metadata->>'day_code', 2)::smallint, (s1.metadata->>'booklet')::smallint, s1.metadata->>'color',
         s1.metadata->>'variant', s1.id, g.id
  from public.sources s1
  join public.applications a on a.year = (d->>'year')::smallint and a.type = 'regular' and a.label = d->>'label'
  left join public.sources g on g.kind = 'gabarito' and g.metadata->>'manifest' = s1.metadata->>'manifest'
    and g.metadata->>'day_code' = s1.metadata->>'day_code' and g.metadata->>'booklet' = s1.metadata->>'booklet'
  where s1.kind = 'prova' and s1.metadata->>'manifest' = d->>'manifest'
  on conflict (application_id, day, booklet_number, variant) do nothing;
end $$;
""", encoding="utf-8")
    print(out, len(sources), "fontes")
    return 0

if __name__ == "__main__":
    sys.exit(main())
