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

## Nova edição (a partir de 11/11/2026)

Fluxo usado para o Enem 2024, com o ano em `ENEM_ANO` (padrão 2025):

```bash
SSL_CERT_FILE=/root/.ccr/ca-bundle.crt .venv/bin/python fetch.py enem-2024          # sources/enem-2024.json → raw/enem-2024 + manifesto
.venv/bin/python seed_edicao.py 2024 ../../supabase/migrations/<data>_edicao_2024.sql  # fontes, perfil (capas conferidas), aplicação e cadernos
.venv/bin/python extract.py raw/enem-2024/2024_PV_impresso_D1_CD1.pdf --out raw/extraction/2024_D1_CD1.json   # idem D1_CD2, D2_CD7, D2_CD5
.venv/bin/python checar_extracao.py raw/extraction/2024_*.json                       # defeitos conhecidos, antes de carregar
ENEM_ANO=2024 .venv/bin/python contract.py raw/extraction/2024_D1_CD1.json raw/extraction/2024_D2_CD7.json
ENEM_ANO=2024 .venv/bin/python crossmatch.py
ENEM_ANO=2024 RESOLVE_EDITOR_EMAIL=... RESOLVE_EDITOR_PASSWORD=... .venv/bin/python load_editorial.py 2024_D1_CD1 2024_D2_CD7 --gabaritos --cruzamento
```

Depois, as figuras: recortar todas as questões com `recorte_por_cabecalho.py` (não só as que a extração sinalizou: em 2024 seis questões com imagem não tinham sido sinalizadas), descartar as faixas decorativas da margem, conferir em folhas e aplicar com `aplicar_revisao.mjs`.

Defeitos corrigidos no extrator em 11/11: rodapé com "•" (2024) além de "|", contracapa colada na última alternativa, grau duplicado (°°) e ligadura "fi"/"fl" duplicada (`corrigir_ligaduras.mjs` corrige propostas antigas). Frações empilhadas em alternativas ainda saem embaralhadas: `checar_extracao.py` aponta ("fração embaralhada") e a transcrição é manual, olhando o PDF.

Questão já publicada com erro: `correct_published_item` (função de editor) cria a versão seguinte com o texto corrigido, leva junto posição e letras impressas e aposenta a anterior; o motivo fica em `item_corrections`. Usada em 11/11 nas questões 157 e 178 do caderno 7 de 2025.

## TRI e microdados (sessão 1 do plano v2, 15/11/2026)

Os microdados do Inep trazem, por edição, `ITENS_PROVA_<ano>.csv` (código, gabarito e parâmetros a, b, c de cada
item em cada prova) e `RESULTADOS_<ano>.csv` (respostas, gabarito e nota oficial de cada participante, sem
identificação). Com eles o Resolve carrega os parâmetros oficiais, confere o cálculo contra as notas oficiais e
calcula a taxa de acerto real de cada questão. O zip (500 MB a 1 GB) fica fora do repositório, em `/home/user/inep`.

```bash
# baixar com a verificação TLS ligada (mesmo intermediário de fetch.py)
python3 - <<'PY'
import ssl, urllib.request, shutil
ctx = ssl.create_default_context(); ctx.load_verify_locations(cafile="certs/rnp-icpedu-gr46-ov-tls-ca-2025.pem")
url = "https://download.inep.gov.br/microdados/microdados_enem_2025.zip"
with urllib.request.urlopen(url, context=ctx, timeout=120) as r, open("/home/user/inep/microdados_enem_2025.zip", "wb") as f:
    shutil.copyfileobj(r, f, length=1 << 20)
PY
python3 tri_inep.py manifesto /home/user/inep/microdados_enem_2025.zip 2025 <baixado-em>   # data/manifests/microdados-enem-2025.json
python3 tri_inep.py provas /home/user/inep/microdados_enem_2025.zip 2025 chaves-2025.json  # gabarito do banco (CHAVES_SQL) × provas do Inep
python3 tri_inep.py ler /home/user/inep/microdados_enem_2025.zip 2025 --amostra 8000       # ~40 s por edição
python3 tri_inep.py validar 2025 && python3 tri_inep.py cruzar 2024 2025                    # data/tri/validacao-2025.json
python3 tri_inep.py sql ../../supabase/migrations/<data>_carga_tri.sql modelo.json 2024 2025
python3 -m unittest test_tri_engine                                                          # motor em Python = engine.ts
```

- **Identificação das provas:** cada caderno do banco é ligado à prova do Inep cujo gabarito bate em 100% das
  posições publicadas; qualquer divergência interrompe. As provas "da mesma aplicação" são as que têm exatamente os
  mesmos itens, sem versão adaptada.
- **Validação:** `tri_engine.py` repete `apps/web/src/lib/tri/engine.ts` (o teste confere os dois contra a mesma
  integração fina). A escala nota = intercepto + inclinação·θ de cada área é ajustada em metade da amostra e
  conferida na outra metade; quem deixou a área inteira em branco fica fora (o Inep dá nota 0, regra da prova).
- **Gabarito protegido:** a contagem por alternativa denuncia a resposta, por isso `item_response_stats` só é
  lida pelo editor e pelo Raio-X (`item_explanation`), depois de a pessoa responder.
