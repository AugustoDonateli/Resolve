# Resolve — Plano v2 (15 de novembro de 2026)

Plano de melhoria pedido por Guto: amplo, ambicioso, e não só ajustes finos. Parte do estado real registrado em `docs/continuidade.md` (11 e 12/11). As regras de produto do `CLAUDE.md` continuam: questões oficiais conferidas, nenhum dado inventado, identidade Mesa, segurança dos dados.

Decisões de Guto (15/11):
- **Público:** só ele e amigos convidados.
- **Prova:** ENEM 2027.
- **IA:** até US$ 10 por mês.
- **Banco:** provas regulares de 2015 a 2025.

---

## 1. Onde estamos

**Já existe e funciona**
- 366 questões publicadas: Enem 2024 e 2025, cadernos 1 e 7.
- Dia D com cartão-resposta e replay.
- Treino, Raio-X, revisão espaçada, triagem, ritmo, comando primeiro e caça ao distrator.
- Banco com filtro por edição.
- Matriz com as 120 habilidades.
- Rotina completa, com plano adaptativo e reta final.
- Redação: editor, folha de 30 linhas, peças, trilha do zero, repertório, foto da folha e o fluxo de correção em etapas, este esperando a chave.
- Grupos e duelos.
- Meta de curso com média ponderada.
- Identidade Mesa em metade das telas.
- Deploy na Vercel com funções em São Paulo.

**O que ainda segura o produto**
1. **Etiquetas de habilidade pendentes nas 366.** Sem elas não funcionam o treino por habilidade, a incidência, a comparação do Raio-X nem os "pontos baratos".
2. **TRI sem parâmetros.** O motor existe, mas a nota estimada está "indisponível". Causa achada em 15/11: os servidores do Inep usam certificado da cadeia ICP-Brasil, que não está na lista de certificados confiáveis do ambiente. Não é bloqueio de rede.
3. **Banco pequeno:** 2 provas de 11. Faltam 2015–2023 e as outras cores de 2024–2025.
4. **Cadastro e IA ainda sem controle de dono:** convites que só Guto gera, cota de IA por pessoa, painel de gasto.
5. **Didática de prova rasa:** existe o Dia D, mas não existe uma estratégia de prova ensinada e personalizada (ordem, chute consciente, protocolo de crise).
6. **Mesa incompleta:** Rotina, Progresso, Mais, Grupos, área editorial e envelope do Dia D ainda estão na base antiga.

**O mercado em 2026**
- O **app MEC Enem** é gratuito, com simulados, aulas e correção de redação por IA.
- **Estuda.com** estima nota TRI com 20 a 25 questões.
- **Aprova Total** e **Toda Matéria** oferecem simulados TRI grátis.
- **Redação Online** e **Imaginie** fazem correção humana paga.

O básico é barato ou grátis. O Resolve vale pelo que ninguém faz direito:
- **TRI validada contra notas oficiais**, com o erro publicado;
- **estratégia de prova descoberta pelos dados de cada um**;
- **habilidades de prova treinadas**, não só conteúdo;
- **clube pequeno de amigos**;
- **uma experiência de "prova sobre a mesa"** que nenhum concorrente tem.

---

## 2. Como trabalhar

1. **Ondas com entrega visível**, cada uma fechando com um tour de capturas de tela.
2. **Sessões curtas, blocos grandes.** Uma onda ou meia onda por sessão. Conversa longa encarece cada passo.
3. **Conteúdo que exige leitura inteligente é feito nas sessões** e revisado por Guto: etiquetar questões, explicar distratores, escrever lições, fichas e cartões. Os US$ 10 da API ficam para o que precisa acontecer na hora: corrigir a redação de quem acabou de escrever, ler a foto da folha.
4. **Verificação proporcional:** rigor em dados, acesso e dinheiro; teste de fumaça no resto.
5. **Nada inventado:** sem dado oficial, a tela diz "indisponível" ou "estimativa da plataforma", com o método.

