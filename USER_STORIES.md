# User Stories — MVP

## Convenções para Desenvolvimento por Agente

### Formato de User Story

```
US-XX: [Título]
Como [persona], eu quero [ação] para [benefício].

Acceptance Criteria:
- [ ] AC-1: ...
- [ ] AC-2: ...

Technical Notes:
- Implementação: ...
- Dependências: ...
- Testes requeridos: ...

Definition of Done:
- [ ] Código implementado
- [ ] Testes unitários (≥80% coverage)
- [ ] Testes de integração
- [ ] Documentação atualizada
- [ ] PR aprovado e merged
```

### Regras para Agentes

1. **Cada PR deve conter:**
   - Código funcional
   - Testes unitários e de integração
   - Atualização de documentação
   - Exemplos de uso (quando aplicável)

2. **Commits seguem Conventional Commits:**
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `test:` adição de testes
   - `docs:` documentação
   - `refactor:` refatoração sem mudança de comportamento

3. **Ordem de implementação:** Seguir numeração US-XX

---

## Epic 1: Setup e Infraestrutura

### US-01: Estrutura do Repositório

**Como** desenvolvedor, **eu quero** um repositório bem estruturado **para** começar o desenvolvimento com boas práticas.

**Acceptance Criteria:**
- [ ] AC-1: Monorepo com pastas `backend/`, `frontend/`, `docs/`
- [ ] AC-2: `.gitignore` configurado (venv, node_modules, .env, __pycache__, etc.)
- [ ] AC-3: `README.md` com instruções de setup
- [ ] AC-4: `.env.example` com variáveis necessárias
- [ ] AC-5: `docker-compose.yml` para desenvolvimento local

**Technical Notes:**
- Backend: Python 3.12+, FastAPI
- Frontend: Node 20+, Next.js 14+
- Estrutura de pastas seguindo convenções de cada framework

**Arquivos a criar:**
```
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   └── config.py
│   ├── tests/
│   │   └── __init__.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   └── app/
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docs/
│   └── domain.md
├── docker-compose.yml
├── .gitignore
├── .env.example
└── README.md
```

**Definition of Done:**
- [ ] Estrutura criada
- [ ] `docker compose up` funciona
- [ ] Backend responde em `/health`
- [ ] Frontend carrega página inicial

---

### US-02: CI/CD Pipeline

**Como** desenvolvedor, **eu quero** um pipeline de CI/CD **para** garantir qualidade a cada commit.

**Acceptance Criteria:**
- [ ] AC-1: GitHub Actions workflow configurado
- [ ] AC-2: Lint (ruff/eslint) roda em cada PR
- [ ] AC-3: Testes unitários rodam em cada PR
- [ ] AC-4: Build verifica que código compila
- [ ] AC-5: Branch protection em `main` requer PR aprovado

**Technical Notes:**
- Backend: ruff (lint + format), pytest
- Frontend: eslint, prettier, vitest ou jest
- Workflow: `.github/workflows/ci.yml`

**Arquivos a criar:**
```
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── pyproject.toml (ou ruff.toml)
│   └── pytest.ini
├── frontend/
│   ├── .eslintrc.json
│   └── .prettierrc
```

**Definition of Done:**
- [ ] Workflow executa com sucesso
- [ ] PR com erro de lint é bloqueado
- [ ] PR com teste falhando é bloqueado

---

## Epic 2: NSR Engine (Core)

### US-03: Modelo de Domínio Base (Caraíba)

**Como** desenvolvedor, **eu quero** entidades de domínio bem definidas **para** ter uma base sólida para cálculos NSR da Mina Caraíba.

