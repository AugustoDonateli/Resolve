# 0009 — Disponibilidade, compromissos e exceções de um dia

Data: 10 nov. 2026 · Sessão 12 · Tarefa F4-T13

1. **Três tabelas:**
   - `availability_rules`: horários livres para estudar, toda semana;
   - `fixed_commitments`: compromissos fixos, toda semana, com nome;
   - `schedule_exceptions`: o `date_overrides` do plano §4.4. Cancela ou muda o horário de uma ocorrência, ou cria um horário avulso.

   Uma exceção nunca altera a regra semanal. Desfazer a mudança de um dia é apagar a exceção.
2. **Fuso:**
   - cada regra guarda o próprio fuso (padrão: o do perfil);
   - as ocorrências são calculadas no fuso da regra e mostradas no fuso do perfil de quem vê;
   - o horário de verão do fuso da regra é respeitado (ex.: 18h de Nova York aparece como 20h em São Paulo em dezembro e 19h em abril).
3. **Dia da semana e fuso não mudam depois de criados.** Para trocá-los, encerre a regra (`valid_until`) ou remova-a, e crie outra. Isso mantém válidas as exceções já registradas.
4. **Início e fim no mesmo dia.** Para virar a noite, criam-se dois horários.
5. **Conflito, conferido no banco** sobre as ocorrências do próximo ano (de ontem até hoje + 371 dias):
   - compromisso não se sobrepõe a compromisso;
   - horário livre não se sobrepõe a horário livre;
   - horário livre e compromisso podem se sobrepor: o tempo de estudo efetivo é o livre menos os compromissos, e quem calcula isso é a agenda automática (F4-T15);
   - horários que só se encostam (um termina às 20:00 e o outro começa às 20:00) não colidem;
   - a recusa diz com o quê colide, com data e horário. Exemplo: "Colide com o compromisso Aula de inglês em 15/03/2027, das 19:00 às 20:00."

   Como a conferência usa as ocorrências concretas, ela pega conflitos entre fusos diferentes e conflitos que só existem em parte do ano.
6. **Desfazer também é conferido.** Se um avulso ocupou o horário de uma aula cancelada, desfazer o cancelamento é recusado.
7. **Limites:**
   - exceções de ontem até um ano à frente;
   - regra começando até um ano à frente;
   - consulta de até 63 dias por vez.
8. **Concorrência:** uma trava por conta (`pg_advisory_xact_lock`) serializa as gravações da agenda da mesma conta, para que duas abas não criem sobreposição ao mesmo tempo.
9. **Acesso:**
   - cada conta lê e escreve só as próprias regras e exceções;
   - os gatilhos são de definidor e conferem o dono da regra antes de aceitar uma exceção;
   - `schedule_occurrences` usa sempre a conta do login.
10. **Migrações sem comandos destrutivos.** O MCP do Supabase pede confirmação para `delete`/`drop`, e o pedido não chega ao app. Desativar, renomear ou mover para `private` substitui a remoção (sessão 12, F3-T09).
