# 0007 — Agenda de revisão e esquema de redação

Data: 9 nov. 2026 · Sessão 10

## Agenda de revisão (F3-T07)

1. **Agenda versionada e só acrescentada.** `review_schedulers` guarda a versão `srs-v1`: intervalos `{1, 3, 7, 14, 30}` dias (plano §7, Revisão) e 3 minutos por item no lote. Os 3 minutos vêm do alvo inicial de ritmo do plano (§7, Durações dos treinos) e mudam só com uma versão nova. Cada item e cada evento guardam a versão usada.
2. **A agenda é alimentada pela confirmação da resposta.** `submit_attempt` chama `private.apply_review` na mesma transação. Um evento por tentativa (`review_events.attempt_id` único), então reenviar a mesma confirmação não agenda duas vezes. Nenhum cliente escreve nas tabelas da agenda.
3. **Regras:**
   - Erro → etapa 0, vence no dia local seguinte. Vale também para quem estava em etapa avançada (o erro reinicia a sequência).
   - Acerto antes do vencimento → registrado como `acerto_antecipado`, sem mudar a agenda.
   - Acerto com ajuda → mesma etapa, repete o intervalo. Não conta como independente (plano §7 e §11).
   - Acerto independente → próxima etapa com o intervalo dela.
   - Acerto na última etapa → `concluida`, e a entrada do caderno de erros recebe `resolved_at`. É aqui que o erro se resolve (decisão 0006, item 5).
4. **Fuso.** O vencimento é uma data local no fuso do perfil (`profiles.timezone`). Fuso inválido ou ausente cai em `America/Sao_Paulo`. A fila compara com a data local de "agora" no fuso do aluno, então quem muda de fuso vê a fila da sua data local.
5. **Fila sem dívida impossível.** `review_queue(p_available_minutes)` devolve todos os vencidos, do mais atrasado ao mais recente. Marca como lote os que cabem no tempo disponível (minutos ÷ 3); o restante aparece fora do lote, sem sumir. A função usa a conta do login.

## Esquema de redação (F5-T02)

6. **Rubrica oficial, não inventada.** As cinco competências e os seis níveis (0 a 200) vêm da *Matriz de Referência* do Inep (abril de 2026), p. 29–31. A extração é feita por `tools/ingest/rubrica.py` e conferida trecho a trecho contra o texto da página, depois visualmente na p. 31. O banco guarda a rubrica `enem-redacao-v1` ligada à fonte pelo sha256. A publicação não traz as regras de discrepância entre avaliadores: elas ficam ausentes até a F5-T11, que precisa de fonte própria.
7. **Tema só publica com fonte.** Um tema publica só se tiver texto motivador e se todos os textos estiverem com direitos `verificado`. Tema publicado é imutável, salvo retirada, e seus textos motivadores congelam.
8. **Versão enviada é imutável.**
   - Parágrafos só no formato `{id, text}`. O texto corrido é derivado no banco (parágrafos unidos por linha em branco); o que o cliente mandar nesse campo é ignorado.
   - Enviar grava a data e a impressão sha256 do texto. A partir daí a versão não muda, não volta a rascunho e não é apagada. Uma redação com versão enviada também não é apagada.
   - Reescrever cria uma versão nova ligada à anterior.
9. **Texto do aluno sem filtro de HTML.** O texto do aluno é sempre exibido como texto, nunca interpretado. O banco recusa só caracteres de controle e de inversão de direção; um aluno pode escrever "<" numa redação.
10. **Só o dono lê a redação.** Nem o editor lê redações, versões, correções ou resultados de outra conta. Anexo só na pasta da própria conta (`<id>/redacoes/…` no bucket `pessoal`). Correções, avaliações, anotações e resultados são gravados só pelo serviço de correção (F5-T08 em diante); o aluno lê os seus.
11. **Avaliação coerente com a rubrica.**
    - Exatamente C1–C5, cada nota num degrau permitido e total igual à soma; a avaliação é imutável.
    - Anotação aponta para um trecho dentro de um parágrafo da versão avaliada. "Ausente" não aceita trecho, para não inventar citação (F5-T13).
    - Faixa `calibrado` exige execução de calibração; o padrão é `nao_calibrado`.
12. **Correção de recursão.** A primeira política de remoção de redação consultava as versões, cuja política consulta as redações, o que causa recursão infinita. Agora só o dono remove. O gatilho da versão enviada impede a remoção em cascata.
