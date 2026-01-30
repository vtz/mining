"""Unit tests for NSR calculation functions."""

import pytest
from app.nsr_engine.calculations import (
    compute_cu_recovery,
    compute_payable_metal,
    compute_conc_ratio,
    compute_conc_price_cu,
    compute_conc_price_au,
    compute_conc_price_ag,
    compute_nsr_complete,
)
from app.nsr_engine.models import NSRInput


class TestComputeCuRecovery:
    """Tests for compute_cu_recovery function."""

    def test_vermelhos_sul_recovery(self):
        """Test recovery calculation for Vermelhos Sul area."""
        # Recovery = 2.8286 × 1.4 + 92.584 = 96.544%
        recovery = compute_cu_recovery(1.4, "Vermelhos Sul")
        assert recovery == pytest.approx(0.9654, rel=0.001)

    def test_fixed_recovery_area(self):
        """Test area with fixed recovery value."""
        # Deepening Above - 965 has fixed = 92.9%
        recovery = compute_cu_recovery(1.4, "Deepening Above - 965")
        assert recovery == pytest.approx(0.929, rel=0.001)

    def test_unknown_area_uses_default(self):
        """Test that unknown area uses default parameters."""
        recovery = compute_cu_recovery(1.4, "Unknown Area")
        # Default: a=3.0, b=90.0 -> 3.0 × 1.4 + 90.0 = 94.2%
        assert recovery == pytest.approx(0.942, rel=0.01)

    def test_recovery_capped_at_100(self):
        """Test that recovery is capped at 100%."""
        # Very high grade would give >100% with some formulas
        recovery = compute_cu_recovery(10.0, "P1P2W")
        # 8.8922 × 10 + 87.637 = 176.56% -> capped to 100%
        assert recovery == 1.0

    def test_zero_grade(self):
        """Test recovery with zero grade."""
        recovery = compute_cu_recovery(0.0, "Vermelhos Sul")
        # 2.8286 × 0 + 92.584 = 92.584%
        assert recovery == pytest.approx(0.92584, rel=0.001)


class TestComputePayableMetal:
    """Tests for compute_payable_metal function."""

    def test_basic_calculation(self):
        """Test basic payable metal calculation."""
        result = compute_payable_metal(
            tonnage=1000,
            grade=1.4,  # %
            grade_unit="%",
            recovery=0.92,
            payability=0.965,
        )
        # 1000 × 0.014 × 0.92 × 0.965 = 12.4292
        assert result == pytest.approx(12.4292, rel=0.001)

    def test_gpt_unit(self):
        """Test calculation with g/t unit."""
        result = compute_payable_metal(
            tonnage=1000,
            grade=0.23,  # g/t
            grade_unit="g/t",
            recovery=0.90,
            payability=0.90,
        )
        # Very small number for g/t
        assert result > 0
        assert result < 1  # Should be tiny fraction

    def test_negative_tonnage_raises(self):
        """Test that negative tonnage raises ValueError."""
        with pytest.raises(ValueError, match="tonnage must be positive"):
            compute_payable_metal(
                tonnage=-1000,
                grade=1.4,
                grade_unit="%",
                recovery=0.92,
                payability=0.965,
            )

    def test_recovery_above_one_raises(self):
        """Test that recovery > 1 raises ValueError."""
        with pytest.raises(ValueError, match="recovery must be between"):
            compute_payable_metal(
                tonnage=1000,
                grade=1.4,
                grade_unit="%",
                recovery=1.5,
                payability=0.965,
            )

    def test_invalid_grade_unit_raises(self):
        """Test that invalid grade unit raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported grade unit"):
            compute_payable_metal(
                tonnage=1000,
                grade=1.4,
                grade_unit="invalid",
                recovery=0.92,
                payability=0.965,
            )


class TestComputeConcRatio:
    """Tests for compute_conc_ratio function."""

    def test_basic_calculation(self):
        """Test basic concentrate ratio calculation."""
        ratio = compute_conc_ratio(
            cu_grade_pct=1.4,
            cu_recovery=0.9654,
            cu_conc_grade_pct=28.0,
        )
        # (1.4/100 × 0.9654) / (28/100) = 0.0482
        assert ratio == pytest.approx(0.0482, rel=0.01)


class TestComputeConcPriceCu:
    """Tests for compute_conc_price_cu function."""

    def test_basic_calculation(self):
        """Test copper concentrate price calculation."""
        price = compute_conc_price_cu(
            cu_price_per_lb=4.15,
            cu_conc_grade_pct=28.0,
            payability=0.9665,
            tc=40.0,
            rc=1.90,
            freight=84.0,
            penalties=0.0,
        )
        # Should be positive (revenue > deductions)
        assert price > 0
        # For Cu at $4.15/lb, 28% conc grade: expect ~$1000-1500 range
        # Formula: (4.15 * 0.28 * 0.9665 * 2204.62) - 40 - (1.90 * 0.28 * 2204.62) - 84
        #        = 2472.4 - 40 - 1172.9 - 84 = ~$1175
        assert 1000 < price < 1500


class TestComputeNSRComplete:
    """Tests for complete NSR calculation."""

    def test_vermelhos_sul_case(self):
        """Test full calculation for Vermelhos Sul (golden test case)."""
        inputs = NSRInput(
            mine="Vermelhos UG",
            area="Vermelhos Sul",
            cu_grade=1.4,
            au_grade=0.23,
            ag_grade=2.33,
            ore_tonnage=20000,
            mine_dilution=0.14,
            ore_recovery=0.98,
        )

        result = compute_nsr_complete(inputs)

        # Validate structure
        assert result.conc_price_total > 0
        assert result.nsr_per_tonne > 0
        assert result.cu_recovery > 0
        assert result.conc_ratio > 0

        # Validate relationships
        assert result.conc_price_total == pytest.approx(
            result.conc_price_cu + result.conc_price_au + result.conc_price_ag, rel=0.01
        )
        assert result.nsr_per_tonne == pytest.approx(
            result.nsr_cu + result.nsr_au + result.nsr_ag, rel=0.01
        )

        # Validate Cu is dominant
        assert result.nsr_cu > result.nsr_au
        assert result.nsr_cu > result.nsr_ag

    def test_result_has_all_fields(self):
        """Test that result contains all required fields."""
        inputs = NSRInput(
            mine="Vermelhos UG",
            area="Vermelhos Sul",
            cu_grade=1.4,
            au_grade=0.23,
            ag_grade=2.33,
        )

        result = compute_nsr_complete(inputs)

        # Check all required fields exist
        assert hasattr(result, "conc_price_cu")
        assert hasattr(result, "conc_price_au")
        assert hasattr(result, "conc_price_ag")
        assert hasattr(result, "nsr_per_tonne")
        assert hasattr(result, "nsr_mineral_resources")
        assert hasattr(result, "dilution_loss")
        assert hasattr(result, "recovery_loss")
        assert hasattr(result, "inputs_used")

    def test_inputs_are_preserved(self):
        """Test that inputs are preserved in result."""
        inputs = NSRInput(
            mine="Vermelhos UG",
            area="Vermelhos Sul",
            cu_grade=1.4,
            au_grade=0.23,
            ag_grade=2.33,
        )

        result = compute_nsr_complete(inputs)

        assert result.inputs_used["mine"] == "Vermelhos UG"
        assert result.inputs_used["area"] == "Vermelhos Sul"
        assert result.inputs_used["cu_grade"] == 1.4