---

## 3. As ondas

### Onda A — Etiquetas e conteúdo das 366 (1 a 2 sessões)
O maior destravamento possível sem nada externo.
- **Etiquetagem pela sessão:** eu leio cada questão publicada e proponho:
  - habilidade principal e secundária da matriz;
  - assunto;
  - dependência de conteúdo (0 a 3);
  - trecho de evidência;
  - tipo e justificativa de cada distrator;
  - resolução passo a passo.
- **Conferência relâmpago para Guto:** a questão, a sugestão e três botões (aprovar, ajustar, devolver), com atalhos de teclado e fila por área. Meta: menos de 1 minuto por questão.
- **Cartões de conceito** (fórmulas e conceitos) com fonte, gerados a partir das resoluções e revisados. Enchem o feed de revisão, que hoje está vazio.
- **Destrava:** treino por habilidade, incidência real, comparação do Raio-X, caça ao distrator com gabarito editorial, ficha de cada habilidade com questões reais.

### Onda B — TRI de verdade, validada (2 sessões)
- **Dados:**
  - **ambiente:** acrescentar o certificado raiz ICP-Brasil, obtido do ITI, à confiança do ambiente. Sem desligar verificação. Alternativa: Guto baixa no computador dele só o arquivo de itens (pequeno) de cada ano e envia;
  - **parâmetros:** importar os parâmetros a, b e c de cada item, ligados às questões publicadas pelo número no caderno e pela cor;
  - **anos sem parâmetro público:** estimá-los das respostas dos participantes nos microdados (modelo de 3 parâmetros, o do Inep), com método e erro declarados.
- **Validação, o diferencial:** pegar participantes reais (anônimos) dos microdados, recalcular a nota com o nosso motor e comparar com a nota oficial. Publicar "nossa estimativa fica, em média, a X pontos da oficial", por área e ano. Até lá, o rótulo é "cálculo experimental".
- **O que aparece para o aluno:**
  - **nota do Dia D:** prova inteira refeita, com a calibração daquela edição (a estimativa mais próxima da oficial);
  - **nota por área com faixa:** de treinos avulsos, mostrando quantas questões sustentam a estimativa;
  - **radar de coerência:** quando o seu padrão parece chute para a TRI (difícil certa, fácil errada), quanto isso custa e quais questões causaram;
  - **cenários:** "acertando estas 3 fáceis, você ganharia cerca de N pontos", calculado pelo motor;
  - **pontos baratos:** as habilidades cujas questões mais sobem a sua nota para o seu nível, levadas direto ao plano adaptativo;
  - **a régua da meta de curso** passa a usar a nota estimada real.
- **Dados brasileiros agregados** (item que estava bloqueado): taxa de acerto real de cada questão no Brasil ("62% dos candidatos acertaram") e as habilidades que mais derrubam, por ano.

### Onda C — Clube fechado: convites, membros, cota de IA (1 sessão)
- **Papel "dono"** (Guto), acima do editor.
- **Convites:** link ou código com validade, limite de usos e registro de quem convidou. Quem não tem convite não cria conta. Lista de espera opcional.
- **Membros:** quem entrou, última atividade, suspender e reativar, remover com exclusão de dados.
- **IA dentro de US$ 10 por mês:**
  - gasto real por chamada;
  - previsão do mês;
  - cota por membro (por exemplo, N correções de redação por mês), aviso aos 70% e bloqueio no teto;
  - reserva antes de cada chamada (a fila com reserva já existe);
  - cache compartilhado: o que já foi gerado para uma questão serve para todos.
- **Ligar a chave por último**, como Guto pediu. Com ela, a correção de redação em etapas que já existe passa a funcionar.

