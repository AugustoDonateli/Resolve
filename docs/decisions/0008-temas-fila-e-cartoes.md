# 0008 — Temas oficiais, fila de correção com orçamento e cartões revisados

Data: 10 nov. 2026 · Sessão 11

## Temas e fontes (F5-T03)

1. **O primeiro tema é o oficial do Enem 2025:** "Perspectivas acerca do envelhecimento na sociedade brasileira".
   - Fonte: Caderno 1 Azul, p. 20.
   - `tools/ingest/temas.py` lê a página pela geometria e confere cada trecho com o texto da coluna.
   - A proposta é idêntica nos cadernos 2, 3 e 4.
   - O tema é a citação entre aspas da instrução, sem nenhuma palavra acrescentada. Nada é anunciado como previsão.
2. **Cada texto motivador guarda:**
   - os blocos na ordem do caderno: parágrafo, título e figura com texto alternativo;
   - a citação como está impressa;
   - quem conferiu e quando.
3. **Texto alternativo das figuras:** é uma proposta de transcrição do que aparece na figura, e precisa ser conferido pelo editor.
4. **Conferência:** mudar texto, citação, figura ou fonte de um texto já conferido o devolve para "pendente".
5. **Publicação:** só com a lista de impedimentos vazia. O banco recusa:
   - texto não conferido;
   - texto sem citação;
   - figura sem texto alternativo;
   - figura sem arquivo;
   - tema oficial sem fonte.
6. **"Conferido" (`rights_status = verificado`) significa:**
   - texto e citação batem com o caderno;
   - Guto aceita a reprodução para uso pessoal, nos mesmos termos das questões.

   Antes de abrir ao público, revisar os direitos de republicação (plano §3, regra 10).
7. **Acesso às figuras:** a figura de um tema publicado é legível por qualquer conta. A página do caderno e os rascunhos são só do editor.

## Fila de correção e orçamento (F5-T08)

8. **Envio:**
   - congela a versão;
   - cria **um trabalho por versão**: a mesma chave, ou a mesma versão com outra chave, devolve o existente;
   - reserva a primeira etapa.
9. **Reserva antes de cada etapa:**
   - Valor = custo com os tokens máximos da política × fator de segurança.
   - A reserva vale no orçamento global e no da conta, quando houver um.
   - As linhas de orçamento são travadas em ordem fixa, então reservas simultâneas nunca passam do limite. Testado contra o projeto real: 8 envios simultâneos com saldo para 3 deram 3 na fila e 5 em "limite atingido".
10. **Números de referência (plano §11):**
    - Sonnet 4.6 a US$ 3/US$ 15 por milhão de tokens, 4.000 de entrada e 1.500 de saída, com reserva de 50%. Resultado: US$ 0,05175 por etapa.
    - Limite pessoal de **US$ 5/mês**, com aviso aos 70%.
    - São propostas do plano, para Guto confirmar. Modelo e preço devem ser conferidos na página oficial antes das chamadas reais (F5-T09).
11. **Consumidor de uma etapa:**
    - Concluir registra o uso real e liquida a reserva. Uma entrega repetida não muda nada.
    - Erro conhecido sem uso libera a reserva.
    - Resultado inválido com uso registra o consumo.
    - Tempo esgotado, ou concessão vencida, deixa a reserva em "reconciliar". Sem informação do provedor, a reconciliação registra o máximo reservado como estimativa conservadora, identificada como tal.
    - Três tentativas automáticas; depois o aluno pode pedir de novo.
12. **Erro gravado:** só um código curto (`timeout`, `http:529`, `schema_invalido`). Texto livre vira `erro_nao_classificado`, para nunca levar trecho da redação ou da resposta do modelo ao registro.
13. **Quem chama o consumidor:** as funções do consumidor ficam em `private` e não são expostas pela API. O serviço de correção (F5-T09) vai chamá-las com uma conexão própria ao banco. O app continua sem chave de serviço.
14. **Exclusão (muda a decisão 0007, item 8):**
    - Uma versão enviada continua sem poder ser alterada nem apagada sozinha.
    - Apagar a redação inteira, ou a conta, leva versões, correções, avaliações e anotações (plano §3, regra 10).
    - A reserva aberta é liberada. Os registros de custo ficam, sem vínculo com o texto.

## Cartões revisados (F3-T09)

15. **Publicação:** um cartão (conceito ou fórmula) só é publicado com fonte e localização. Publicar registra a revisão com a conta do editor. Publicado não muda; só é aposentado.
16. **Entrada na fila:**
    - Errar uma questão cuja habilidade aprovada tem cartão publicado põe o cartão na fila.
    - O aluno também pode adicionar um cartão manualmente.
    - A fila do dia junta questões e cartões, com os mais atrasados primeiro.
17. **Fora da TRI:** a revisão do cartão ("lembrei"/"não lembrei") é gravada em `card_reviews`, nunca em `attempts`. A TRI e as estatísticas de questão leem só `attempts`.
18. **Agenda:** a mesma `srs-v1`. "Não lembrei" reinicia; revisar antes do vencimento não conta.
