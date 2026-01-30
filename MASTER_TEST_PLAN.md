# Master Test Plan — NSR Calculator

## 1. Introdução

### 1.1 Propósito

Este documento define a estratégia de testes para o projeto NSR Calculator, alinhada com práticas de qualidade de CMMI, SPICE (ISO/IEC 15504) e ASPICE. O objetivo é garantir que o software atenda aos requisitos funcionais e não-funcionais com alta confiabilidade.

### 1.2 Escopo

Cobre todas as fases do projeto:
- **MVP:** Foco em cálculos corretos e usabilidade
- **Full Feature:** Cobertura completa de funcionalidades
- **AI Integration:** Validação de APIs e contratos

### 1.3 Referências

| Documento | Descrição |
|-----------|-----------|
| IMPLEMENTATION_PLAN.md | Fases e requisitos do projeto |
| USER_STORIES.md | User stories e acceptance criteria |
| strategy.md | Estratégia e visão do produto |
| personas.md | Personas e jornadas de usuário |

### 1.4 Glossário

| Termo | Definição |
|-------|-----------|
| SUT | System Under Test |
| NSR | Net Smelter Return |
| Golden Test | Teste de regressão com valores conhecidos |
| Mock | Simulação de componente externo |
| Stub | Implementação simplificada para testes |
| E2E | End-to-End |

---

## 2. Estratégia de Testes (Alinhamento CMMI/SPICE)

### 2.1 Níveis de Teste (V-Model)

```
    Requirements ◄────────────────────► Acceptance Tests
         │                                     ▲
         ▼                                     │
    Architecture ◄────────────────────► Integration Tests
         │                                     ▲
         ▼                                     │
    Detailed Design ◄─────────────────► Component Tests
         │                                     ▲
         ▼                                     │
    Implementation ◄──────────────────► Unit Tests
```

### 2.2 Tipos de Teste por Nível

| Nível | Tipo | Responsável | Quando | Ferramenta |
|-------|------|-------------|--------|------------|
| L1 - Unit | Testes unitários | Desenvolvedor | Cada commit | pytest, vitest |
| L2 - Component | Testes de componente | Desenvolvedor | Cada PR | pytest, Testing Library |
| L3 - Integration | Testes de integração | Desenvolvedor/QA | Merge to main | pytest, MSW |
| L4 - System | Testes E2E | QA | Release | Playwright |
| L5 - Acceptance | Validação com usuário | PO/Usuário | Release | Manual + Checklist |

### 2.3 Processo de Verificação (SPICE SWE.4)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Test Process Flow                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │
│  │ Plan    │───►│ Design  │───►│ Execute │───►│ Report  │          │
│  │         │    │         │    │         │    │         │          │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘          │
│       │              │              │              │               │
│       ▼              ▼              ▼              ▼               │
│  Test Plan     Test Cases     Test Results   Test Report           │
│  Test Strategy Test Data      Defect Log     Metrics               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Arquitetura de Testes

### 3.1 Estrutura de Diretórios

```
project/
├── backend/
│   ├── app/
│   │   └── nsr_engine/
│   └── tests/
│       ├── unit/                    # L1: Testes unitários
│       │   ├── test_calculations.py
│       │   ├── test_domain.py
│       │   └── test_validators.py
│       ├── integration/             # L3: Testes de integração
│       │   ├── test_api_compute.py
│       │   ├── test_api_health.py
│       │   └── test_db_operations.py
│       ├── golden/                  # Regressão numérica
│       │   ├── cases/
│       │   │   ├── copper_simple.yaml
│       │   │   ├── copper_with_penalties.yaml
│       │   │   └── multi_metal.yaml
│       │   └── test_golden.py
│       ├── mocks/                   # Mocks e fixtures
│       │   ├── __init__.py
│       │   └── fixtures.py
│       ├── conftest.py              # Configuração pytest
│       └── pytest.ini
│
├── frontend/
│   ├── src/
│   └── tests/
│       ├── unit/                    # L1: Testes unitários
│       │   └── utils.test.ts
│       ├── components/              # L2: Testes de componente
│       │   ├── InputForm.test.tsx
│       │   ├── ResultView.test.tsx
│       │   └── ScenarioTable.test.tsx
│       ├── integration/             # L3: Integração com API mockada
│       │   └── calculation-flow.test.tsx
│       ├── mocks/                   # MSW handlers
│       │   ├── handlers.ts
│       │   └── server.ts
│       └── setup.ts
│
├── e2e/                             # L4: Testes E2E
│   ├── tests/
│   │   ├── calculation.spec.ts
│   │   ├── export.spec.ts
│   │   └── scenarios.spec.ts
│   └── playwright.config.ts
│
└── docs/
    └── test-reports/                # Relatórios gerados
```

