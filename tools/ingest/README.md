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
