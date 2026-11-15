# Resolve — Plano v2 (15 de novembro de 2026)

Pedido de Guto: um plano amplo, que vá além do que ele citou, procure o que está faltando ou passou batido, e proponha coisas ambiciosas. Parte do estado real em `docs/continuidade.md` (11 e 12/11). As regras do `CLAUDE.md` continuam: questões oficiais conferidas, nada inventado, identidade Mesa, segurança dos dados.

**Decisões de Guto (15/11)**
- Público: ele e uns 5 amigos convidados.
- Prova: ENEM 2027.
- Alvo: Ciência da Computação na UFES ou na UFV (Viçosa). O app deve permitir escolher outros cursos populares (Medicina, Direito etc.).
- IA: até US$ 10 por mês.
- Banco: provas regulares de 2015 a 2025.
- A onda de papel e câmera interessa.
- Certificado do Inep: Claude resolve.

**Quem faz o quê**
- **Opus 5.5 (extra):** dados, banco, lógica, TRI, conteúdo didático, importação de provas, testes.
- **Fable 5.2:** design, interface, animação, ilustração em código, experiência de uso.

Cada frente abaixo diz qual modelo usar. Seção 8 traz o roteiro de sessões.

---

## 1. Diagnóstico amplo: o produto visto de fora

Olhando o Resolve como um aluno que chega pela primeira vez, e não como lista de tarefas.

### 1.1 O que está bom
- **Ferramentas de treino:**
  - treino, Raio-X e revisão espaçada;
  - Dia D com cartão-resposta e replay;
  - triagem, ritmo, comando primeiro, caça ao distrator.
- **Rotina inteligente:** plano do dia, foco, sequência, reta final.
- **Redação:** editor, folha, peças, trilha, repertório.
- **Grupos e duelo.**
- **Meta de curso com média ponderada.**
- 366 questões reais publicadas.
- Identidade Mesa, que é única no mercado.

### 1.2 O que falta: o Resolve treina, mas não ensina
1. **Não existe conteúdo das matérias.** Não há aula, resumo, explicação de assunto, fórmulas organizadas nem trilha de Física, Química, Biologia, História, Geografia, Filosofia, Sociologia, Português, Literatura, Artes, Matemática, Inglês ou Espanhol. A página de habilidade mostra o texto oficial da matriz, que é escrito para professor, não para aluno.
2. **Não há mapa do que estudar.** O aluno não sabe o que cai, quanto cai, o que já domina e o que falta.
3. **As questões não estão etiquetadas** (habilidade, assunto, distratores, resolução). Sem isso, nenhum conteúdo se liga às questões.

### 1.3 O que falta: o Resolve não se explica
4. **Não há boas-vindas:** quem entra não sabe por onde começar nem o que cada seção faz.
5. **As mecânicas não são explicadas** onde aparecem: por que esta questão voltou hoje, o que é "plano adaptativo", como conta a sequência, o que significa "indisponível" na TRI, por que o treino foi para esta área.
6. **Não há ajuda, glossário nem busca.** Termos como TRI, distrator, habilidade, competência, triagem e coerência aparecem sem definição.
7. **O progresso não conta uma história.** Não há uma visão "você começou aqui, está aqui, o próximo passo é este".
8. **Há muitos modos sem guia de quando usar cada um:** treino, banco, comando, distrator, triagem, ritmo, Dia D, duelo.

