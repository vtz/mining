# NSR Calculator — Mina Caraíba

Plataforma web para cálculo e análise de NSR (Net Smelter Return), substituindo planilhas Excel e padronizando premissas econômicas para decisões de mineração.

**Mensagem Central:** "NSR confiável em minutos. Sem Excel quebrando."

## Quick Start

### Backend (API)

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements-dev.txt

# Run development server
uvicorn app.main:app --reload
```

API disponível em: http://localhost:8000
Documentação: http://localhost:8000/docs

### Frontend (Web App)

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend disponível em: http://localhost:3000

### Com Docker

```bash
docker compose up
```

Backend: http://localhost:8000
Frontend: http://localhost:3000

## Estrutura do Projeto

```
minas/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── nsr_engine/     # Core calculation library
│   │   ├── main.py         # Application entry
│   │   └── config.py       # Configuration
│   └── tests/
│       ├── unit/           # Unit tests
│       ├── integration/    # Integration tests
│       └── golden/         # Regression tests
├── frontend/               # Next.js frontend (TODO)
├── docs/                   # Documentation
└── old_impl/              # Previous implementation (archived)
```

## API Endpoints

### Health Check
```
GET /health
```

### Compute NSR
```
POST /api/v1/compute/nsr
```

**Request body:**
```json
{
  "mine": "Vermelhos UG",
  "area": "Vermelhos Sul",
  "cu_grade": 1.4,
  "au_grade": 0.23,
  "ag_grade": 2.33,
  "ore_tonnage": 20000,
  "mine_dilution": 0.14,
  "ore_recovery": 0.98
}
```

**Response:**
```json
{
  "conc_price_total": 3099.09,
  "nsr_per_tonne": 118.72,
  "nsr_cu": 108.21,
  "nsr_au": 9.38,
  "nsr_ag": 1.14,
  ...
}
```

## Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run only unit tests
pytest tests/unit

# Run golden tests
pytest tests/golden
```

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [User Stories](./USER_STORIES.md)
- [NSR Requirements](./NSR_REQUIREMENTS.md)
- [Master Test Plan](./MASTER_TEST_PLAN.md)

## License

Proprietary - All rights reserved.
