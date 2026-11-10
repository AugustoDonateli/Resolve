"""Auditoria: imagens/gráficos na região de cada questão do PDF oficial (cabeçalho até o próximo, na mesma coluna)."""
import json, re, sys
import pdfplumber

def headers(page):
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
    out = []
    for i, w in enumerate(words):
        if re.fullmatch(r'QUEST[ÃA]O', w['text'], re.I) and i + 1 < len(words) and re.fullmatch(r'\d{2,3}', words[i + 1]['text']):
            out.append({'n': int(words[i + 1]['text']), 'x0': w['x0'], 'top': w['top']})
    return out

def run(path, lang_pages):
    res = {}
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            hs = headers(page)
            if not hs: continue
            mid = page.width / 2
            cols = {}
            for h in hs:
                cols.setdefault(h['x0'] > mid - 20, []).append(h)
            full = len(cols) == 1 and all(h['x0'] < mid - 20 for h in hs)
            for right, lst in cols.items():
                lst.sort(key=lambda h: h['top'])
                for k, h in enumerate(lst):
                    bottom = lst[k + 1]['top'] if k + 1 < len(lst) else page.height - 60
                    x0, x1 = (0, page.width) if full else ((mid, page.width) if right else (0, mid))
                    def inside(o):
                        return o['x0'] >= x0 - 2 and o['x1'] <= x1 + 2 and o['top'] >= h['top'] + 10 and o['bottom'] <= bottom
                    imgs = [o for o in page.images if inside(o) and (o['x1'] - o['x0']) * (o['bottom'] - o['top']) > 1500]
                    curves = [o for o in page.curves + page.rects if inside(o) and (o['x1'] - o['x0']) > 25 and (o['bottom'] - o['top']) > 25]
                    lang = lang_pages.get(pno)
                    key = f"{h['n']}" + (f"/{lang}" if lang and h['n'] <= 5 else "")
                    res.setdefault(key, {'images': 0, 'shapes': 0, 'pages': []})
                    res[key]['images'] += len(imgs); res[key]['shapes'] += len(curves); res[key]['pages'].append(pno)
    return res

if __name__ == '__main__':
    path = sys.argv[1]
    lang_pages = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    lang_pages = {int(k): v for k, v in lang_pages.items()}
    print(json.dumps(run(path, lang_pages)))
