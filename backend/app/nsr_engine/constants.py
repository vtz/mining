"""Physical and commercial constants for NSR calculations."""

# =============================================================================
# Weight Conversions
# =============================================================================
LB_PER_KG = 2.20462
LB_PER_TONNE = 2204.62
KG_PER_TONNE = 1000
GRAM_PER_KG = 1000
GRAM_PER_TONNE = 1_000_000

# =============================================================================
# Troy Ounce Conversions
# =============================================================================
TROY_OZ_PER_GRAM = 0.0321507466
GRAM_PER_TROY_OZ = 31.1035

# =============================================================================
# Grade Unit Conversions
# =============================================================================
PCT_TO_FRACTION = 0.01
PPM_TO_FRACTION = 1e-6
GPT_TO_FRACTION = 1e-6  # g/t = ppm for mass basis

# =============================================================================
# Default Commercial Terms (Caraíba)
# =============================================================================

# Price Deck - COMEX Market Prices (January 2026)
# Source: COMEX Futures (comexlive.org), updated 2026-01-29
# Reference: Using COMEX as primary source for consistency with industry standards
DEFAULT_CU_PRICE_PER_LB = 6.28  # $/lb (COMEX Jan 2026)
DEFAULT_AU_PRICE_PER_OZ = 5360.0  # $/oz (COMEX Jan 2026)
DEFAULT_AG_PRICE_PER_OZ = 116.39  # $/oz (COMEX Jan 2026)

# Historical reference (Excel file used these older prices):
# Cu: ~$4.15/lb, Au: $2,400/oz, Ag: $29/oz

# Copper Terms
DEFAULT_CU_DISCOUNT = 0.0335  # 3.35%
DEFAULT_CU_PAYABILITY = 0.9665  # 96.65%
DEFAULT_CU_TC = 40.0  # $/dmt concentrate
DEFAULT_CU_RC = 1.90  # $/lb Cu payable
DEFAULT_CU_FREIGHT = 84.0  # $/dmt concentrate
DEFAULT_CU_PENALTIES = 0.0  # $/dmt concentrate
DEFAULT_CU_OTHER_COSTS = 0.0  # $/dmt concentrate
DEFAULT_CONC_LOSS_FACTOR = 0.0  # decimal

# Gold Terms (as Cu byproduct)
DEFAULT_AU_PAYABILITY = 0.90  # 90%
DEFAULT_AU_RC = 4.00  # $/oz Au payable

# Silver Terms (as Cu byproduct)
DEFAULT_AG_PAYABILITY = 0.90  # 90%
DEFAULT_AG_RC = 0.35  # $/oz Ag payable

# Concentrate Grade (Base Case from Excel)
DEFAULT_CU_CONC_GRADE = 33.5  # % Cu in concentrate (Base Case)

# Royalties
DEFAULT_CFEM_RATE = 0.02  # 2%
DEFAULT_THIRD_PARTY_ROYALTY = 0.0  # 0%

# =============================================================================
# Default Mine Factors
# =============================================================================
DEFAULT_MINE_DILUTION = 0.14  # 14%
DEFAULT_ORE_RECOVERY = 0.98  # 98%