### 1.4 O que passou batido
9. **Calendário do candidato:** inscrição, pedido de isenção, pagamento, local de prova, gabarito oficial, resultado, Sisu, Prouni e Fies. Nada disso existe, e perder um prazo anula um ano de estudo.
10. **Regras oficiais da prova:** documentos aceitos, caneta, horários, o que leva à eliminação, motivos de nota zero na redação, atendimento especializado. Tudo da cartilha e do edital oficiais, com fonte.
11. **Depois da nota:** como o Sisu funciona (pesos por curso, modalidades de concorrência, cotas, chamadas, lista de espera), Prouni e Fies. A meta de curso existe, mas sem dados oficiais de corte nem explicação do processo.
12. **Bem-estar:** ansiedade, sono, pausa, sinais de esgotamento, a semana da prova. A rotina mede tempo, mas não cuida de quem estuda.
13. **Língua estrangeira:** a escolha entre inglês e espanhol, com dicas e um diagnóstico para decidir.
14. **Operação de um app com 6 pessoas reais:**
    - convites e cota de IA;
    - termos de uso e privacidade para os amigos;
    - exportar e excluir dados;
    - cópia de segurança;
    - aviso de erro em produção;
    - limites dos planos gratuitos (Supabase e Vercel).
15. **Erratas de conteúdo:** a ocorrência de questão existe para o aluno; faltam o ciclo editorial de correção e o aviso a quem já respondeu.
16. **Mudança do Enem:** a proposta de 2028 não vale para 2027. O app precisa marcar o que é regra vigente e o que é proposta, por versão.

---

## 2. Frente 1 — Ensinar: currículo completo do Enem (Opus 5.5 para o conteúdo; Fable 5.2 para a forma)

O coração do plano. Transformar o Resolve de ferramenta de treino em **curso completo, ligado às questões reais**.

### 2.1 Mapa de conteúdos (Opus 5.5)
- **Fonte oficial:** a matriz do Enem lista os objetos de conhecimento de cada área. Eles viram a árvore do curso: área, depois disciplina, depois tema, depois assunto (cerca de 300 a 400 assuntos).
- Cada assunto se liga às habilidades da matriz e às questões reais que o cobram, pela etiquetagem (Frente 2).
- **Incidência real:** quantas vezes cada assunto caiu de 2015 a 2025, contado pelas questões etiquetadas, não estimado. Mostra "cai muito", "cai às vezes" e "raro", com o número e os anos.

### 2.2 Cada assunto vira uma lição (Opus 5.5 escreve, Guto revisa)
Formato fixo, pensado para o Enem:
1. **Em uma frase:** o que é e por que cai.
2. **O essencial:** explicação curta, com exemplo do cotidiano. O Enem cobra contexto.
3. **Como o Enem cobra:** 2 ou 3 questões reais resolvidas passo a passo, mostrando o raciocínio e não só a conta.
4. **Pegadinhas típicas:** os distratores que mais aparecem nesse assunto, com exemplos reais.
5. **Fórmulas e conceitos-chave:** viram cartões de revisão automaticamente.
6. **Treino:** questões reais desse assunto, das mais fáceis às mais difíceis (pela TRI, quando houver).
7. **Para ir além:** aulas gratuitas e públicas, com link e data de verificação.

Escritas por Opus nas sessões, sem gastar a API. Cada lição cita fontes e passa por revisão de Guto. Ordem de produção: as de maior incidência primeiro.

### 2.3 Trilhas por área (Opus 5.5 na lógica; Fable 5.2 no desenho)
- **Diagnóstico de entrada por área:** 15 a 20 questões reais que posicionam o aluno.
- **Trilha personalizada:** assuntos em ordem de pré-requisito, priorizando incidência alta e as lacunas do diagnóstico.
- **Domínio por assunto**, com regra explícita e explicada: "dominado" quando acerta questões diferentes, sem ajuda, em dias diferentes. O aluno vê por que algo está "dominado" ou "em construção".
- **Base que derruba nota:** matemática básica (frações, porcentagem, regra de três, potências, leitura de gráfico), interpretação de texto e leitura de enunciado longo. Trilha própria para quem tem lacuna.