**Acceptance Criteria:**
- [ ] AC-1: Entidade `Mine` com (name, areas: List[Area])
- [ ] AC-2: Entidade `Area` com (name, mine_method: UG|OP, recovery_params)
- [ ] AC-3: Entidade `RecoveryParams` com (a, b, fixed) para fórmula linear: recovery = a × grade + b
- [ ] AC-4: Entidade `Metal` com (code: Cu|Au|Ag, price, price_unit, is_byproduct)
- [ ] AC-5: Entidade `HeadGrades` com (cu_grade, au_grade, ag_grade, units)
- [ ] AC-6: Entidade `MineFactors` com (dilution, ore_recovery)
- [ ] AC-7: Entidade `CommercialTerms` com (payability, tc, rc, freight, penalties) por metal
- [ ] AC-8: Entidade `PriceDeck` com cenários (Mineral Resources, Reserves, Consensus)
- [ ] AC-9: Entidade `NSRResult` com breakdown multi-metal
- [ ] AC-10: Todas entidades com validação via Pydantic
- [ ] AC-11: Seed data com minas/áreas de Caraíba (ver NSR_REQUIREMENTS.md)
- [ ] AC-12: Documentação do domínio em `docs/domain.md`

**Referência:** Ver `NSR_REQUIREMENTS.md` para lista completa de minas, áreas e fórmulas.

**Technical Notes:**
- Usar Pydantic BaseModel para todas entidades
- Unidades explícitas (USD, USD/oz, USD/lb, etc.)
- Suportar conversões de unidade comuns

**Arquivos a criar/modificar:**
```
backend/app/
├── domain/
│   ├── __init__.py
│   ├── metal.py
│   ├── ore.py
│   ├── terms.py
│   └── result.py
docs/
└── domain.md
```

**Definition of Done:**
- [ ] Entidades implementadas
- [ ] Testes unitários para validações
- [ ] Documentação do domínio completa

---

### US-04: Função compute_cu_recovery e compute_payable_metal

**Como** NSR Engine, **eu preciso** calcular a recuperação de Cu e o metal pagável **para** determinar a quantidade de metal que gera receita.

**Acceptance Criteria:**
- [ ] AC-1: Função `compute_cu_recovery(grade, area)` calcula recuperação por fórmula linear
- [ ] AC-2: Fórmula de recuperação: `recovery = a × grade + b` (parâmetros por área)
- [ ] AC-3: Suportar valor fixo de recuperação quando especificado
- [ ] AC-4: Fórmula payable: `payable_metal = tonnage × grade × recovery × payability`
- [ ] AC-5: Suportar conversão de unidades (%, ppm, g/t → fração)
- [ ] AC-6: Validar inputs (valores positivos, recovery/payability ≤ 100%)
- [ ] AC-7: Retornar objeto com valor + unidade + fórmula aplicada
- [ ] AC-8: Função pura (sem side effects)

**Technical Notes:**
- Localização: `backend/app/nsr_engine/calculations.py`
- Parâmetros de recuperação por área em `backend/app/nsr_engine/recovery_params.py`
- Testes com casos conhecidos de Excel Caraíba

**Parâmetros de recuperação (seed data):**
```python
RECOVERY_PARAMS = {
    "Vermelhos Sul": {"a": 2.8286, "b": 92.584, "fixed": None},
    "UG03": {"a": 2.8286, "b": 92.584, "fixed": None},
    "Deepening Above - 965": {"a": 4.0851, "b": 90.346, "fixed": 92.9},
    "MSBSUL": {"a": 7.5986, "b": 85.494, "fixed": 90.0},
    # ... ver NSR_REQUIREMENTS.md para lista completa
}
```

**Exemplo de uso:**
```python
# Calcular recuperação
recovery = compute_cu_recovery(
    cu_grade=1.4,  # %
    area="Vermelhos Sul"
)
# recovery = 2.8286 × 1.4 + 92.584 = 96.544%

# Calcular metal pagável
result = compute_payable_metal(
    tonnage=1000,        # tonnes
    grade=1.4,           # % Cu
    recovery=0.96544,    # calculado acima
    payability=0.9665    # 96.65%
)
# result.value = ... tonnes Cu payable
```

