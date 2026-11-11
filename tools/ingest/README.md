# Importação editorial (local)

Ferramentas executadas pelo operador, fora do servidor da aplicação (plano §2 e §5).
PDFs e microdados brutos ficam em `tools/ingest/raw/` (ignorado pelo git). O que vai
para o repositório é o **manifesto**: origem, hash, tamanho e metadados de cada arquivo.

```bash
cd tools/ingest
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python fetch.py enem-2025          # baixa e confere, gera data/manifests/enem-2025.json
```

## Certificado do INEP

`download.inep.gov.br` envia o certificado sem o intermediário da cadeia (o navegador
o busca sozinho pelo campo AIA; Python e curl não). `certs/rnp-icpedu-gr46-ov-tls-ca-2025.pem`
é esse intermediário, publicado pela GlobalSign (`secure.globalsign.com/cacert/rnpicpedugr46ovtlsca2025.crt`)
e assinado pela raiz GlobalSign Root R46. A verificação TLS continua ligada: o intermediário
só completa a cadeia até uma raiz confiável do sistema.

## Área editorial e etiquetagem (sessão 07)

```bash
# propostas, dúvidas e páginas para a revisão editorial (conta com papel de editor)
RESOLVE_EDITOR_EMAIL=... RESOLVE_EDITOR_PASSWORD=... .venv/bin/python load_editorial.py D1_CD1 D2_CD7 [--fixture]

# sugestões de etiqueta (chave própria do projeto; --dry-run mostra o pedido sem chamar a API)
RESOLVE_ANTHROPIC_API_KEY=... .venv/bin/python tagging.py raw/proposals/D2_CD7_Q140.json
```

`load_editorial.py` entra com a sessão do editor (as políticas do banco valem; nenhuma chave de serviço) e é idempotente pela nota do lote. `tagging.py` nunca grava sugestão sem modelo e prompt; qualquer incerteza deixa a sugestão pendente para a revisão (F2-T13).

## Revisão editorial assistida (sessão 14)

- `audit_figuras.py <pdf> [páginas-de-língua-json]`: para cada questão do PDF oficial, conta imagens e gráficos vetoriais na região do cabeçalho até o próximo; cruzar com as figuras da proposta mostra figura essencial ausente.
- `recorte_por_cabecalho.py <pdf> <alvos-json> <pasta>`: recorta as figuras com a lógica de `figures.py`, usando a região derivada dos cabeçalhos (a região gravada na proposta pode errar).
- `aplicar_revisao.mjs <job.json>`: aplica figuras (envio a `editorial/figuras/<sha256>.png`), textos alternativos, correções de texto, fechamento de dúvidas e preenchimento de letra vazia no cruzamento, sempre com a sessão de um editor (`RESOLVE_EDITOR_ENV` aponta para um arquivo com `RESOLVE_EDITOR_EMAIL`/`RESOLVE_EDITOR_PASSWORD`; `RESOLVE_JOB_DIR` para a pasta com o job, `crops.json`, `adjusted.json` e `figs/`). `DRY=1` só lista o que faria. Não é idempotente para figuras: rode uma vez por job.
- `corrigir_espacos.mjs <extração.json> "<filtro do lote>"`: restaura espaços entre palavras nas propostas já gravadas, trocando só trechos que são exatamente a junção de palavras da nova extração da mesma questão (nova revisão, sessão de editor; `DRY=1` lista sem gravar). Necessário porque a extração antiga descartava o caractere de espaço do PDF e grudava palavras em linhas justificadas apertadas (corrigido em `extract.py` com `keep_blank_chars`).
- O job aceita também: várias figuras por questão (lista), alternativas que são figuras (`alternative`), quadros achatados reconstruídos como tabela em texto (`tables`, células separadas por " | "; o app desenha a tabela), troca de blocos por id (`block_fixes`, inclusive no comando), substituições literais conferidas no PDF (`replacements`) e a data do registro (`date`).
- Registro do que foi aplicado no caderno 1 em `data/editorial/2026-11-10-*` e no caderno 7 em `data/editorial/2026-11-11-caderno7-*`; espaços restaurados em 11/11 (`data/editorial/2026-11-11-espacos-*.log`).