### 2.4 Ciência de aprender, explicada ao aluno (Opus 5.5)
- **Prática de lembrar, espaçamento e intercalação:** o Resolve já faz. Uma página "Por que o Resolve funciona assim" explica, em linguagem simples, com fonte.
- **Calibração de confiança:** a confiança já é coletada na resposta. Mostrar onde o aluno acha que sabe e não sabe ("certeza alta, acerto baixo em Química orgânica").
- **Caderno de erros reflexivo:** depois de errar, uma pergunta curta ("o que eu faria diferente?"). Os padrões aparecem por semana.
- **Explique com suas palavras:** depois de uma lição, escrever um resumo de 3 linhas. Opcional; com IA, só dentro da cota.

### 2.5 Dicas e estratégias por área (Opus 5.5)
- Uma página por área: como as questões dela costumam ser, a armadilha mais comum e como gerenciar o tempo nela. Cada dica com selo: "regra oficial", "efeito da TRI", "consenso de professores" ou "depende de você".
- **Exemplos:**
  - Linguagens: texto longo e comando no fim (comando primeiro).
  - Matemática: unidades, gráficos e conta de cabeça versus no papel.
  - Natureza: contexto antes da fórmula.
  - Humanas: data, contexto e o "porquê".

---

## 3. Frente 2 — Etiquetas e o banco completo (Opus 5.5)

### 3.1 Etiquetas das 366 publicadas (primeira sessão)
- Opus lê cada questão e propõe:
  - habilidade principal e secundária;
  - assunto (da árvore 2.1);
  - dependência de conteúdo;
  - evidência no texto;
  - tipo e justificativa de cada distrator;
  - resolução passo a passo.
- **Conferência relâmpago (Fable 5.2 desenha):** a questão e a sugestão, aprovar, ajustar ou devolver, com atalhos de teclado e fila por área. Meta: menos de 1 minuto por questão.
- Destrava treino por habilidade, incidência, comparação do Raio-X, trilhas e lições.

### 3.2 Banco de 2015 a 2025
- Uma edição por sessão, de 2023 para trás, pelo fluxo "Nova edição" de `tools/ingest`, já com a etiquetagem.
- Outras cores de 2024 e 2025, para o Dia D aceitar o caderno da cor que a pessoa quiser.
- Conferência por risco: figuras, tabelas e fórmulas primeiro; olhar rápido nas questões limpas.
- Texto alternativo das figuras escrito na sessão e conferido.
- **Meta:** cerca de 2.000 questões e 22 provas de Dia D.

### 3.3 Ciclo de errata
- A ocorrência relatada vira tarefa editorial. A correção publica uma versão nova, a antiga fica no histórico, e quem respondeu a versão com erro recebe um aviso. A nota não é recalculada em silêncio.

---

## 4. Frente 3 — TRI, nota e futuro (Opus 5.5)

### 4.1 Destravar os dados do Inep
- **Causa achada em 15/11:** os servidores do Inep usam certificado da cadeia ICP-Brasil, ausente do ambiente. Não é bloqueio de rede.
- **Correção:** acrescentar a raiz oficial da ICP-Brasil (ITI), conferida pela impressão digital publicada, à confiança do ambiente, por meio do script de configuração do ambiente, para valer em toda sessão. Sem desligar a verificação.
- **Importar dos microdados:** os parâmetros a, b e c de cada item e a taxa de acerto real por questão.

### 4.2 Nota validada
- **Anos sem parâmetro público:** estimar das respostas dos participantes, com o erro declarado.
- **Validação contra notas oficiais:** recalcular a nota de participantes reais (anônimos) dos microdados e publicar o erro médio por área e ano. Até lá, o rótulo é "cálculo experimental".
- **O que aparece:**
  - nota do Dia D com a calibração da edição;
  - nota por área com faixa;
  - radar de coerência;
  - cenários ("acertando estas 3 fáceis, +N pontos");
  - pontos baratos no plano adaptativo;
  - "X% do Brasil acertou".