# =============================================================================
# Recovery Parameters by Area (Caraíba)
# Format: {"a": slope, "b": intercept, "fixed": optional_fixed_value}
# Recovery (%) = a * Cu Grade (%) + b
# =============================================================================
RECOVERY_PARAMS = {
    # Vermelhos UG
    "Vermelhos Sul": {"a": 2.8286, "b": 92.584, "fixed": None},
    "UG03": {"a": 2.8286, "b": 92.584, "fixed": None},
    "N5/UG04": {"a": 2.8286, "b": 92.584, "fixed": None},
    "N8 - UG": {"a": 2.8286, "b": 92.584, "fixed": None},
    # Pilar UG
    "Deepening Above - 965": {"a": 4.0851, "b": 90.346, "fixed": 92.9},
    "Deepening Below - 965": {"a": 4.0851, "b": 90.346, "fixed": None},
    "MSBSUL": {"a": 7.5986, "b": 85.494, "fixed": 90.0},
    "P1P2NE": {"a": 2.3826, "b": 91.442, "fixed": None},
    "P1P2W": {"a": 8.8922, "b": 87.637, "fixed": None},
    "BARAUNA": {"a": 4.0851, "b": 90.346, "fixed": None},
    "HONEYPOT": {"a": 4.0851, "b": 90.346, "fixed": None},
    "R22UG": {"a": 3.0368, "b": 91.539, "fixed": None},
    "MSBW": {"a": 3.0368, "b": 91.539, "fixed": None},
    "GO2040": {"a": 5.4967, "b": 88.751, "fixed": None},
    "PROJETO N-100": {"a": 4.0851, "b": 90.346, "fixed": None},
    "EAST LIMB": {"a": 0.0, "b": 91.0, "fixed": 91.0},
    # Surubim & C12
    "Surubim OP": {"a": 4.0718, "b": 87.885, "fixed": None},
    "C12 OP": {"a": 4.0718, "b": 87.885, "fixed": None},
    "C12 UG": {"a": 4.0718, "b": 87.885, "fixed": None},
    # Vermelhos OP
    "N8": {"a": 2.8286, "b": 92.584, "fixed": None},
    "N9": {"a": 2.8286, "b": 92.584, "fixed": None},
    # Suçuarana OP
    "Suçuarana OP": {"a": 4.0718, "b": 87.885, "fixed": None},
    "S10": {"a": 4.0718, "b": 87.885, "fixed": None},
    "S5": {"a": 4.0718, "b": 87.885, "fixed": None},
}

# Default recovery if area not found
DEFAULT_RECOVERY_PARAMS = {"a": 3.0, "b": 90.0, "fixed": None}

# Default Au/Ag recovery (Base Case from Excel)
DEFAULT_AU_RECOVERY = 0.60  # 60% (Base Case)
DEFAULT_AG_RECOVERY = 0.60  # 60% (Base Case)

# =============================================================================
# Multi-Metal Support (Mocked for Phase 2)
# These are placeholder values for demonstration
# =============================================================================

# Metal configurations
SUPPORTED_METALS = {
    "Cu": {
        "name": "Copper",
        "price_unit": "$/lb",
        "default_price": DEFAULT_CU_PRICE_PER_LB,
        "implemented": True,
    },
    "Au": {
        "name": "Gold",
        "price_unit": "$/oz",
        "default_price": DEFAULT_AU_PRICE_PER_OZ,
        "implemented": False,  # Mocked
    },
    "Zn": {
        "name": "Zinc",
        "price_unit": "$/lb",
        "default_price": 1.35,  # Mocked price
        "implemented": False,
    },
    "Ni": {
        "name": "Nickel",
        "price_unit": "$/lb",
        "default_price": 8.50,  # Mocked price
        "implemented": False,
    },
    "Fe": {
        "name": "Iron",
        "price_unit": "$/t",
        "default_price": 120.0,  # Mocked price
        "implemented": False,
    },
}

# Mocked recovery parameters for non-Cu metals
# In reality, each metal would have its own recovery formula
MOCKED_RECOVERY = {
    "Au": {"default": 0.90},
    "Zn": {"default": 0.85},
    "Ni": {"default": 0.80},
    "Fe": {"default": 0.95},
}

# Mocked commercial terms for non-Cu metals
MOCKED_COMMERCIAL_TERMS = {
    "Au": {
        "payability": 0.95,
        "tc": 50.0,
        "rc": 5.0,
        "freight": 50.0,
        "conc_grade": 0.90,  # 90% Au in concentrate (unrealistic but for demo)
    },
    "Zn": {
        "payability": 0.85,
        "tc": 200.0,
        "rc": 0.0,
        "freight": 100.0,
        "conc_grade": 50.0,  # 50% Zn in concentrate
    },
    "Ni": {
        "payability": 0.75,
        "tc": 100.0,
        "rc": 0.0,
        "freight": 80.0,
        "conc_grade": 15.0,  # 15% Ni in concentrate
    },
    "Fe": {
        "payability": 1.0,  # No payability deduction for iron
        "tc": 0.0,
        "rc": 0.0,
        "freight": 30.0,
        "conc_grade": 65.0,  # 65% Fe in iron ore concentrate
    },
}