**Definition of Done:**
- [ ] Funções implementadas
- [ ] ≥ 5 testes unitários para cada função
- [ ] Parâmetros de recuperação para todas áreas de Caraíba
- [ ] Validação de inputs
- [ ] Docstring com fórmulas

---

### US-05: Função compute_gross_revenue

**Como** NSR Engine, **eu preciso** calcular a receita bruta **para** determinar o valor máximo antes de deduções.

**Acceptance Criteria:**
- [ ] AC-1: Fórmula: `gross_revenue = payable_metal × price`
- [ ] AC-2: Suportar preços em diferentes unidades (USD/oz, USD/lb, USD/tonne)
- [ ] AC-3: Conversão automática de unidades de metal para unidade de preço
- [ ] AC-4: Retornar valor em moeda configurável (default USD)
- [ ] AC-5: Função pura

**Technical Notes:**
- Conversões: 1 troy oz = 31.1035g, 1 lb = 453.592g
- Localização: `backend/app/nsr_engine/calculations.py`

**Exemplo de uso:**
```python
result = compute_gross_revenue(
    payable_metal=22.241,  # tonnes Cu
    price=8500,            # USD/tonne
)
# result.value = 189,048.50 USD
```

**Definition of Done:**
- [ ] Função implementada
- [ ] Testes com diferentes unidades
- [ ] Conversões validadas

---

### US-06: Função compute_deductions

**Como** NSR Engine, **eu preciso** calcular todas as deduções **para** chegar ao NSR líquido.

**Acceptance Criteria:**
- [ ] AC-1: TC (Treatment Charge): valor por dmt de concentrado
- [ ] AC-2: RC (Refining Charge): valor por unidade de metal pagável
- [ ] AC-3: Penalidades: lista de (name, value, unit)
- [ ] AC-4: Retornar breakdown detalhado de cada dedução
- [ ] AC-5: Suportar deduções fixas e variáveis
- [ ] AC-6: Função pura

**Technical Notes:**
- dmt = dry metric tonne
- Penalidades podem ser: fixas, por unidade de metal, por unidade de concentrado

**Estrutura de retorno:**
```python
DeductionsResult(
    tc=5000.00,
    rc=2500.00,
    penalties=[
        {"name": "Arsenic", "value": 1200.00},
        {"name": "Moisture", "value": 300.00}
    ],
    total=9000.00,
    breakdown=[...]  # detalhamento para auditoria
)
```

**Definition of Done:**
- [ ] Função implementada
- [ ] Testes para cada tipo de dedução
- [ ] Breakdown auditável

---

### US-07: Função compute_nsr_complete (Multi-Metal Caraíba)

**Como** usuário, **eu quero** o NSR total e por tonelada com breakdown multi-metal **para** tomar decisões de cut-off e planejamento.

**Acceptance Criteria:**
- [ ] AC-1: Calcular preço do concentrado por metal (Cu, Au, Ag)
- [ ] AC-2: Calcular NSR por metal ($/t ore)
- [ ] AC-3: Aplicar fatores de mina: `nsr_mine = nsr_processing × (1 - dilution) × ore_recovery`
- [ ] AC-4: Calcular 3 níveis de NSR: Mineral Resources, Processing, Mine
- [ ] AC-5: Retornar breakdown com contribuição de cada metal
- [ ] AC-6: Retornar perdas detalhadas (diluição, recovery)
- [ ] AC-7: Suportar moeda configurável (default USD)
- [ ] AC-8: Função pura que orquestra as anteriores

**Technical Notes:**
- Esta é a função principal que usuários chamam
- Deve retornar breakdown completo para auditoria
- Ver NSR_REQUIREMENTS.md para fórmulas detalhadas

