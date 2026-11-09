# Extração piloto — F2-T07 (9 nov. 2026)

Critério: "Ordem de leitura e páginas conferíveis contra o original."
Ferramenta: `tools/ingest/extract.py` (pdfplumber + pypdfium2), sobre os PDFs oficiais do Enem 2025 listados em `data/manifests/enem-2025.json`.
Saída do piloto: `data/extraction/enem-2025-piloto.json` (status `proposta_para_revisao`, **não publicada**).
Conferência visual: `docs/validation/f2-t07/*.png`. Cada questão aparece com uma caixa azul, as figuras com caixa rosa, desenhadas sobre a página original.

## Cadernos inteiros (varredura de estrutura)

| Caderno | Questões localizadas | Com 5 alternativas | Avisos |
|---|---|---|---|
| Dia 1 · Caderno 1 Azul | 95/95 (90 + 5 da opção espanhol) | 95 | 12 com figura; 1 com índice em fórmula |
| Dia 2 · Caderno 7 Azul | 90/90 | 88 | 51 com figura; 18 com índices; 8 com alternativas em figura; 2 com alternativas em grade (só parte das letras detectada) |

Páginas de redação (proposta, instruções, folha) são reconhecidas e ficam fora das questões. Cabeçalho, rodapé e o microtexto da marca d'água (corpo 1,5, cerca de 21.600 caracteres por caderno) são removidos: 0 ocorrências no texto final.

## As 10 questões do piloto

| # | Questão | Por que foi escolhida | Ordem e páginas | Texto | Pendência para a revisão humana |
|---|---|---|---|---|---|
| 1 | D1 Q01 (inglês) | Língua estrangeira, texto longo | p. 2 ✓ | 4 parágrafos, crédito, comando e A–E conferidos | — |
| 2 | D1 Q01 (espanhol) | Mesma posição, outra opção | p. 4 ✓ | 2 estrofes com quebras de verso preservadas | — |
| 3 | D1 Q03 (inglês) | Poema recuado | p. 2 ✓ | 5 estrofes, versos preservados | — |
| 4 | D1 Q45 | Charge (imagem), fim da área antes da redação | p. 19 ✓ (não invade a proposta de redação) | Texto e crédito conferidos | O texto dentro do desenho não é extraível: precisa de descrição (alt) revisada |
| 5 | D1 Q63 | Humanas com gráfico | p. 26 ✓ | Comando e A–E conferidos | Título do gráfico e nota "*Fatia…" saíram como parágrafos: marcar como legenda da figura |
| 6 | D2 Q105 | Diagrama com rótulos | p. 5 ✓ | Texto, crédito, comando e A–E conferidos | Rótulos do diagrama estão na imagem |
| 7 | D2 Q106 | Fórmulas com índices | p. 5 ✓ | "AzO²", "NaAzO³", "HAzO³ e CaCl²" conferidos com a página (notação de 1909 da própria questão) | Foto e lousa em imagem |
| 8 | D2 Q119 | Alternativas em desenho vetorial | p. 9 ✓ | Texto e comando conferidos | A–E sem texto (são circuitos): recorte das figuras é a F2-T08 |
| 9 | D2 Q140 | Matemática com subscritos | p. 18 ✓ | "S₁" e "S₂" convertidos e conferidos; comando e A–E conferidos | — |
| 10 | D2 Q169 | Tabela + alternativas em gráfico | p. 28 ✓ | Texto-base conferido | Tabela vira texto corrido no comando. Alternativas em grade (A/D, B/E, C): só A–C detectadas. **Bloqueia publicação até revisão manual** |

Resultado: 10/10 com página e ordem de leitura corretas. Em 6 das 10, o texto saiu pronto para revisão sem correção (1, 2, 3, 7, 9 e o texto de 6). As demais dependem de figura ou tabela, como o plano previa (§5, item 3: OCR e recortes só onde a extração não resolve).

## Defeitos encontrados e corrigidos durante o piloto

1. Detecção de colunas: a calha entre colunas não fica no centro exato (ex.: 316–328 pt numa página de 637 pt). O extrator passou a procurar a faixa vertical mais vazia entre 35% e 65% da largura.
2. "Questão 105" vinha com outra caixa de letra em algumas páginas: o cabeçalho passou a ser reconhecido sem diferenciar maiúsculas.
3. A proposta de redação era absorvida pela Q45: páginas de redação passaram a ser reconhecidas inteiras.
4. Rodapé e marca d'água vazavam para a alternativa E: o rodapé é localizado pela posição e o microtexto é filtrado pelo corpo da fonte.
5. Subscritos e sobrescritos viravam linhas soltas ("S" e "1" separados): cada índice volta à linha de base e dígitos/sinais viram caracteres Unicode (₁, ²).
6. Figuras da coluna vizinha eram atribuídas à questão errada: a atribuição passou a respeitar a coluna.
7. Caixas de conferência deslocadas: pdfplumber usa a MediaBox e o pypdfium2 desenha a CropBox (origem em 34,8 pt). O desenho agora desconta essa origem.

## Limitações registradas (não resolvidas nesta tarefa)

- Letras em índice (ex.: "Cl₂" sem dígito, ou "x" sobrescrito) não têm Unicode confiável: ficam como texto comum, com aviso.
- Tabelas não são reconstruídas como tabela.
- Alternativas em grade de duas colunas não são separadas.
- Texto dentro de imagens não é extraído (OCR não foi usado neste piloto).
- Nenhum item foi ao banco. A publicação depende de revisão editorial (F2-T12/T13/T15).

## Medição de tempo

Extração de um caderno de 32 páginas: cerca de 10 s neste contêiner. O tempo de revisão humana por item será medido no piloto de 30 (F2-T15/T16).
