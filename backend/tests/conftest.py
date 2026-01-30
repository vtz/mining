"""Pytest configuration and fixtures."""

import pytest
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def sample_nsr_input():
    """Sample NSR input for Vermelhos Sul."""
    return {
        "mine": "Vermelhos UG",
        "area": "Vermelhos Sul",
        "cu_grade": 1.4,
        "au_grade": 0.23,
        "ag_grade": 2.33,
        "ore_tonnage": 20000,
        "mine_dilution": 0.14,
        "ore_recovery": 0.98,
    }