**Estrutura de retorno:**
```python
NSRResult(
    # Preço do concentrado
    conc_price_cu=2824.68,
    conc_price_au=244.76,
    conc_price_ag=29.65,
    conc_price_total=3099.09,
    
    # NSR por metal ($/t ore)
    nsr_cu=108.21,
    nsr_au=9.38,
    nsr_ag=1.14,
    
    # NSR por nível
    nsr_mineral_resources=175.61,  # Antes de processing
    nsr_processing=131.76,         # Após perdas de processing
    nsr_mine=148.01,               # Após diluição e ore recovery
    nsr_per_tonne=118.72,          # NSR final
    
    # Perdas
    dilution_loss=27.60,
    recovery_loss=16.25,
    
    # Metadados
    currency="USD",
    ore_tonnage=20000,
    conc_ratio=0.0383,
    cu_recovery=0.9654,
    formula_applied="Ver NSR_REQUIREMENTS.md",
    inputs_used={...}
)
```

**Golden Test Case (Vermelhos Sul):**
- Cu Grade: 1.4%, Au: 0.23 g/t, Ag: 2.33 g/t
- NSR Total esperado: ~$118.72/t ore
- Tolerância: ≤0.1%

**Definition of Done:**
- [ ] Funções implementadas
- [ ] Testes end-to-end do cálculo completo
- [ ] Golden test com caso Vermelhos Sul
- [ ] Validação contra Excel Caraíba (diff ≤0.1%)

---

### US-08: Golden Tests (Regressão Numérica)

**Como** QA, **eu quero** testes de regressão com valores conhecidos **para** garantir que cálculos não mudam inadvertidamente.

**Acceptance Criteria:**
- [ ] AC-1: Arquivo `tests/golden/` com casos de teste em JSON/YAML
- [ ] AC-2: Mínimo 5 casos cobrindo diferentes cenários
- [ ] AC-3: Casos validados manualmente contra Excel
- [ ] AC-4: Testes falham se resultado difere > 0.01%
- [ ] AC-5: Documentação de como adicionar novos golden tests

**Technical Notes:**
- Golden tests são "snapshot tests" para valores numéricos
- Devem rodar no CI em cada PR

**Estrutura de caso:**
```yaml
# tests/golden/cases/copper_simple.yaml
name: "Copper Simple Case"
description: "Basic copper NSR calculation validated against Excel"
inputs:
  tonnage: 1000
  grade: 2.5
  grade_unit: "%"
  recovery: 0.92
  payability: 0.965
  price: 8500
  price_unit: "USD/tonne"
  tc: 80
  rc: 0.08
  penalties: []
expected:
  nsr_total: 180048.50
  nsr_per_tonne: 180.05
  tolerance: 0.0001  # 0.01%
```

**Definition of Done:**
- [ ] Estrutura de golden tests criada
- [ ] 5+ casos implementados
- [ ] CI configurado para rodar golden tests

---

## Epic 3: API Backend

### US-09: Endpoint POST /compute/nsr

**Como** frontend, **eu quero** um endpoint stateless para calcular NSR **para** obter resultados sem persistência.

**Acceptance Criteria:**
- [ ] AC-1: Endpoint `POST /api/v1/compute/nsr`
- [ ] AC-2: Request body com todos inputs necessários
- [ ] AC-3: Response com NSRResult completo
- [ ] AC-4: Validação de inputs com mensagens claras
- [ ] AC-5: Documentação OpenAPI automática
- [ ] AC-6: Tempo de resposta P95 < 500ms

**Technical Notes:**
- Endpoint stateless (não persiste nada)
- Usa NSR Engine internamente

**Request:**
```json
{
  "ore": {
    "tonnage": 1000,
    "grade": 2.5,
    "grade_unit": "percent"
  },
  "metal": {
    "name": "copper",
    "price": 8500,
    "price_unit": "USD/tonne"
  },
  "recovery": 0.92,
  "terms": {
    "payability": 0.965,
    "tc": 80,
    "rc": 0.08,
    "penalties": []
  }
}
```

**Response:**
```json
{
  "nsr_total": 180048.50,
  "nsr_per_tonne": 180.05,
  "currency": "USD",
  "breakdown": {
    "gross_revenue": 189048.50,
    "payable_metal": 22.241,
    "deductions": {
      "tc": 5000.00,
      "rc": 2500.00,
      "penalties": 0,
      "total": 7500.00
    }
  },
  "formula": "...",
  "inputs": {...}
}
```

