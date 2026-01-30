"""Integration tests for API endpoints."""

import pytest


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_returns_200(self, client):
        """Test health endpoint returns 200."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_status(self, client):
        """Test health endpoint returns status."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_returns_200(self, client):
        """Test root endpoint returns 200."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_app_info(self, client):
        """Test root returns application info."""
        response = client.get("/")
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "docs" in data


class TestComputeNSREndpoint:
    """Tests for /api/v1/compute/nsr endpoint."""

    def test_compute_with_valid_input(self, client, sample_nsr_input):
        """Test computation with valid input."""
        response = client.post("/api/v1/compute/nsr", json=sample_nsr_input)
        assert response.status_code == 200

        data = response.json()
        assert "nsr_per_tonne" in data
        assert "conc_price_total" in data
        assert data["nsr_per_tonne"] > 0

    def test_compute_returns_breakdown(self, client, sample_nsr_input):
        """Test that computation returns full breakdown."""
        response = client.post("/api/v1/compute/nsr", json=sample_nsr_input)
        data = response.json()

        # Check breakdown fields
        assert "conc_price_cu" in data
        assert "conc_price_au" in data
        assert "conc_price_ag" in data
        assert "nsr_cu" in data
        assert "nsr_au" in data
        assert "nsr_ag" in data
        assert "dilution_loss" in data
        assert "recovery_loss" in data

    def test_compute_with_missing_required_field(self, client):
        """Test computation fails with missing required field."""
        incomplete_input = {
            "mine": "Vermelhos UG",
            # Missing area and grades
        }
        response = client.post("/api/v1/compute/nsr", json=incomplete_input)
        assert response.status_code == 422

    def test_compute_with_invalid_grade(self, client, sample_nsr_input):
        """Test computation fails with invalid grade."""
        sample_nsr_input["cu_grade"] = -1.0  # Negative grade
        response = client.post("/api/v1/compute/nsr", json=sample_nsr_input)
        assert response.status_code == 422

    def test_compute_with_invalid_recovery(self, client, sample_nsr_input):
        """Test computation fails with invalid recovery."""
        sample_nsr_input["ore_recovery"] = 1.5  # >100%
        response = client.post("/api/v1/compute/nsr", json=sample_nsr_input)
        assert response.status_code == 422

    def test_compute_preserves_inputs(self, client, sample_nsr_input):
        """Test that inputs are preserved in response."""
        response = client.post("/api/v1/compute/nsr", json=sample_nsr_input)
        data = response.json()

        assert data["inputs_used"]["mine"] == sample_nsr_input["mine"]
        assert data["inputs_used"]["area"] == sample_nsr_input["area"]
        assert data["inputs_used"]["cu_grade"] == sample_nsr_input["cu_grade"]