### 3.2 Estratégia de Mocking

#### 3.2.1 Backend com Frontend Mockado

Para testar o backend isoladamente, usamos requests HTTP diretas sem frontend real.

```python
# tests/integration/test_api_compute.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_compute_nsr_valid_input():
    """Testa cálculo NSR com inputs válidos."""
    response = client.post("/api/v1/compute/nsr", json={
        "ore": {"tonnage": 1000, "grade": 2.5, "grade_unit": "percent"},
        "metal": {"name": "copper", "price": 8500, "price_unit": "USD/tonne"},
        "recovery": 0.92,
        "terms": {"payability": 0.965, "tc": 80, "rc": 0.08, "penalties": []}
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "nsr_per_tonne" in data
    assert data["nsr_per_tonne"] > 0

def test_compute_nsr_invalid_recovery():
    """Testa validação de recovery > 100%."""
    response = client.post("/api/v1/compute/nsr", json={
        "ore": {"tonnage": 1000, "grade": 2.5, "grade_unit": "percent"},
        "metal": {"name": "copper", "price": 8500, "price_unit": "USD/tonne"},
        "recovery": 1.5,  # Inválido: > 100%
        "terms": {"payability": 0.965, "tc": 80, "rc": 0.08, "penalties": []}
    })
    
    assert response.status_code == 422
    assert "recovery" in response.json()["detail"][0]["loc"]
```

#### 3.2.2 Frontend com Backend Mockado (MSW)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('/api/v1/compute/nsr', async ({ request }) => {
    const body = await request.json()
    
    // Simula cálculo (simplificado para teste)
    const mockResult = {
      nsr_total: 180048.50,
      nsr_per_tonne: 180.05,
      currency: "USD",
      breakdown: {
        gross_revenue: 189048.50,
        payable_metal: 22.241,
        deductions: { tc: 5000, rc: 2500, penalties: 0, total: 7500 }
      }
    }
    
    return HttpResponse.json(mockResult)
  }),
  
  http.post('/api/v1/compute/nsr', async ({ request }) => {
    const body = await request.json()
    
    // Simula erro de validação
    if (body.recovery > 1) {
      return HttpResponse.json(
        { detail: [{ loc: ["body", "recovery"], msg: "Must be <= 1" }] },
        { status: 422 }
      )
    }
    
    return HttpResponse.json({ /* ... */ })
  }),
]
```

```typescript
// tests/integration/calculation-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import CalculatorPage from '@/app/page'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('complete calculation flow', async () => {
  const user = userEvent.setup()
  render(<CalculatorPage />)
  
  // Preenche formulário
  await user.type(screen.getByLabelText(/tonnage/i), '1000')
  await user.type(screen.getByLabelText(/grade/i), '2.5')
  await user.type(screen.getByLabelText(/price/i), '8500')
  
  // Submete
  await user.click(screen.getByRole('button', { name: /calculate/i }))
  
  // Verifica resultado
  await waitFor(() => {
    expect(screen.getByText(/180.05/)).toBeInTheDocument()
    expect(screen.getByText(/NSR per tonne/i)).toBeInTheDocument()
  })
})
```

#### 3.2.3 Testes de Contrato (Contract Testing)

Para garantir que frontend e backend estão alinhados, usamos schemas compartilhados.

```python
# backend/app/schemas/compute.py
from pydantic import BaseModel, Field

