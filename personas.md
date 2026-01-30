# Documento 1 — Personas e Jornadas de Usuário

## Persona 1.1 — Mining Engineer Planning

### Perfil
- Engenheiro de Minas ou Geólogo
- Atua em Estimação de Recursos e Reservas, Planejamento de Médio e Longo Prazo
- Forte em lavra/geologia
- Usuário intensivo de softwares de mineração (Deswik, Datamine, Leapfrog, etc.)

### Objetivos
- Calcular NSR por tonelada para modelos de recursos/reservas
- Definir/ajustar cut-off grade estratégico
- Avaliar impacto de variação de preços e custos em horizontes de médio e longo prazo
- Padronizar premissas econômicas nos estudos de viabilidade

### Dores
- Falta de acesso aos inputs para cálculo do NSR
- Planilhas frágeis e inconsistentes
- Falta de rastreabilidade (quem mudou o quê / quando / por quê)
- Simulações lentas e difíceis de repetir
- Discussões longas sobre premissas

### Jornada de Usuário
1. Acessa a aplicação web
2. Seleciona um projeto/método (mono-metal ou multi-metal)
3. Insere inputs (teor, recuperação, preço, custos/deduções)
4. Visualiza NSR/ton e breakdown por componente (receita/deduções)
5. Ajusta cenários (preço ±x%, recuperação ±x%, TC/RC, penalidades)
6. Exporta/compartilha o cenário com o time (link/CSV/PDF)
7. Usa o resultado para definição de cut-off e planejamento estratégico

---

## Persona 1.2 — Mining Engineer Operation

### Perfil
- Engenheiro de Minas ou Geólogo
- Atua em Operação e Planos de Curto Prazo
- Foco em execução e reconciliação
- Usuário intensivo de Excel, com uso eventual de softwares de mineração (Deswik, Datamine, Leapfrog, etc.)

### Objetivos
- Calcular NSR por tonelada para decisões operacionais diárias
- Ajustar cut-off grade operacional
- Avaliar impacto de variações de curto prazo (preços, blend, qualidade)
- Apoiar decisões de priorização de frentes e blending

### Dores
- Falta de acesso até mesmo ao Excel para cálculo de NSR
- Pouca familiaridade com conceitos base, limitando a discussão aos perfis de Planejamento (Persona 1.1)
- Dependência de terceiros para obter premissas atualizadas
- Dificuldade em traduzir decisões operacionais em impacto econômico

### Jornada de Usuário
1. Acessa a aplicação web
2. Seleciona projeto e período operacional (diário/semanal)
3. Insere ou importa dados de produção (teor realizado, recuperação atual)
4. Visualiza NSR/ton e compara com planejado
5. Ajusta cenários rápidos (blend A vs B, frente X vs Y)
6. Exporta/compartilha análise com supervisão e planejamento
7. Usa o resultado para decisão operacional imediata (cut-off, blending, priorização de frentes)

---

## Persona 2 — Metallurgical Engineer

### Perfil
- Engenheiro Metalúrgico
- Responsável por recuperação, especificação de concentrado, penalidades
- Interface entre planta e mina
- Avalia trade-offs de processo que impactam diretamente o valor econômico

### Objetivos
- Avaliar impacto metalúrgico no NSR
- Comparar rotas/processos e blends
- Dimensionar impacto de penalidades/impurezas e payability
- Analisar trade-offs de recuperação vs. qualidade do concentrado
- Avaliar impacto de elementos deletérios no valor do produto

### Dores
- Falta de visibilidade econômica de decisões metalúrgicas
- Modelos dispersos (planilhas, relatórios, e-mails)
- Dificuldade em explicar "por que o concentrado X vale menos" para gestão
- Trade-offs complexos (recuperação, qualidade, elementos deletérios) não são facilmente quantificados

### Jornada de Usuário
1. Acessa a aplicação e abre projeto existente
2. Define termos metalúrgicos/comerciais (payability, TC/RC, penalties, credits)
3. Ajusta parâmetros por metal/subproduto (Au/Ag/Mo etc.)
4. Simula trade-offs (ex.: maior recuperação vs. menor qualidade de concentrado)
5. Visualiza impacto no NSR/ton e no valor total por período
6. Compara dois ou mais cenários (ex.: blends A vs B, rotas de processo)
7. Salva versão do cenário (com comentário técnico)
8. Exporta relatório para reunião de performance

---

## Persona 3 — Mine / Asset Manager

### Perfil
- Gestor técnico-financeiro (operações e/ou portfólio de ativos)
- Toma decisões de CAPEX/OPEX, metas e priorização

### Objetivos
- Avaliar valor total (ordem de grandeza) e sensibilidade do ativo
- Comparar cenários macro (preços, câmbio, termos de smelter)
- Padronizar premissas dentro da organização

### Dores
- Modelos técnicos demais (não "contam a história")
- Modelos financeiros demais (ignoram metalurgia/termos reais)
- Dependência de consultorias para análises básicas

### Jornada de Usuário
1. Seleciona mina(s) e período (quarter/ano/LoM simplificado)
2. Define cenários macro (preço, câmbio, discount rate, curvas)
3. Visualiza: NSR/ton, valor total, sensibilidade (tornado simples)
4. Compara minas/ativos com premissas padronizadas
5. Gera sumário executivo para diretoria (1–2 páginas)
6. Decide ações: priorizar área, replanejar, investir, pausar

---

## Persona 4 — Business Development / M&A Analyst

### Perfil
- Avalia oportunidades (triagem e due diligence)
- Forte em valuation, menos em metalurgia operacional

### Objetivos
- Screening rápido com premissas explícitas
- Comparar oportunidades sob cenários consistentes
- Identificar drivers de valor (preço, recovery, penalties, TC/RC)

### Dores
- Premissas técnicas opacas e não versionadas
- Tempo alto para obter respostas "simples"
- Dificuldade em alinhar linguagem entre técnico e financeiro

### Jornada de Usuário
1. Cria projeto "screening" (template rápido)
2. Insere dados resumidos (metais, teor médio, recovery, termos, custos)
3. Define cenários (base/downside/upside)
4. Visualiza métricas: NSR/ton, valor total, NPV simplificado (se habilitado)
5. Exporta pacote de premissas (audit trail) para o comitê
6. Decide avançar para estudo detalhado ou descartar
