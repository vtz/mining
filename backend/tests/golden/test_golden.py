"""Golden tests - regression tests with known values."""

import pytest
import yaml
from pathlib import Path

from app.nsr_engine.calculations import compute_nsr_complete
from app.nsr_engine.models import NSRInput

GOLDEN_DIR = Path(__file__).parent / "cases"


def load_golden_cases():
    """Load all golden test cases from YAML files."""
    cases = []
    for file in GOLDEN_DIR.glob("*.yaml"):
        with open(file) as f:
            case = yaml.safe_load(f)
            case["file"] = file.name
            cases.append(case)
    return cases


@pytest.mark.parametrize("case", load_golden_cases(), ids=lambda c: c["name"])
def test_golden_case(case):
    """Test golden case against expected values."""
    # Build input
    inputs = NSRInput(**case["inputs"])

    # Compute result
    result = compute_nsr_complete(inputs)

    expected = case["expected"]

    # Validate Cu recovery (exact match)
    if "cu_recovery" in expected:
        assert result.cu_recovery == pytest.approx(
            expected["cu_recovery"], rel=0.01
        ), f"Cu recovery mismatch in {case['file']}"

    # Validate concentrate prices (range)
    if "conc_price_cu_min" in expected:
        assert expected["conc_price_cu_min"] <= result.conc_price_cu <= expected["conc_price_cu_max"], \
            f"Conc price Cu out of range in {case['file']}: {result.conc_price_cu}"

    if "conc_price_total_min" in expected:
        assert expected["conc_price_total_min"] <= result.conc_price_total <= expected["conc_price_total_max"], \
            f"Conc price total out of range in {case['file']}: {result.conc_price_total}"

    # Validate NSR per tonne (range)
    if "nsr_per_tonne_min" in expected:
        assert expected["nsr_per_tonne_min"] <= result.nsr_per_tonne <= expected["nsr_per_tonne_max"], \
            f"NSR per tonne out of range in {case['file']}: {result.nsr_per_tonne}"

    if "nsr_cu_min" in expected:
        assert expected["nsr_cu_min"] <= result.nsr_cu <= expected["nsr_cu_max"], \
            f"NSR Cu out of range in {case['file']}: {result.nsr_cu}"

    # Basic sanity checks
    assert result.nsr_per_tonne > 0, "NSR should be positive"
    assert result.conc_ratio > 0, "Concentrate ratio should be positive"
    assert result.cu_recovery > 0.8, "Cu recovery should be > 80%"
    assert result.cu_recovery <= 1.0, "Cu recovery should be <= 100%"