### 4.3 Curso, corte e caminho (Opus 5.5 nos dados; Fable 5.2 na régua)
- **Cursos populares pré-carregados** com dados oficiais do Sisu, com ano, modalidade e fonte:
  - Medicina, Direito, Psicologia, Engenharias, Ciência da Computação, Enfermagem, Administração, Odontologia, Arquitetura, Pedagogia e outros;
  - foco inicial em UFES e UFV para Ciência da Computação, depois as demais federais.
- **Pesos por curso e instituição** (Sisu), média ponderada com a nota estimada e "quanto falta em cada área". Este é o maior ganho: um ponto em Matemática vale mais que um em Linguagens para quem quer CC.
- **Explicador do Sisu:** modalidades, cotas, chamadas, lista de espera. Prouni e Fies em resumo, com fonte.
- **Previsão honesta:** só com histórico suficiente de estimativas comparáveis. Antes disso, "indisponível".

---

## 5. Frente 4 — Entender o site (Fable 5.2 na forma; Opus 5.5 no texto e na lógica)

### 5.1 Boas-vindas que montam o plano
- **Primeira entrada, cerca de 5 minutos:**
  - prova-alvo e data;
  - curso e instituição;
  - horas por semana;
  - língua estrangeira;
  - um diagnóstico curto opcional.
- No fim, o aluno vê o próprio plano, a mesa montada e o que cada objeto da mesa faz.
- **Tour da mesa:** cada objeto (caderno, fichas, folha, régua, agenda) se apresenta uma vez, pulável e com movimento reduzido.

### 5.2 Mecânicas explicadas onde acontecem
- **"Por quê?" ao lado de cada decisão automática:**
  - por que esta questão voltou;
  - por que o treino foi para Natureza;
  - por que a sequência continua;
  - por que a nota está indisponível.

  Cada um leva a uma explicação curta e, dali, à página completa.
- **Central "Como o Resolve funciona":** revisão espaçada, TRI, plano adaptativo, domínio, sequência e folga, triagem, ritmo, Dia D, correção de redação, cota de IA. Cada página com uma ilustração em código e um exemplo com os dados do próprio aluno.
- **Glossário** sempre a um toque: TRI, distrator, habilidade, competência, coerência, eixo temático, modalidade de concorrência.

### 5.3 Organização e navegação
- **Reorganização do Estudar** em três portas claras:
  - **Aprender:** trilhas e lições.
  - **Praticar:** treino, banco e treinos de habilidade, cada um com "quando usar".
  - **Provar:** Dia D e simulados.
- **Busca "Ir para…"** por tela, assunto, habilidade ou questão.
- **Progresso como história:** linha do tempo do aluno (o que estudou, o que dominou, como a nota estimada mudou) e "próximo passo" sempre visível.
- **Novidades:** quando algo novo entra no app, uma nota curta na mesa.

---

## 6. Frente 5 — Estratégia de prova e o Dia D (Opus 5.5 na lógica e no conteúdo; Fable 5.2 nas cenas)
- **Manual do Dia D**, com selos de evidência:
  - linha do tempo dos dois dias;
  - documentos, caneta, horários e eliminação;
  - motivos de nota zero na redação;
  - atendimento especializado.

  Tudo da cartilha e do edital vigentes, conferido quando sair o de 2027.
- **Sua estratégia descoberta pelos seus dados:** experimentos nos Dias D (redação primeiro ou depois, ordem das áreas, três passadas). Comparação de nota, tempo e coerência. Resultado: "seu plano para o Dia D".
- **Protocolo de crise de 60 segundos**, treinado no "Dia D sob pressão" (relógio curto e questão difícil plantada no começo).
- **Treino de chute consciente** (eliminar o impossível sob tempo) e do cartão-resposta.
- **Calendário do candidato:** inscrição, isenção, pagamento, local de prova, gabarito, resultado, Sisu, Prouni e Fies, com lembretes no celular e links oficiais. Datas de 2027 só quando publicadas; antes, "a confirmar".
- **Semana da prova:** logística, sono, alimentação, horário, ficha de crise.

