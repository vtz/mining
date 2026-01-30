# Domain Model — NSR Calculator

## Overview

This document describes the domain model for the NSR (Net Smelter Return) Calculator, based on the Mina Caraíba methodology.

## Core Concepts

### NSR (Net Smelter Return)

The net value received from the sale of mineral concentrates after deducting:
- Treatment charges (TC)
- Refining charges (RC)
- Freight costs
- Penalties
- Other selling costs

**Unit:** $/t ore (US dollars per tonne of ore)

### Concentrate

The processed mineral product sold to smelters. Contains:
- Primary metal: Copper (Cu)
- By-products: Gold (Au), Silver (Ag)

**Unit:** $/t concentrate

## Entities

### Mine
Represents a mining operation (e.g., "Vermelhos UG", "Pilar UG").

### Area
Specific zone within a mine (e.g., "Vermelhos Sul", "MSBSUL").
Each area has its own metallurgical recovery parameters.

### Metal
Represents a payable metal with associated commercial terms.

| Metal | Code | Role | Price Unit |
|-------|------|------|------------|
| Copper | Cu | Primary | $/lb |
| Gold | Au | By-product | $/oz |
| Silver | Ag | By-product | $/oz |

### Commercial Terms

#### Payability
The percentage of contained metal that is payable.
- Cu: ~96.65%
- Au: ~90%
- Ag: ~90%

#### Treatment Charge (TC)
Fixed cost per tonne of concentrate for smelting.
- Unit: $/dmt concentrate

#### Refining Charge (RC)
Cost per unit of payable metal for refining.
- Cu: $/lb
- Au: $/oz
- Ag: $/oz

#### Freight
Transportation cost per tonne of concentrate.
- Unit: $/dmt concentrate

## Calculations

### Recovery Formula

Copper recovery is calculated per area using a linear formula:

```
Recovery (%) = a × Grade (%) + b
```

Where `a` and `b` are area-specific parameters.

### Concentrate Ratio

```
Conc Ratio = (Cu Grade × Cu Recovery) / Cu Conc Grade
```

### Concentrate Price

```
Conc Price Cu = (Cu Price × Cu Conc Grade × Payability × 2204.62) 
                - TC - (RC × Cu Conc Grade × 2204.62) - Freight - Penalties
```

### NSR per Tonne

```
NSR = Conc Price Total × Conc Ratio
```

With mine factors:
```
NSR Mine = NSR × (1 - Dilution) × Ore Recovery
```

## Reference

See `NSR_REQUIREMENTS.md` for complete formulas and validation cases.