class ComputeNSRRequest(BaseModel):
    """Schema da request - fonte da verdade."""
    ore: OreInput
    metal: MetalInput
    recovery: float = Field(ge=0, le=1)
    terms: CommercialTerms

class ComputeNSRResponse(BaseModel):
    """Schema da response - fonte da verdade."""
    nsr_total: float
    nsr_per_tonne: float
    currency: str
    breakdown: BreakdownDetail
```

```typescript
// frontend/src/types/api.ts
// Gerado automaticamente do OpenAPI ou mantido em sync manualmente

interface ComputeNSRRequest {
  ore: OreInput
  metal: MetalInput
  recovery: number
  terms: CommercialTerms
}

interface ComputeNSRResponse {
  nsr_total: number
  nsr_per_tonne: number
  currency: string
  breakdown: BreakdownDetail
}
```

---

## 4. Tipos de Teste Detalhados

### 4.1 Testes Unitários (L1)

**Objetivo:** Validar unidades individuais de código (funções, classes) em isolamento.

**Características:**
- Rápidos (< 100ms cada)
- Sem dependências externas (DB, API, filesystem)
- Alta cobertura (≥ 90% no NSR Engine)
- Executados a cada commit

**Exemplo - NSR Engine:**

```python
# tests/unit/test_calculations.py
import pytest
from app.nsr_engine.calculations import compute_payable_metal

class TestComputePayableMetal:
    """Testes unitários para compute_payable_metal."""
    
    def test_basic_calculation(self):
        """Caso básico: cálculo correto."""
        result = compute_payable_metal(
            tonnage=1000,
            grade=0.025,  # 2.5%
            recovery=0.92,
            payability=0.965
        )
        assert result.value == pytest.approx(22.241, rel=1e-3)
        assert result.unit == "tonnes"
    
    def test_zero_tonnage(self):
        """Zero tonnage deve retornar zero."""
        result = compute_payable_metal(
            tonnage=0,
            grade=0.025,
            recovery=0.92,
            payability=0.965
        )
        assert result.value == 0
    
    def test_negative_tonnage_raises(self):
        """Tonnage negativo deve levantar ValueError."""
        with pytest.raises(ValueError, match="tonnage must be positive"):
            compute_payable_metal(
                tonnage=-1000,
                grade=0.025,
                recovery=0.92,
                payability=0.965
            )
    
    def test_recovery_above_one_raises(self):
        """Recovery > 1 deve levantar ValueError."""
        with pytest.raises(ValueError, match="recovery must be <= 1"):
            compute_payable_metal(
                tonnage=1000,
                grade=0.025,
                recovery=1.5,
                payability=0.965
            )
    
    @pytest.mark.parametrize("grade,grade_unit,expected", [
        (2.5, "percent", 0.025),
        (25000, "ppm", 0.025),
        (25, "g/t", 0.000025),
    ])
    def test_grade_unit_conversion(self, grade, grade_unit, expected):
        """Testa conversão de unidades de teor."""
        result = compute_payable_metal(
            tonnage=1000,
            grade=grade,
            grade_unit=grade_unit,
            recovery=0.92,
            payability=0.965
        )
        # Verifica que conversão foi aplicada corretamente
        assert result.inputs_normalized["grade"] == pytest.approx(expected)
```

### 4.2 Testes de Componente (L2)

**Objetivo:** Validar componentes UI em isolamento com mocks de dependências.

```typescript
// tests/components/InputForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputForm } from '@/components/InputForm'

