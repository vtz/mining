
# Documento 2 — Implementation Plan (Projeto Completo)

## 1. Visão e Objetivo
Construir uma plataforma web para cálculo e análise de NSR:
- NSR por tonelada (com breakdown)
- Cenários e comparações
- Valor total (por período e/ou LoM simplificado)
- Trilhas de auditoria e versionamento de premissas
- Integração amigável para agentes de IA (Cursor/Copilot/Cloud agents)

## 2. Escopo (In / Out)

### In Scope
- Modelos de NSR (mono e multi-metal)
- Parametrização: preços, FX, recovery, payability, TC/RC, penalties, credits
- Cenários: criar, versionar, comparar
- Export: CSV/PDF e link compartilhável
- Audit trail (quem, quando, o que mudou)
- API pública interna para automações/agentes

### Out of Scope (Inicial)
- Otimização de pit/scheduling completo
- Integração direta com softwares grandes (Deswik/Datamine etc.) no início
- Modelos geostatísticos e block model completo (pode vir depois)

## 3. Arquitetura Técnica (Alvo)

### Componentes
- Frontend Web: UI de inputs + visualizações
- Backend API: FastAPI (Python) ou similar
- NSR Engine: biblioteca isolada (testável e reutilizável)
- Scenario Manager: versionamento e comparação
- Persistence: PostgreSQL
- Auth: OAuth (opcional MVP), SSO futuro
- Observability: logs, métricas, tracing
- AI Integration: endpoints e “schemas” estáveis para agentes

### Princípios de Design
- Fórmulas declarativas (config-driven), não hardcoded em UI
- Transparência: always show formula + inputs + deduções aplicadas
- Determinismo: mesmo input => mesmo output (sem aleatoriedade)
- Testabilidade: NSR Engine com suíte forte de testes

## 4. Entregáveis por Fases

### Phase 1 — Foundations
- Repositório mono (frontend+backend) com CI
- Esqueleto de domínio (Project, Scenario, Terms, Metals)
- NSR Engine v0 (mono-metal)
- UI v0 (inputs + resultado)

### Phase 2 — Multi-metal + Terms
- Multi-metal com subprodutos
- Payability por metal
- TC/RC por metal e por concentrado
- Penalidades configuráveis
- Breakdown detalhado

### Phase 3 — Scenarios + Versioning + Exports
- CRUD de cenários
- Comparação lado a lado (A/B)
- Export CSV/PDF
- Audit trail básico

### Phase 4 — Valuation (Opcional no Full Project)
- Linha do tempo (produção por período)
- Fluxo de caixa (receita líquida) e NPV simplificado
- Sensibilidade (tornado simples)

### Phase 5 — AI Agent Enablement
- OpenAPI completo e exemplos de chamadas
- “Agent tasks” (gerar cenário, comparar, produzir relatório)
- Prompt packs e templates para Cursor/Copilot

## 5. Plano de Trabalho para Agentes de IA (Agent-Ready)

### Regras Gerais para Execução por Agentes
- Cada tarefa deve produzir artefatos verificáveis (código, testes, docs)
- Todo PR deve incluir: testes, atualização de docs, e exemplos
- Definições de domínio devem estar em `docs/domain.md`

### Work Packages (WPs)

#### WP-01 — Repo + CI/CD
- Criar monorepo (frontend, backend, shared)
- Configurar lint, format, unit tests, build pipelines
- Definir convenções de commit e versionamento

#### WP-02 — Domain Model
- Implementar entidades:
  - Project
  - Scenario
  - MetalTerm (price, payability, RC, credits)
  - TreatmentTerm (TC, transport)
  - PenaltyRule
- Criar migrations e seed data

#### WP-03 — NSR Engine Library
- Implementar funções puras:
  - compute_payable_metal()
  - compute_gross_revenue()
  - compute_deductions()
  - compute_nsr_total()
  - compute_nsr_per_tonne()
- Suportar moeda e FX
- Testes unitários com casos conhecidos

#### WP-04 — API Endpoints
- CRUD Projects/Scenarios
- Endpoint `POST /compute/nsr` (stateless compute)
- Endpoint `POST /scenarios/{id}/compute` (persisted compute)
- OpenAPI + exemplos

#### WP-05 — Frontend MVP UI
- Form de inputs com validação
- Página de resultado com breakdown
- Comparação de cenários (v1)
- Export (v1)

#### WP-06 — Audit Trail + Versioning
- Versionar mudanças em scenarios
- Capturar usuário, timestamp e diff

