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

# Price Deck - Mineral Resources (default)
DEFAULT_CU_PRICE_PER_LB = 4.15  # $/lb (9149 cents = $91.49? verificar)
DEFAULT_AU_PRICE_PER_OZ = 2400.0  # $/oz
DEFAULT_AG_PRICE_PER_OZ = 29.0  # $/oz

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

# Concentrate Grade
DEFAULT_CU_CONC_GRADE = 28.0  # % Cu in concentrate (estimate, needs verification)

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

# Default Au/Ag recovery (used when not area-specific)
DEFAULT_AU_RECOVERY = 0.90  # 90%
DEFAULT_AG_RECOVERY = 0.90  # 90%