describe('InputForm', () => {
  const mockOnSubmit = jest.fn()
  
  beforeEach(() => {
    mockOnSubmit.mockClear()
  })
  
  it('renders all required fields', () => {
    render(<InputForm onSubmit={mockOnSubmit} />)
    
    expect(screen.getByLabelText(/tonnage/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/grade/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/recovery/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument()
  })
  
  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<InputForm onSubmit={mockOnSubmit} />)
    
    await user.click(screen.getByRole('button', { name: /calculate/i }))
    
    expect(screen.getByText(/tonnage is required/i)).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })
  
  it('validates recovery <= 100%', async () => {
    const user = userEvent.setup()
    render(<InputForm onSubmit={mockOnSubmit} />)
    
    await user.type(screen.getByLabelText(/recovery/i), '150')
    await user.click(screen.getByRole('button', { name: /calculate/i }))
    
    expect(screen.getByText(/must be <= 100/i)).toBeInTheDocument()
  })
  
  it('submits valid form data', async () => {
    const user = userEvent.setup()
    render(<InputForm onSubmit={mockOnSubmit} />)
    
    await user.type(screen.getByLabelText(/tonnage/i), '1000')
    await user.type(screen.getByLabelText(/grade/i), '2.5')
    await user.type(screen.getByLabelText(/recovery/i), '92')
    await user.type(screen.getByLabelText(/price/i), '8500')
    
    await user.click(screen.getByRole('button', { name: /calculate/i }))
    
    expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
      ore: { tonnage: 1000, grade: 2.5 },
      recovery: 0.92,
      metal: { price: 8500 }
    }))
  })
})
```

### 4.3 Testes de Integração (L3)

**Objetivo:** Validar interação entre componentes e camadas.

#### 4.3.1 Backend Integration Tests

```python
# tests/integration/test_api_compute.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, Base, engine

@pytest.fixture(scope="function")
def client():
    """Cliente de teste com banco limpo."""
    Base.metadata.create_all(bind=engine)
    yield TestClient(app)
    Base.metadata.drop_all(bind=engine)