**Definition of Done:**
- [ ] Endpoint implementado
- [ ] Testes de integração
- [ ] OpenAPI documentado
- [ ] Exemplos em Swagger UI

---

### US-10: Endpoint GET /health

**Como** infraestrutura, **eu quero** um health check **para** monitorar disponibilidade.

**Acceptance Criteria:**
- [ ] AC-1: Endpoint `GET /health`
- [ ] AC-2: Retorna `{"status": "healthy", "version": "x.y.z"}`
- [ ] AC-3: Tempo de resposta < 100ms
- [ ] AC-4: Não requer autenticação

**Definition of Done:**
- [ ] Endpoint implementado
- [ ] Teste de integração

---

### US-11: Tratamento de Erros Padronizado

**Como** desenvolvedor, **eu quero** erros padronizados **para** facilitar debugging e UX.

**Acceptance Criteria:**
- [ ] AC-1: Erros de validação retornam 422 com detalhes
- [ ] AC-2: Erros de servidor retornam 500 com ID de correlação
- [ ] AC-3: Formato consistente: `{"error": {"code": "...", "message": "...", "details": {...}}}`
- [ ] AC-4: Logs estruturados para todos erros
- [ ] AC-5: Nunca expor stack traces em produção

**Definition of Done:**
- [ ] Error handlers implementados
- [ ] Testes para cada tipo de erro
- [ ] Logs verificados

---

## Epic 4: Frontend MVP

### US-12: Página de Input (Formulário NSR)

**Como** Mining Engineer, **eu quero** um formulário para inserir dados **para** calcular NSR rapidamente.

**Acceptance Criteria:**
- [ ] AC-1: Campos para: tonnage, grade, recovery, price, payability, TC, RC
- [ ] AC-2: Validação client-side em tempo real
- [ ] AC-3: Unidades selecionáveis (%, ppm, g/t)
- [ ] AC-4: Valores default sensatos (ex: payability 96.5%)
- [ ] AC-5: Botão "Calculate" chama API
- [ ] AC-6: Loading state enquanto calcula
- [ ] AC-7: Mobile responsive

**Technical Notes:**
- Usar React Hook Form ou similar
- Componentes shadcn/ui
- Zod para validação

**Wireframe:**
```
┌─────────────────────────────────────────────┐
│           NSR Calculator                     │
├─────────────────────────────────────────────┤
│  Ore Input                                   │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Tonnage     │  │ Grade       │  [unit ▼] │
│  │ 1000        │  │ 2.5         │  [%     ] │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  Metal & Price                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Metal       │  │ Price       │  [unit ▼] │
│  │ [Copper  ▼] │  │ 8500        │  [USD/t ] │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  Recovery & Terms                           │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Recovery %  │  │ Payability %│           │
│  │ 92          │  │ 96.5        │           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ TC ($/dmt)  │  │ RC ($/unit) │           │
│  │ 80          │  │ 0.08        │           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  Penalties (optional)                       │
│  [+ Add Penalty]                            │
│                                             │
│         [ Calculate NSR ]                   │
└─────────────────────────────────────────────┘
```

**Definition of Done:**
- [ ] Formulário funcional
- [ ] Validação implementada
- [ ] Integração com API
- [ ] Testes de componente

---

### US-13: Página de Resultado (Breakdown)

**Como** Mining Engineer, **eu quero** ver o resultado com breakdown **para** entender como o NSR foi calculado.

**Acceptance Criteria:**
- [ ] AC-1: Exibir NSR/ton em destaque (número grande)
- [ ] AC-2: Exibir NSR total
- [ ] AC-3: Breakdown visual: receita → deduções → NSR
- [ ] AC-4: Mostrar fórmula aplicada
- [ ] AC-5: Mostrar todos inputs usados
- [ ] AC-6: Botão "Voltar" para editar inputs
- [ ] AC-7: Botão "Exportar CSV"

