# Implementation Plan — NSR Calculator

## Visão Geral

Plataforma web para cálculo e análise de NSR (Net Smelter Return), substituindo planilhas Excel e padronizando premissas econômicas para decisões de mineração.

**Mensagem Central:** "NSR confiável em minutos. Sem Excel quebrando."

---

## Fases de Implementação

### Phase 1 — MVP (Minimum Viable Product)

**Objetivo:** Validar a proposta de valor com usuários reais. Foco em calcular NSR/ton de forma rápida, auditável e reproduzível.

**Escopo:**
- Cálculo NSR para **mono-metal**
- Inputs: teor, recuperação, preço, payability, TC/RC, penalidades simples
- Output: NSR/ton + breakdown básico (receita bruta, deduções, NSR líquido)
- Geração automática de cenários (base/downside/upside ±x%)
- Export CSV
- UI minimalista e responsiva
- API REST documentada (OpenAPI)

**Personas Atendidas:**
- Mining Engineer (Planning e Operation) — casos básicos
- Metallurgical Engineer — visualização de impacto metalúrgico simples

**Critérios de Sucesso:**
- Usuário obtém NSR/ton em ≤ 5 minutos sem treinamento
- 3+ casos validados contra Excel com diferença ≤ 0.1%

---

### Phase 2 — Full Feature

**Objetivo:** Expandir para multi-metal, cenários avançados e funcionalidades enterprise.

**Escopo:**
- Cálculo NSR para **multi-metal** com subprodutos (Au, Ag, Mo, etc.)
- Payability por metal
- TC/RC por metal e por concentrado
- Penalidades configuráveis (fixas, por unidade, por faixa)
- Credits por subproduto
- CRUD completo de projetos e cenários
- Versionamento de cenários com audit trail (quem/quando/o quê)
- Comparação lado a lado (A/B)
- Export PDF profissional
- Autenticação (OAuth/SSO)
- Perfis de usuário e permissões básicas
- Dashboard com métricas agregadas

**Personas Atendidas:**
- Todas as personas com funcionalidades completas
- Mine/Asset Manager — comparação de ativos e cenários macro

**Critérios de Sucesso:**
- Suporte a projetos com até 10 metais/subprodutos
- P95 < 2s para cálculos complexos
- 100% dos cálculos com fórmula e inputs visíveis (auditabilidade)

---

### Phase 3 — AI Integration

**Objetivo:** Habilitar automação e integração com agentes de IA.

**Escopo:**
- OpenAPI completa com schemas estáveis
- Endpoints para "agent tasks":
  - Criar cenário automaticamente
  - Executar análise de sensibilidade
  - Gerar relatório narrativo
  - Comparar N cenários
- Prompt packs e templates para Cursor/Copilot/Claude
- Webhook para notificações
- Valuation simplificado (NPV, fluxo de caixa por período)
- Análise de sensibilidade automatizada (tornado chart)
- Integração com LLMs para geração de insights

**Personas Atendidas:**
- Business Development / M&A Analyst — screening automatizado
- Todos — automação de tarefas repetitivas

**Critérios de Sucesso:**
- Agente consegue criar projeto + cenário + relatório via API
- Tempo médio de task < 30s
- Documentação com exemplos executáveis

---

## High-Level Acceptance Criteria

### Functional Requirements

| ID | Requirement | Phase | Priority |
|----|-------------|-------|----------|
| FR-01 | Calcular NSR/ton para mono-metal | MVP | Must |
| FR-02 | Suportar payability, TC/RC, penalidades simples | MVP | Must |
| FR-03 | Mostrar breakdown (receita, deduções, NSR) | MVP | Must |
| FR-04 | Gerar cenários automáticos (±x%) | MVP | Should |
| FR-05 | Exportar resultados em CSV | MVP | Must |
| FR-06 | Calcular NSR para multi-metal com subprodutos | Full | Must |
| FR-07 | CRUD de projetos e cenários | Full | Must |
| FR-08 | Versionamento com audit trail | Full | Must |
| FR-09 | Comparação de cenários lado a lado | Full | Must |
| FR-10 | Exportar PDF profissional | Full | Should |
| FR-11 | Autenticação OAuth/SSO | Full | Must |
| FR-12 | OpenAPI completa para agentes | AI | Must |
| FR-13 | Agent tasks (create, analyze, report) | AI | Must |
| FR-14 | Análise de sensibilidade automatizada | AI | Should |
| FR-15 | NPV e valuation simplificado | AI | Could |

### Non-Functional Requirements

| ID | Requirement | Target | Phase |
|----|-------------|--------|-------|
| NFR-01 | Tempo de cálculo P95 | < 500ms (mono), < 2s (multi) | MVP/Full |
| NFR-02 | Disponibilidade | 99.5% uptime | Full |
| NFR-03 | Segurança | HTTPS, auth, dados criptografados | Full |
| NFR-04 | Usabilidade | Task completion < 5min sem treinamento | MVP |
| NFR-05 | Auditabilidade | 100% dos cálculos com fórmula visível | MVP |
| NFR-06 | Testabilidade | ≥ 90% coverage no NSR Engine | MVP |
| NFR-07 | Portabilidade | Deploy em qualquer cloud (Docker) | MVP |
| NFR-08 | Manutenibilidade | Código documentado, CI/CD ativo | MVP |