### Onda D — Banco completo: regulares de 2015 a 2025 (3 a 4 sessões, mais a conferência de Guto)
- **Uma edição por vez, de 2023 para trás**, pelo fluxo "Nova edição" de `tools/ingest`.
- **Outras cores** de 2024 e 2025, para o Dia D aceitar o caderno da cor que a pessoa quiser.
- **Exceções de layout** das edições antigas listadas e conferidas à mão: tabelas, frações empilhadas, figuras.
- **Etiquetagem pela sessão junto** (como na Onda A), para cada edição já entrar completa.
- **Ordem de conferência por risco:** figuras, tabelas e fórmulas primeiro; questões só de texto com cruzamento perfeito ganham "olhar rápido".
- **Meta:** cerca de 2.000 questões reais e 22 provas de Dia D (11 anos × 2 dias), cada uma com nota calibrada se houver parâmetros.

### Onda E — Estratégia de prova e didática do Enem (2 a 3 sessões)
O que Guto pediu: "se ficar desesperado na hora, como faz?"

**E1. Manual do Dia D (interativo, com nível de evidência)**
- **Linha do tempo dos dois dias:** 1º dia com Linguagens, Humanas e Redação; 2º dia com Natureza e Matemática. Portão, documentos, proibições, sempre citando o edital vigente. Na chegada do edital de 2027, a página é conferida.
- **Cada dica com selo:** "regra oficial", "consequência da TRI", "consenso de professores" ou "depende de você". Exemplos:
  - nunca deixar em branco (erro não desconta);
  - chute consciente: eliminar o absurdo antes (a TRI pesa coerência);
  - passadas por dificuldade;
  - tempo fixo reservado para a redação;
  - últimos 30 minutos para o cartão.

**E2. Sua estratégia, descoberta pelos seus dados (inédito)**
- **Experimentos propostos nos Dias D:** "hoje redação primeiro"; "no próximo, Humanas antes de Linguagens"; "triagem em 3 passadas".
- **Comparação depois de alguns:** nota estimada, tempo por bloco, coerência e questões deixadas para trás, em cada estratégia.
- **"Seu plano para o Dia D":** ordem das áreas, hora de começar a redação, tempo-limite por questão antes de marcar e seguir, e a hora de ir para o cartão. Impresso numa ficha para levar na memória.

**E3. Protocolo de crise, treinado antes**
- **Ficha de 60 segundos** para branco ou pânico:
  - respirar;
  - marcar e seguir;
  - aplicar a regra de triagem;
  - chute consciente.
- **"Dia D sob pressão":** um modo do simulado com relógio mais curto e uma questão muito difícil plantada no começo, para praticar o protocolo.
- **Treino de chute consciente:** dado um tempo curto, eliminar alternativas impossíveis. Mede quantas sobram e quanto isso aumenta a chance real.
- **Treino do cartão-resposta** com o relógio correndo (o cartão já existe no Dia D).

**E4. Lições e fichas de cinco minutos**
- **Uma ficha por habilidade** (120):
  - o que ela pede, em língua de aluno;
  - como reconhecer em 20 segundos;
  - pegadinhas típicas, tiradas da taxonomia de distratores com exemplos reais;
  - 2 ou 3 questões reais resolvidas;
  - treino curto.

  Escritas nas sessões, revisadas por Guto, com fonte.
- **Base que derruba nota:** matemática básica, gráficos e tabelas, enunciado longo. Diagnóstico curto aponta as lacunas.
- **Links de aulas curadas** (gratuitas e públicas) por habilidade, com data de verificação.

**E5. Redação completa**
- **Trilha por competência** com exemplos reais e as redações nota 1000 quando Guto trouxer.
- **Banco de repertório por eixo**, com fonte verificável.
- **Checklist de revisão sem IA** (grátis e instantâneo): cinco competências e cinco elementos da proposta de intervenção.
- **Correção por IA na cota:** por competência, com evidência no texto e "o que reescrever primeiro".
- **Foto da folha lida pela IA:** hoje é transcrição manual; a transcrição é conferida antes de corrigir.