**Technical Notes:**
- Usar gráfico de barras horizontal para breakdown
- Cores: verde (receita), vermelho (deduções), azul (NSR)

**Wireframe:**
```
┌─────────────────────────────────────────────┐
│           NSR Result                         │
├─────────────────────────────────────────────┤
│                                             │
│    ┌───────────────────────────────────┐    │
│    │         NSR/tonne                 │    │
│    │         $180.05                   │    │
│    │         USD/t ore                 │    │
│    └───────────────────────────────────┘    │
│                                             │
│    NSR Total: $180,048.50                   │
│                                             │
│    Breakdown                                │
│    ├─ Gross Revenue    $189,048.50 ██████   │
│    ├─ TC               -$5,000.00  ██       │
│    ├─ RC               -$2,500.00  █        │
│    ├─ Penalties        -$1,500.00  █        │
│    └─ NSR Total        $180,048.50 █████    │
│                                             │
│    Formula Applied                          │
│    NSR = (T × G × R × P × Price) - TC - RC  │
│                                             │
│    Inputs Used                              │
│    • Tonnage: 1,000 t                       │
│    • Grade: 2.5%                            │
│    • Recovery: 92%                          │
│    • ...                                    │
│                                             │
│    [← Edit]              [Export CSV]       │
└─────────────────────────────────────────────┘
```

**Definition of Done:**
- [ ] Resultado exibido corretamente
- [ ] Breakdown visual
- [ ] Fórmula e inputs visíveis
- [ ] Testes de componente

---

### US-14: Gerador de Cenários Automático

**Como** Mining Engineer, **eu quero** cenários automáticos (base/down/up) **para** ver sensibilidade rapidamente.

**Acceptance Criteria:**
- [ ] AC-1: Input para variação % (default 10%)
- [ ] AC-2: Gerar 3 cenários: Base, Downside (-x%), Upside (+x%)
- [ ] AC-3: Variação aplicada ao preço do metal
- [ ] AC-4: Exibir tabela comparativa com os 3 cenários
- [ ] AC-5: Highlight das diferenças

**Technical Notes:**
- Cenários gerados client-side (3 chamadas à API) ou server-side (1 chamada)
- Preferir server-side para performance

**Wireframe:**
```
┌─────────────────────────────────────────────┐
│    Scenario Comparison                       │
│    Variation: [10] %                         │
├─────────────────────────────────────────────┤
│              Downside   Base      Upside    │
│    Price     $7,650     $8,500    $9,350    │
│    NSR/ton   $162.04    $180.05   $198.05   │
│    NSR Total $162,045   $180,048  $198,051  │
│    Δ vs Base -10.0%     —         +10.0%    │
└─────────────────────────────────────────────┘
```

**Definition of Done:**
- [ ] Geração de cenários funcional
- [ ] Tabela comparativa
- [ ] Testes

---

### US-15: Export CSV

**Como** usuário, **eu quero** exportar resultados em CSV **para** usar em outras ferramentas.

**Acceptance Criteria:**
- [ ] AC-1: Botão "Export CSV" na página de resultado
- [ ] AC-2: CSV inclui todos inputs e outputs
- [ ] AC-3: CSV inclui timestamp e versão
- [ ] AC-4: Nome do arquivo: `nsr_result_YYYYMMDD_HHMMSS.csv`
- [ ] AC-5: Download inicia automaticamente

**Formato CSV:**
```csv
# NSR Calculation Export
# Generated: 2026-01-28T15:30:00Z
# Version: 1.0.0

Parameter,Value,Unit
Tonnage,1000,t
Grade,2.5,%
Recovery,92,%
Price,8500,USD/t
Payability,96.5,%
TC,80,USD/dmt
RC,0.08,USD/lb

Result,Value,Unit
Gross Revenue,189048.50,USD
Total Deductions,9000.00,USD
NSR Total,180048.50,USD
NSR per Tonne,180.05,USD/t
```