### Quality Gates

| Gate | Criteria | When |
|------|----------|------|
| QG-1 | Todos testes unitários passando | Cada PR |
| QG-2 | Coverage ≥ 80% em código novo | Cada PR |
| QG-3 | Zero erros críticos de linter | Cada PR |
| QG-4 | Testes de integração passando | Merge to main |
| QG-5 | Golden tests (regressão numérica) passando | Merge to main |
| QG-6 | Validação contra Excel (3+ casos) | Release MVP |
| QG-7 | Review de segurança | Release Full |
| QG-8 | Load test P95 < target | Release Full |

---

## Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                    Next.js + Tailwind + shadcn/ui               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Input Forms │  │ Results View│  │ Scenario Comparison     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API (JSON)
┌─────────────────────────────▼───────────────────────────────────┐
│                         BACKEND                                 │
│                    FastAPI + Pydantic + SQLAlchemy              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      API Layer                          │    │
│  │  /projects  /scenarios  /compute  /export  /auth        │    │
│  └─────────────────────────────┬───────────────────────────┘    │
│                                │                                │
│  ┌─────────────────────────────▼───────────────────────────┐    │
│  │                   Domain Services                        │    │
│  │  ProjectService  ScenarioService  ComputeService        │    │
│  └─────────────────────────────┬───────────────────────────┘    │
│                                │                                │
│  ┌─────────────────────────────▼───────────────────────────┐    │
│  │                    NSR ENGINE (Pure)                     │    │
│  │  compute_payable_metal()  compute_gross_revenue()       │    │
│  │  compute_deductions()     compute_nsr_total()           │    │
│  │  compute_nsr_per_tonne()                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                │                                │
│  ┌─────────────────────────────▼───────────────────────────┐    │
│  │                    PERSISTENCE                           │    │
│  │  SQLite (MVP) → PostgreSQL (Production)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Princípios de Design

1. **Separation of Concerns:** NSR Engine é uma biblioteca pura (sem I/O, sem side effects)
2. **Config-Driven:** Fórmulas declarativas, não hardcoded
3. **Determinism:** Mesmo input → mesmo output (sem aleatoriedade)
4. **Transparency:** Sempre mostrar fórmula + inputs + deduções
5. **Testability:** Engine com suíte forte de testes unitários
6. **API-First:** OpenAPI como contrato entre frontend e backend

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Frontend | Next.js 14+ | SSR, App Router, deploy fácil |
| UI Components | shadcn/ui + Tailwind | Profissional, acessível, sem custo |
| Charts | Recharts | Leve, React-native |
| Backend | FastAPI | Async, tipado, OpenAPI automático |
| Validation | Pydantic | Schemas robustos |
| ORM | SQLAlchemy 2.0 | Moderno, async support |
| Database | SQLite → PostgreSQL | Zero config MVP, escala depois |
| Auth | Supabase Auth ou Clerk | Free tier generoso |
| Containerization | Docker + Compose | Portabilidade |
| CI/CD | GitHub Actions | Integração nativa |

---

## Roadmap de Entregas

```
MVP (Phase 1)
├── WP-01: Setup (repo, CI, Docker)
├── WP-02: NSR Engine (mono-metal)
├── WP-03: API Endpoints básicos
├── WP-04: Frontend MVP
├── WP-05: Cenários automáticos + Export CSV
└── WP-06: Testes e validação

Full Feature (Phase 2)
├── WP-07: Multi-metal engine
├── WP-08: Persistence (Projects/Scenarios)
├── WP-09: Auth e permissões
├── WP-10: Audit trail
├── WP-11: Comparação de cenários
├── WP-12: Export PDF
└── WP-13: Dashboard

AI Integration (Phase 3)
├── WP-14: OpenAPI completa
├── WP-15: Agent tasks endpoints
├── WP-16: Prompt packs
├── WP-17: Sensibilidade automatizada
└── WP-18: Valuation simplificado
```

---

## Definição de Pronto (Definition of Done)

### Para cada User Story:
- [ ] Código implementado e revisado
- [ ] Testes unitários com ≥ 80% coverage
- [ ] Testes de integração onde aplicável
- [ ] Documentação atualizada (código + API)
- [ ] Sem erros de linter
- [ ] PR aprovado
- [ ] Merge em main
- [ ] Funcionalidade verificada em ambiente de staging

### Para cada Release:
- [ ] Todos critérios de aceitação validados
- [ ] Golden tests passando
- [ ] Validação cruzada com Excel (MVP)
- [ ] Performance dentro dos targets
- [ ] Documentação de usuário atualizada
- [ ] Release notes publicadas
