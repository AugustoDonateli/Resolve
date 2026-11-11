"""Checagens automáticas de uma extração (defeitos que apareceram nos cadernos de 2025).

Uso: python checar_extracao.py raw/extraction/2024_D2_CD7.json [...]
Lista, por questão: palavra longa grudada, glifo não mapeado "(cid:", grau duplicado, π trocado
por "p", texto de capa/rodapé colado, alternativa muito maior que as irmãs, texto-base vazio,
lista (•) no comando, fração empilhada embaralhada ("+ + 25 25"), ligadura duplicada e menção a texto compartilhado ("Texto para as questões").
"""
import json, re, statistics, sys

CHECKS = [
    ("palavra grudada", re.compile(r"[A-Za-zÀ-ú]{24,}")),
    ("glifo não mapeado", re.compile(r"\(cid:\d+\)")),
    ("grau duplicado", re.compile(r"°°")),
    ("π como p", re.compile(r"aproxima\w* para p\b|\bp ?rad\b")),
    ("fração embaralhada", re.compile(r"^[=×÷+·⋅] |[×+] [×+]|\b(?!\d{1,3} \d{3}\b)\d+ \d+\b")),
    ("ligadura duplicada", re.compile(r"fifi|flfl")),
    ("capa ou rodapé", re.compile(r"\b(1º|2º) Dia\b|CADERNO \d+ [•|]|ENEM20\d\d|Capa (Azul|Amarela)", re.I)),
]

def texts(q):
    for b in q.get("stimulus_blocks") or []:
        yield "texto", b.get("text") or ""
    yield "comando", q.get("command") or ""
    for k, v in (q.get("alternatives") or {}).items():
        yield f"alternativa {k}", v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)

def main():
    total = 0
    for path in sys.argv[1:]:
        data = json.load(open(path))
        print(f"== {data['file']}")
        for q in data["questions"]:
            key = f"{q['number']}{'/' + q['foreign_language'] if q['foreign_language'] else ''}"
            found = []
            for where, t in texts(q):
                for name, rx in CHECKS:
                    m = rx.search(t)
                    if m: found.append(f"{name} ({where}: “{m.group(0)[:40]}”)")
            alts = {k: len(v if isinstance(v, str) else json.dumps(v)) for k, v in (q.get("alternatives") or {}).items()}
            if alts:
                med = statistics.median(alts.values())
                found += [f"alternativa {k} muito longa ({n} × mediana {med:.0f})" for k, n in alts.items() if n > 2.5 * max(med, 12)]
            if not (q.get("stimulus_blocks") or []) and len(q.get("command") or "") < 400:
                found.append("texto-base vazio")
            if "•" in (q.get("command") or ""):
                found.append("lista no comando")
            if len(q.get("command") or "") > 420:
                found.append("comando muito longo (texto-base no comando?)")
            if found:
                total += 1
                print(f"  {key}: " + "; ".join(found))
        shared = set()
        for q in data["questions"]:
            for _, t in texts(q):
                m = re.search(r"[Tt]exto para as [Qq]uest[õo]es de (\d+) a (\d+)", t)
                if m: shared.add(m.group(0))
        if shared: print("  texto compartilhado mencionado:", shared)
    print(f"\n{total} questão(ões) com alerta")

if __name__ == "__main__":
    main()