class TestComputeNSREndpoint:
    """Testes de integração do endpoint /compute/nsr."""
    
    def test_successful_computation(self, client):
        """Computação bem-sucedida retorna resultado completo."""
        response = client.post("/api/v1/compute/nsr", json={
            "ore": {"tonnage": 1000, "grade": 2.5, "grade_unit": "percent"},
            "metal": {"name": "copper", "price": 8500, "price_unit": "USD/tonne"},
            "recovery": 0.92,
            "terms": {"payability": 0.965, "tc": 80, "rc": 0.08, "penalties": []}
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verifica estrutura
        assert "nsr_total" in data
        assert "nsr_per_tonne" in data
        assert "breakdown" in data
        assert "formula" in data
        
        # Verifica valores aproximados
        assert data["nsr_per_tonne"] == pytest.approx(180.05, rel=0.01)
    
    def test_with_penalties(self, client):
        """Computação com penalidades desconta corretamente."""
        response = client.post("/api/v1/compute/nsr", json={
            "ore": {"tonnage": 1000, "grade": 2.5, "grade_unit": "percent"},
            "metal": {"name": "copper", "price": 8500, "price_unit": "USD/tonne"},
            "recovery": 0.92,
            "terms": {
                "payability": 0.965,
                "tc": 80,
                "rc": 0.08,
                "penalties": [
                    {"name": "Arsenic", "value": 1.5, "unit": "USD/dmt"}
                ]
            }
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verifica que penalidade foi aplicada
        assert data["breakdown"]["deductions"]["penalties"] > 0
    
    def test_validation_error_message(self, client):
        """Erro de validação retorna mensagem clara."""
        response = client.post("/api/v1/compute/nsr", json={
            "ore": {"tonnage": -1000, "grade": 2.5},  # Tonnage negativo
            "metal": {"name": "copper", "price": 8500},
            "recovery": 0.92,
            "terms": {"payability": 0.965, "tc": 80, "rc": 0.08}
        })
        
        assert response.status_code == 422
        error = response.json()
        assert "tonnage" in str(error).lower()
```

#### 4.3.2 Frontend Integration Tests (com MSW)

```typescript
// tests/integration/calculation-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import App from '@/app/page'

const server = setupServer(
  http.post('/api/v1/compute/nsr', () => {
    return HttpResponse.json({
      nsr_total: 180048.50,
      nsr_per_tonne: 180.05,
      currency: "USD",
      breakdown: {
        gross_revenue: 189048.50,
        payable_metal: 22.241,
        deductions: { tc: 5000, rc: 2500, penalties: 0, total: 7500 }
      },
      formula: "NSR = ...",
      inputs: {}
    })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Calculation Flow Integration', () => {
  it('completes full calculation flow', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // 1. Preenche formulário
    await user.type(screen.getByLabelText(/tonnage/i), '1000')
    await user.type(screen.getByLabelText(/grade/i), '2.5')
    await user.type(screen.getByLabelText(/recovery/i), '92')
    await user.type(screen.getByLabelText(/price/i), '8500')
    
    // 2. Submete
    await user.click(screen.getByRole('button', { name: /calculate/i }))
    
    // 3. Verifica loading state
    expect(screen.getByText(/calculating/i)).toBeInTheDocument()
    
    // 4. Verifica resultado
    await waitFor(() => {
      expect(screen.getByText(/180.05/)).toBeInTheDocument()
    })
    
    // 5. Verifica breakdown
    expect(screen.getByText(/gross revenue/i)).toBeInTheDocument()
    expect(screen.getByText(/189,048/)).toBeInTheDocument()
  })
  
  it('handles API error gracefully', async () => {
    server.use(
      http.post('/api/v1/compute/nsr', () => {
        return HttpResponse.json(
          { error: { message: 'Internal error' } },
          { status: 500 }
        )
      })
    )
    
    const user = userEvent.setup()
    render(<App />)
    
    await user.type(screen.getByLabelText(/tonnage/i), '1000')
    await user.click(screen.getByRole('button', { name: /calculate/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

### 4.4 Golden Tests (Regressão Numérica)

**Objetivo:** Garantir que cálculos não mudam inadvertidamente.

```yaml
# tests/golden/cases/copper_simple.yaml
name: "Copper Simple - Validated against Excel"
description: |
  Caso básico de cobre validado manualmente contra planilha Excel.
  Ref: NSR Caraíba V.1 - Cenário Base
validated_date: "2026-01-28"
validated_by: "V. Zein"

inputs:
  ore:
    tonnage: 1000
    grade: 2.5
    grade_unit: "percent"
  metal:
    name: "copper"
    price: 8500
    price_unit: "USD/tonne"
  recovery: 0.92
  terms:
    payability: 0.965
    tc: 80
    rc: 0.08
    penalties: []

expected:
  payable_metal: 22.241
  gross_revenue: 189048.50
  deductions:
    tc: 5000.00
    rc: 2000.00
    penalties: 0
    total: 7000.00
  nsr_total: 182048.50
  nsr_per_tonne: 182.05

tolerance: 0.0001  # 0.01% de tolerância
```

```python
# tests/golden/test_golden.py
import pytest
import yaml
from pathlib import Path
from app.nsr_engine import compute_nsr

GOLDEN_DIR = Path(__file__).parent / "cases"

def load_golden_cases():
    """Carrega todos os casos golden."""
    cases = []
    for file in GOLDEN_DIR.glob("*.yaml"):
        with open(file) as f:
            case = yaml.safe_load(f)
            case["file"] = file.name
            cases.append(case)
    return cases

@pytest.mark.parametrize("case", load_golden_cases(), ids=lambda c: c["name"])
def test_golden_case(case):
    """Testa caso golden contra valores esperados."""
    result = compute_nsr(**case["inputs"])
    tolerance = case.get("tolerance", 0.0001)
    
    # Verifica cada valor esperado
    expected = case["expected"]
    
    assert result.payable_metal == pytest.approx(
        expected["payable_metal"], 
        rel=tolerance
    ), f"payable_metal mismatch in {case['file']}"
    
    assert result.gross_revenue == pytest.approx(
        expected["gross_revenue"],
        rel=tolerance
    ), f"gross_revenue mismatch in {case['file']}"
    
    assert result.nsr_total == pytest.approx(
        expected["nsr_total"],
        rel=tolerance
    ), f"nsr_total mismatch in {case['file']}"
    
    assert result.nsr_per_tonne == pytest.approx(
        expected["nsr_per_tonne"],
        rel=tolerance
    ), f"nsr_per_tonne mismatch in {case['file']}"
```

### 4.5 Testes E2E (L4)

**Objetivo:** Validar fluxos completos com sistema real.

```typescript
// e2e/tests/calculation.spec.ts
import { test, expect } from '@playwright/test'

test.describe('NSR Calculation Flow', () => {
  test('complete calculation and export', async ({ page }) => {
    await page.goto('/')
    
    // Preenche formulário
    await page.fill('[data-testid="tonnage"]', '1000')
    await page.fill('[data-testid="grade"]', '2.5')
    await page.fill('[data-testid="recovery"]', '92')
    await page.fill('[data-testid="price"]', '8500')
    await page.fill('[data-testid="payability"]', '96.5')
    await page.fill('[data-testid="tc"]', '80')
    await page.fill('[data-testid="rc"]', '0.08')
    
    // Submete
    await page.click('[data-testid="calculate-btn"]')
    
    // Aguarda resultado
    await expect(page.locator('[data-testid="nsr-result"]')).toBeVisible()
    
    // Verifica valor
    const nsrValue = await page.textContent('[data-testid="nsr-per-tonne"]')
    expect(parseFloat(nsrValue!.replace(/[^0-9.]/g, ''))).toBeGreaterThan(0)
    
    // Testa export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv"]')
    ])
    
    expect(download.suggestedFilename()).toMatch(/nsr_result_.*\.csv/)
  })
  
  test('scenario comparison', async ({ page }) => {
    await page.goto('/')
    
    // Preenche e calcula
    await page.fill('[data-testid="tonnage"]', '1000')
    await page.fill('[data-testid="grade"]', '2.5')
    await page.fill('[data-testid="price"]', '8500')
    await page.click('[data-testid="calculate-btn"]')
    
    // Gera cenários
    await page.fill('[data-testid="variation"]', '10')
    await page.click('[data-testid="generate-scenarios"]')
    
    // Verifica tabela de cenários
    await expect(page.locator('[data-testid="scenario-table"]')).toBeVisible()
    await expect(page.locator('text=Downside')).toBeVisible()
    await expect(page.locator('text=Base')).toBeVisible()
    await expect(page.locator('text=Upside')).toBeVisible()
  })
})
```

---

## 5. Métricas de Qualidade

### 5.1 Cobertura de Código

| Componente | Target | Mínimo |
|------------|--------|--------|
| NSR Engine | 95% | 90% |
| API Endpoints | 85% | 80% |
| Frontend Components | 80% | 70% |
| Utils/Helpers | 80% | 70% |

### 5.2 Métricas de Teste

| Métrica | Target | Ferramenta |
|---------|--------|------------|
| Testes unitários passando | 100% | pytest/vitest |
| Testes de integração passando | 100% | pytest/vitest |
| Golden tests passando | 100% | pytest |
| Tempo de execução CI | < 5 min | GitHub Actions |
| Flaky tests | 0 | CI monitoring |

### 5.3 Qualidade de Código

| Métrica | Target | Ferramenta |
|---------|--------|------------|
| Linter errors | 0 | ruff/eslint |
| Type errors | 0 | mypy/tsc |
| Security vulnerabilities | 0 critical | safety/npm audit |
| Code duplication | < 5% | sonar |

---

## 6. Ambientes de Teste

### 6.1 Ambiente Local (Development)

```yaml
# docker-compose.test.yml
services:
  backend-test:
    build: ./backend
    command: pytest -v --cov=app
    environment:
      - DATABASE_URL=sqlite:///./test.db
      - TESTING=true
    volumes:
      - ./backend:/app
  
  frontend-test:
    build: ./frontend
    command: npm test
    environment:
      - NEXT_PUBLIC_API_URL=http://backend-test:8000
    volumes:
      - ./frontend:/app
```

### 6.2 CI Environment

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt -r requirements-dev.txt
      
      - name: Lint
        run: |
          cd backend
          ruff check .
          ruff format --check .
      
      - name: Type check
        run: |
          cd backend
          mypy app
      
      - name: Unit tests
        run: |
          cd backend
          pytest tests/unit -v --cov=app --cov-report=xml
      
      - name: Integration tests
        run: |
          cd backend
          pytest tests/integration -v
      
      - name: Golden tests
        run: |
          cd backend
          pytest tests/golden -v
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Lint
        run: |
          cd frontend
          npm run lint
      
      - name: Type check
        run: |
          cd frontend
          npm run type-check
      
      - name: Tests
        run: |
          cd frontend
          npm test -- --coverage
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    steps:
      - uses: actions/checkout@v4
      
      - name: Start services
        run: docker compose up -d
      
      - name: Wait for services
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:8000/health; do sleep 1; done'
      
      - name: Run E2E tests
        run: |
          cd e2e
          npx playwright test
      
      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report
```

---

## 7. Processo de Teste (SPICE/CMMI Alignment)

### 7.1 Test Planning (SWE.4.BP1)

| Atividade | Responsável | Artefato |
|-----------|-------------|----------|
| Definir estratégia de teste | Tech Lead | Master Test Plan |
| Identificar casos de teste | Developer/QA | Test Cases |
| Estimar esforço de teste | Team | Sprint Planning |
| Configurar ambiente | DevOps | CI/CD Pipeline |

### 7.2 Test Design (SWE.4.BP2)

| Técnica | Aplicação |
|---------|-----------|
| Equivalence Partitioning | Inputs numéricos (faixas válidas/inválidas) |
| Boundary Value Analysis | Limites de recovery (0%, 100%) |
| Decision Tables | Combinações de penalidades |
| State Transition | Fluxos de UI (form → loading → result) |

### 7.3 Test Execution (SWE.4.BP3)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Execution Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Developer                        CI                            │
│  ┌─────────────┐                 ┌─────────────┐               │
│  │ Write Code  │────commit───────│ Trigger     │               │
│  └─────────────┘                 └──────┬──────┘               │
│                                         │                       │
│  ┌─────────────┐                        ▼                       │
│  │ Run Local   │◄───feedback────┌──────────────┐               │
│  │ Tests       │                │ Run Lint     │               │
│  └─────────────┘                └──────┬───────┘               │
│                                        │ pass                   │
│                                        ▼                        │
│                                 ┌──────────────┐               │
│                                 │ Run Unit     │               │
│                                 │ Tests        │               │
│                                 └──────┬───────┘               │
│                                        │ pass                   │
│                                        ▼                        │
│                                 ┌──────────────┐               │
│                                 │ Run Int      │               │
│                                 │ Tests        │               │
│                                 └──────┬───────┘               │
│                                        │ pass                   │
│                                        ▼                        │
│                                 ┌──────────────┐               │
│                                 │ Run Golden   │               │
│                                 │ Tests        │               │
│                                 └──────┬───────┘               │
│                                        │ pass                   │
│                                        ▼                        │
│                                 ┌──────────────┐               │
│                                 │ ✓ Ready for  │               │
│                                 │   Review     │               │
│                                 └──────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Defect Management (SWE.4.BP4)

| Severidade | Descrição | SLA |
|------------|-----------|-----|
| Critical | Sistema não funciona, dados incorretos | 24h |
| High | Funcionalidade principal afetada | 48h |
| Medium | Funcionalidade secundária afetada | Sprint |
| Low | Cosmético, UX minor | Backlog |

### 7.5 Test Reporting (SWE.4.BP5)

**Report gerado em cada CI run:**
- Testes executados / passando / falhando
- Cobertura de código
- Tempo de execução
- Trend (comparação com runs anteriores)

---

## 8. Checklists de Qualidade

### 8.1 Checklist de Code Review

- [ ] Código segue style guide
- [ ] Testes unitários adicionados
- [ ] Testes de integração onde aplicável
- [ ] Documentação atualizada
- [ ] Sem secrets hardcoded
- [ ] Sem console.log / print de debug
- [ ] Error handling adequado
- [ ] Performance considerada

### 8.2 Checklist de Release

- [ ] Todos testes passando
- [ ] Coverage acima do target
- [ ] Golden tests validados
- [ ] Validação cruzada com Excel (MVP)
- [ ] Security scan limpo
- [ ] Performance dentro dos targets
- [ ] Documentação de usuário atualizada
- [ ] Release notes prontas

### 8.3 Checklist de User Story

- [ ] Acceptance criteria verificados
- [ ] Testes unitários (≥80% coverage)
- [ ] Testes de integração
- [ ] UI/UX validada (se aplicável)
- [ ] Documentação atualizada
- [ ] PR aprovado
- [ ] Merged to main
- [ ] Verificado em staging

---

## 9. Ferramentas

| Categoria | Ferramenta | Propósito |
|-----------|------------|-----------|
| Unit Testing (Python) | pytest | Testes unitários e integração |
| Coverage (Python) | pytest-cov | Cobertura de código |
| Mocking (Python) | pytest-mock, responses | Mocks HTTP |
| Unit Testing (JS) | vitest | Testes unitários |
| Component Testing | Testing Library | Testes de componente React |
| Mocking (JS) | MSW | Mock Service Worker |
| E2E Testing | Playwright | Testes end-to-end |
| Linting (Python) | ruff | Lint e format |
| Linting (JS) | eslint, prettier | Lint e format |
| Type Checking | mypy, tsc | Verificação de tipos |
| CI/CD | GitHub Actions | Pipeline automatizado |
| Coverage Report | Codecov | Visualização de coverage |

---

## 10. Apêndices

### A. Template de Caso de Teste

```yaml
test_case_id: TC-XXX
title: "Descrição breve do teste"
priority: High | Medium | Low
type: Unit | Integration | E2E
preconditions:
  - "Sistema está rodando"
  - "Usuário está na página inicial"
steps:
  - step: 1
    action: "Inserir valor X no campo Y"
    expected: "Campo aceita o valor"
  - step: 2
    action: "Clicar no botão Z"
    expected: "Sistema processa e exibe resultado"
postconditions:
  - "Sistema retorna ao estado inicial"
```

### B. Template de Bug Report

```yaml
bug_id: BUG-XXX
title: "Descrição breve do bug"
severity: Critical | High | Medium | Low
environment: "Browser X, OS Y, Version Z"
steps_to_reproduce:
  - "Passo 1"
  - "Passo 2"
expected_result: "O que deveria acontecer"
actual_result: "O que aconteceu"
attachments:
  - "screenshot.png"
  - "console.log"
```

### C. Referências CMMI/SPICE

| Processo | CMMI | SPICE |
|----------|------|-------|
| Verificação | VER | SWE.4 |
| Validação | VAL | SWE.5 |
| Gerenciamento de Configuração | CM | SUP.8 |
| Garantia de Qualidade | PPQA | SUP.1 |