**Definition of Done:**
- [ ] Export funcional
- [ ] Formato CSV correto
- [ ] Testes

---

## Epic 5: Integração e Qualidade

### US-16: Testes de Integração Backend

**Como** QA, **eu quero** testes de integração do backend **para** garantir que API funciona end-to-end.

**Acceptance Criteria:**
- [ ] AC-1: Testes usando TestClient do FastAPI
- [ ] AC-2: Cobrir happy path de cada endpoint
- [ ] AC-3: Cobrir casos de erro (validação, 404, 500)
- [ ] AC-4: Testes rodam no CI
- [ ] AC-5: Coverage report gerado

**Definition of Done:**
- [ ] Testes implementados
- [ ] CI configurado
- [ ] Coverage ≥ 80%

---

### US-17: Testes de Integração Frontend

**Como** QA, **eu quero** testes de integração do frontend **para** garantir que UI funciona corretamente.

**Acceptance Criteria:**
- [ ] AC-1: Testes usando Testing Library + MSW (Mock Service Worker)
- [ ] AC-2: Cobrir fluxo completo: input → submit → resultado
- [ ] AC-3: Testar estados de loading e erro
- [ ] AC-4: Testes rodam no CI

**Definition of Done:**
- [ ] Testes implementados
- [ ] Mocks configurados
- [ ] CI verde

---

### US-18: Testes E2E (Opcional MVP)

**Como** QA, **eu quero** testes E2E **para** validar o sistema completo.

**Acceptance Criteria:**
- [ ] AC-1: Playwright ou Cypress configurado
- [ ] AC-2: Teste do fluxo principal (input → resultado → export)
- [ ] AC-3: Roda em CI (pode ser manual trigger)

**Definition of Done:**
- [ ] Framework configurado
- [ ] 1+ teste E2E funcional

---

## Matriz de Dependências

```
US-01 (Setup) ──┬──► US-02 (CI/CD)
                │
                └──► US-03 (Domínio) ──► US-04 (payable) ──► US-05 (revenue)
                                                │                   │
                                                └───────┬───────────┘
                                                        │
                                                        ▼
                                              US-06 (deductions)
                                                        │
                                                        ▼
                                              US-07 (nsr_total)
                                                        │
                                                        ▼
                                              US-08 (golden tests)
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    │                   │                   │
                                    ▼                   ▼                   ▼
                              US-09 (API)         US-10 (health)      US-11 (errors)
                                    │
                                    ▼
                              US-12 (form) ──► US-13 (result) ──► US-14 (scenarios)
                                                    │
                                                    ▼
                                              US-15 (export)
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                        US-16 (int BE)        US-17 (int FE)        US-18 (E2E)
```

---

## Estimativa de Complexidade

| US | Título | Complexidade | Dependências |
|----|--------|--------------|--------------|
| US-01 | Setup Repo | Média | - |
| US-02 | CI/CD | Média | US-01 |
| US-03 | Domínio | Média | US-01 |
| US-04 | payable_metal | Baixa | US-03 |
| US-05 | gross_revenue | Baixa | US-04 |
| US-06 | deductions | Média | US-03 |
| US-07 | nsr_total | Baixa | US-05, US-06 |
| US-08 | Golden Tests | Média | US-07 |
| US-09 | API /compute | Média | US-07 |
| US-10 | /health | Baixa | US-01 |
| US-11 | Error Handling | Baixa | US-09 |
| US-12 | Form UI | Alta | US-09 |
| US-13 | Result UI | Média | US-12 |
| US-14 | Scenarios | Média | US-13 |
| US-15 | Export CSV | Baixa | US-13 |
| US-16 | Testes Int BE | Média | US-09 |
| US-17 | Testes Int FE | Média | US-15 |
| US-18 | E2E | Alta | US-17 |

**Total estimado para MVP:** 18 User Stories
