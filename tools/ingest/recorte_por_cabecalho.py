"""Recorta figuras das questões indicadas usando figures.py com a região derivada dos cabeçalhos."""
import hashlib, json, sys
from pathlib import Path
import pdfplumber, pypdfium2 as pdfium
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent))
import figures as F
from audit_figuras import headers

pdf_path, targets, outdir = sys.argv[1], json.loads(sys.argv[2]), Path(sys.argv[3])
outdir.mkdir(parents=True, exist_ok=True)
plumb, pdfi = pdfplumber.open(pdf_path), pdfium.PdfDocument(pdf_path)
result = []
for key, qn, pages in targets:
    for pno in pages:
        page = plumb.pages[pno - 1]
        hs = headers(page); mid = page.width / 2
        h = next((x for x in hs if x['n'] == qn), None)
        if h:
            full = all(x['x0'] < mid - 20 for x in hs)
            x0, x1 = (36, page.width - 36) if full else ((mid + 4, page.width - 30) if h['x0'] > mid - 20 else (30, mid - 4))
            top = h['top'] + 14
        else:  # continuação na página seguinte: do topo útil da coluna
            x0, x1, top = 30, page.width - 30, 95
        q = {'bbox_by_page': {str(pno): [x0 + 6, top + 6, x1 - 6, top + 40]}}
        figs = F.figures_on_page(page, q, pno)
        ppage = pdfi[pno - 1]
        img = ppage.render(scale=F.SCALE).to_pil().convert('RGB')
        cx0, _, _, cy1 = ppage.get_cropbox(); mx0, _, _, my1 = ppage.get_mediabox()
        dx, dy = cx0 - mx0, my1 - cy1
        for i, g in enumerate(figs, 1):
            crop_pt = F.crop_box(page, g)
            px = tuple(round((v - (dx if k % 2 == 0 else dy)) * F.SCALE) for k, v in enumerate(crop_pt))
            piece = img.crop(px)
            name = f"{key.replace('/', '_')}_p{pno}_{i}.png"
            piece.save(outdir / name, optimize=True)
            data = (outdir / name).read_bytes()
            result.append({'key': key, 'page': pno, 'n': i, 'kind': g['kind'],
                           'role': f"alternativa {g['alternative']}" if g['alternative'] else 'texto-base/comando',
                           'bbox_pt': [round(v, 2) for v in crop_pt], 'png': name,
                           'sha256': hashlib.sha256(data).hexdigest(), 'w': piece.width, 'h': piece.height,
                           'cut_check': F.cut_check(page, g)})
print(json.dumps(result, ensure_ascii=False))