---

## 7. Frentes 6 a 9

### Frente 6 — Redação completa (Opus 5.5 no conteúdo; Fable 5.2 na folha)
- **Trilha por competência**, com exemplos reais e as redações nota 1000 quando Guto trouxer.
- **Repertório por eixo temático**, com fonte verificável. Os eixos mais cobrados vêm da lista real de temas de 2015 a 2025.
- **Checklist de revisão sem IA:** cinco competências e cinco elementos da proposta de intervenção.
- **Correção por IA na cota**, com evidência no texto e "o que reescrever primeiro". Rotulada como estimativa até calibrar.
- **Foto da folha lida pela IA** (hoje é transcrição manual), com conferência antes de corrigir.

### Frente 7 — Clube dos 6 (Opus 5.5 nos dados e no acesso; Fable 5.2 na sala)
- **Convites só do dono** (link ou código com validade e limite), membros, suspender, remover com exclusão de dados.
- **Cota de IA:** cerca de US$ 1,50 por pessoa por mês dentro dos US$ 10, com folga do dono. Gasto real por chamada, aviso aos 70%, bloqueio no teto, reserva antes de cada chamada, cache compartilhado: uma explicação gerada serve a todos.
- **Sala de estudo ao vivo**, foco sincronizado e desafio semanal.
- **Dia D fantasma** contra o ritmo de um amigo ou o seu próprio passado.
- **Duelo de Raio-X.**
- Nota de ninguém exposta sem consentimento.

### Frente 8 — Papel de verdade (Opus 5.5 na leitura; Fable 5.2 no fluxo)
- **Prova em PDF** para imprimir: Dia D ou lista personalizada, com cartão-resposta impresso.
- **Cartão-resposta pela câmera:** o app lê as bolinhas (processamento de imagem no aparelho, sem custo de IA). A digitação fica como plano B.
- **Redação manuscrita:** foto, leitura, transcrição conferida, correção na cota.

### Frente 9 — Operação e confiança (Opus 5.5)
- **Termos e privacidade para os amigos**, em linguagem simples.
- **Exportar meus dados e excluir conta**, com redações e anexos.
- **Cópia de segurança do banco** e um ensaio de restauração.
- **Aviso de erro em produção** e painel de saúde: erros, lentidão, custo de IA, limites dos planos gratuitos.
- **Limites de uso** contra abuso (envios, convites, IA).
- **Versão das regras:** o que é vigente em 2027 e o que é proposta para 2028, marcado em cada tela.

### Frente 10 — Mesa completa, movimento e celular (Fable 5.2)
- **Terminar a Mesa** em Rotina (agenda com marca-texto), Progresso (régua como protagonista), Mais, Grupos, área editorial e envelope do Dia D.
- **As novas telas** (lições, trilhas, central de ajuda, boas-vindas, calendário, cursos) já nascem na Mesa.
- **Os três momentos autorais:**
  - abertura do caderno no Dia D;
  - passagem entre etapas;
  - replay minuto a minuto.
- **Ilustrações em código** para as explicações de mecânicas: curva da TRI, linha de revisão espaçada, mapa de domínio.
- **App instalável (PWA):** offline nas revisões e lições, avisos de revisão vencida, questão do dia e prazos do calendário.
- Auditoria de acessibilidade e de desempenho no celular.

---

## 8. Roteiro de sessões, com o modelo de cada uma

Sessões curtas, uma frente (ou metade) por sessão. Cada uma termina com um tour de capturas e atualiza `docs/continuidade.md`.