### Onda F — Mesa completa, interface e movimento (2 sessões)
- **Terminar a Mesa nas telas que faltam:**
  - Rotina: agenda com marca-texto;
  - Progresso: régua como protagonista;
  - Mais;
  - Grupos e duelo;
  - área editorial;
  - envelope do Dia D na paleta nova.
- **Busca "Ir para…"** com todos os destinos.
- **Auditoria tela por tela:** objetivo e ação principal claros, estados vazios honestos, escuro, celular. Tour antes e depois.
- **Os três momentos:**
  - abertura do caderno no Dia D;
  - passagem entre etapas;
  - replay que mostra minuto a minuto onde você perdeu tempo.
- **App instalável (PWA):** revisões offline e aviso no celular de revisão vencida e questão do dia, só com autorização. É o canal da questão do dia, que hoje existe só dentro do app.

### Onda G — Clube de estudo (1 sessão; grupos e duelo já existem)
- **Sala de estudo ao vivo:** quem está em foco agora (opcional) e pausas sincronizadas.
- **Dia D fantasma:** fazer a prova que um amigo fez e ver o ritmo dele lado a lado. Ou correr contra o seu próprio passado.
- **Desafio semanal do grupo:** mesmo conjunto curto para todos, com ranking por acerto e coerência.
- **Duelo de Raio-X:** dois amigos classificam os distratores da mesma questão e comparam com a revisão editorial.
- Nada de nota exposta sem consentimento.

### Onda H — Papel de verdade (1 a 2 sessões, experimental)
- **Prova em PDF** (Dia D ou lista personalizada) para imprimir.
- **Cartão-resposta pela câmera:** o app lê as bolinhas, com digitação como plano B.
- **Redação manuscrita:** foto, transcrição conferida, correção na cota.

### Onda I — Reta final do ENEM 2027 (contínuo; a reta final já existe)
- **Plano reverso** com a data oficial quando sair o edital.
- **Dias D quinzenais** nos últimos meses, com a estratégia pessoal da Onda E.
- **Semana da prova:** logística, sono, horário e o protocolo de crise revisado.

---

## 4. Ordem sugerida

| Onda | Sessões | Depende de |
|---|---|---|
| A Etiquetas e conteúdo das 366 | 1–2 | Guto conferir as sugestões |
| B TRI validada | 2 | Certificado ICP-Brasil no ambiente ou arquivos enviados por Guto |
| C Clube fechado e cotas | 1 | — (chave por último) |
| E Estratégia e didática | 2–3 | Guto revisar o conteúdo |
| D Banco 2015–2025 | 3–4 | Conferência de Guto, por edição |
| F Mesa, interface e movimento | 2 | — |
| G Clube de estudo | 1 | C |
| H Papel de verdade | 1–2 | Experimental; IA na cota |
| I Reta final | contínuo | Edital 2027 |

A → B → C → E → D → F → G → H, com I rodando por baixo. A Onda D pode correr em paralelo desde cedo, uma edição por sessão, porque depende do ritmo de conferência de Guto.

Meta: A, B, C e E prontos no começo de 2027, para Guto usar o ano inteiro.

---

## 5. Riscos

- **Parâmetros faltando em alguns anos:** caminho alternativo de estimar dos microdados, com o erro medido.
- **Conferência de cerca de 2.000 questões:** ordem por risco, olhar rápido nas limpas, uma edição por vez.
- **IA:** teto rígido, reserva antes de cada chamada, cache compartilhado e IA só onde precisa ser na hora.
- **Direitos:** provas e textos para uso num grupo fechado; revisar antes de abrir para fora.
- **Correção por IA:** rótulo de estimativa até calibrar com as redações nota 1000 reais.

---

## 6. Perguntas abertas para Guto

1. Curso e universidade-alvo, para a régua e para os cenários.
2. Quantos amigos, mais ou menos? Define a cota de IA por pessoa.
3. Prefere que eu acrescente o certificado do governo ao ambiente (eu faço) ou baixar você mesmo os arquivos de itens do Inep?
4. A Onda H (papel e câmera) interessa agora ou fica para depois?