#### WP-07 — Observability + QA
- Logs estruturados
- Métricas de latência
- Golden tests (regressão numérica)

#### WP-08 — AI Agent Packs
- `prompts/` com tasks (“create scenario”, “run sensitivity”, “generate report”)
- Scripts de exemplo para Cursor/CLI

## 6. Definition of Done (Full Project)
- Todos cálculos cobertos por testes (>= 90% no engine)
- Resultados reprodutíveis e auditáveis
- Documentação do modelo e fórmulas publicada
- OpenAPI completa e exemplos executáveis
- Export e comparação funcionando para pelo menos 2 cenários

---

# Documento 3 — Acceptance Criteria (Projeto Completo)

## 1. Functional Acceptance
- Suporta NSR para:
  - Mono-metal
  - Multi-metal com subprodutos
- Suporta termos:
  - Payability por metal
  - TC (por dmt) e RC (por unidade de metal)
  - Penalidades configuráveis
  - Credits por subproduto
- Apresenta:
  - NSR total
  - NSR por tonelada
  - Breakdown: receita bruta, deduções, NSR líquido
- Permite:
  - Criar e salvar cenários
  - Comparar cenários (A/B)
  - Exportar resultados (CSV e PDF)

## 2. Non-Functional Acceptance
- Performance:
  - P95 < 2s para compute NSR com até 10 metais/subprodutos
- Auditabilidade:
  - Mostrar fórmula e inputs usados em cada cálculo
  - Registrar alterações de cenários (who/when/what)
- Segurança:
  - Autenticação e autorização para acessar projetos (no mínimo no full project)

## 3. Quality Acceptance
- Testes unitários no NSR Engine (>= 90% coverage)
- Testes de regressão com “golden datasets”
- Validação cruzada com Excel em pelo menos 5 casos reais
- Tratamento de erros:
  - inputs inválidos com mensagens claras
  - unidades e conversões documentadas

---

# Documento 4 — MVP (Definição + Apelo + Target + Plano)

## 1. Definição do MVP
Uma aplicação web que calcula **NSR por tonelada** de forma rápida e auditável, substituindo planilhas Excel e padronizando premissas.

## 2. Apelo do MVP
- Rapidez: cálculo em minutos
- Confiança: fórmula transparente e reproduzível
- Padronização: mesmo método para todos
- Comparação: cenários simples lado a lado

**Mensagem**
> “NSR confiável em minutos. Sem Excel quebrando.”

## 3. Target do MVP
- Primário: Mining Engineer e Metallurgical Engineer em operação
- Secundário: Supervisores e coordenadores que revisam cenários

## 4. Escopo do MVP (Features)
- Inputs (mínimo):
  - Metal principal: teor, recuperação, preço
  - Payability (default configurável)
  - TC e RC (simplificados)
  - Penalidades (lista simples)
  - Tonelagem de minério (para NSR/ton)
- Output:
  - NSR/ton
  - Breakdown básico (receita, deduções, NSR)
- Cenários:
  - Base + 2 cenários (downside/upside) gerados automaticamente (±x%)
- Export:
  - CSV (obrigatório), PDF (opcional no MVP)

## 5. MVP — Implementation Plan
1. Implementar NSR Engine para mono-metal (com payability + TC/RC)
2. Implementar penalidades simples (valor fixo e por unidade)
3. Criar UI minimalista (form + resultado + breakdown)
4. Criar “scenario generator” simples (±x% preço)
5. Export CSV
6. Validar com 3–5 usuários reais e ajustar UX
7. Lançar beta fechado

---

# Documento 5 — Acceptance Criteria (MVP)

## 1. Functional Acceptance (MVP)
- Calcula NSR/ton para mono-metal
- Suporta payability, TC/RC e penalidades simples
- Mostra breakdown básico (receita, deduções, NSR)
- Gera cenários automático (base/downside/upside)
- Exporta CSV com todos inputs e outputs

## 2. Usability Acceptance (MVP)
- Um usuário consegue obter NSR/ton em <= 5 minutos sem treinamento
- Inputs possuem validação e mensagens de erro claras
- Resultados exibem unidades e moedas explicitamente

## 3. Quality Acceptance (MVP)
- Testes unitários cobrindo casos principais
- Pelo menos 3 casos validados contra Excel com diferença <= 0.1% (exceto arredondamento)
- Logs de cálculo (inputs e outputs) disponíveis para auditoria básica