| # | Modelo | Sessão |
|---|---|---|
| 1 | Opus 5.5 | Certificado ICP-Brasil no ambiente; parâmetros e taxas do Inep; validação da TRI (4.1, 4.2) |
| 2 | Opus 5.5 | Árvore de conteúdos e etiquetagem das 366 (2.1, 3.1) |
| 3 | Fable 5.2 | Conferência relâmpago para Guto; boas-vindas e tour da mesa (3.1, 5.1) |
| 4 | Opus 5.5 | Convites, membros, cota de IA, termos, exportar e excluir (7, 9) |
| 5 | Opus 5.5 | Cursos e cortes do Sisu, pesos, CC UFES e UFV, explicador do Sisu (4.3) |
| 6 | Fable 5.2 | Régua da nota e do curso; progresso como história; reorganização do Estudar (4.3, 5.3) |
| 7–9 | Opus 5.5 | Lições das matérias, por incidência: Matemática e Natureza, depois Humanas e Linguagens (2.2, 2.5) |
| 10 | Fable 5.2 | Página de lição, trilhas e mapa de domínio; central "Como funciona" e glossário com ilustrações (2.3, 5.2) |
| 11 | Opus 5.5 | Trilhas, diagnóstico de entrada, domínio, calibração de confiança (2.3, 2.4) |
| 12 | Opus 5.5 | Estratégia pessoal, protocolo de crise, calendário do candidato, manual do Dia D (6) |
| 13 | Fable 5.2 | Cenas do Dia D (abertura, sob pressão, replay); terminar a Mesa nas telas restantes (6, 10) |
| 14 | Opus 5.5 | Redação: trilha por competência, repertório, checklist (6); ligar a chave e a correção na cota |
| 15 | Fable 5.2 | Folha de redação, foto da folha, sala de estudo e Dia D fantasma (6, 7) |
| 16–19 | Opus 5.5 | Edições de 2023 a 2015, uma por sessão, com etiquetas (3.2) |
| 20 | Opus 5.5 | Papel: PDF, leitura do cartão pela câmera (8) |
| 21 | Fable 5.2 | PWA, avisos, acessibilidade e desempenho no celular (10) |

**Regra para os dois modelos não se atropelarem:** uma sessão por vez na branch `claude/new-session-vhzm54`. Fable mexe em `components/`, `globals.css`, `lib/ink` e `packages/ui`; Opus mexe em `lib/`, `supabase/`, `tools/` e no conteúdo. Cada sessão começa lendo `docs/continuidade.md`.

**Como pedir:** "Leia `docs/plan/plano-v2.md` e `docs/continuidade.md` e faça a sessão N do roteiro."

---

## 9. Ideias mais radicais (para escolher depois)
- **Professor de bolso por voz:** explicar a resolução em voz alta e o app transcrever no aparelho e comparar com a resolução revisada. Sem custo de IA na transcrição, se o aparelho fizer.
- **"Modo Enem real" de fim de semana:** o app trava as outras funções, o relógio segue o horário oficial de Brasília (portão, início, fim), e a pessoa faz a prova no papel em casa.
- **Gêmeo de desempenho:** com a TRI validada, simular como seria a nota com mais N horas em cada assunto, usando o histórico real do aluno, com a incerteza explícita.
- **Mapa do Brasil das questões:** onde no país cada questão foi mais difícil, pelos microdados.
- **Livro de bolso automático:** gerar em PDF o resumo pessoal, com só os assuntos que o aluno ainda não domina, para revisar no ônibus.

---

## 10. Riscos
- **Volume de conteúdo:** 300 a 400 lições é muito trabalho. Ordem por incidência, lições curtas e revisão de Guto em lotes.
- **Parâmetros faltando em alguns anos:** estimar dos microdados, com o erro medido.
- **Cerca de 2.000 questões para conferir:** ordem por risco, olhar rápido nas limpas.
- **IA dentro de US$ 10:** teto rígido, cache compartilhado, IA só onde precisa ser na hora. Conteúdo pesado é escrito nas sessões.
- **Direitos:** uso num grupo fechado; revisar antes de abrir para fora.
- **Dados do Sisu:** só oficiais, com ano e fonte. Sem eles, a meta continua com dados informados pela pessoa.
