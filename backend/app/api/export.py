"""Export endpoints for NSR results."""

import csv
import io
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/export", tags=["export"])


class ExportNSRRequest(BaseModel):
    """Request for exporting NSR results to CSV."""
    
    # Input parameters
    mine: str
    area: str
    cu_grade: float
    au_grade: float
    ag_grade: float
    ore_tonnage: float
    mine_dilution: float
    ore_recovery: float
    
    # Prices used
    cu_price: float
    au_price: float
    ag_price: float
    
    # Results
    conc_price_cu: float
    conc_price_au: float
    conc_price_ag: float
    conc_price_total: float
    
    nsr_cu: float
    nsr_au: float
    nsr_ag: float
    nsr_per_tonne: float
    
    nsr_mineral_resources: float
    nsr_processing: float
    nsr_mine: float
    
    dilution_loss: float
    recovery_loss: float
    
    cu_recovery: float
    au_recovery: float
    ag_recovery: float
    conc_ratio: float
    
    revenue_total: float


class ScenarioData(BaseModel):
    """Data for a single scenario in comparison export."""
    name: str
    variation: float
    nsr_per_tonne: float
    nsr_cu: float
    nsr_au: float
    nsr_ag: float
    cu_price: float
    au_price: float
    ag_price: float


class ExportScenariosRequest(BaseModel):
    """Request for exporting scenario comparison to CSV."""
    base_inputs: ExportNSRRequest
    scenarios: List[ScenarioData]


@router.post("/csv")
async def export_nsr_csv(request: ExportNSRRequest):
    """
    Export NSR calculation results to CSV.
    
    Returns a downloadable CSV file with all inputs and outputs.
    """
    output = io.StringIO()
    
    # Write header comments
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    output.write(f"# NSR Calculation Export\n")
    output.write(f"# Generated: {timestamp}\n")
    output.write(f"# Mine: {request.mine}\n")
    output.write(f"# Area: {request.area}\n")
    output.write(f"#\n")
    
    writer = csv.writer(output)
    
    # Inputs section
    writer.writerow(["INPUTS", "", ""])
    writer.writerow(["Parameter", "Value", "Unit"])
    writer.writerow(["Mine", request.mine, ""])
    writer.writerow(["Area", request.area, ""])
    writer.writerow(["Ore Tonnage", request.ore_tonnage, "t"])
    writer.writerow(["Cu Grade", request.cu_grade, "%"])
    writer.writerow(["Au Grade", request.au_grade, "g/t"])
    writer.writerow(["Ag Grade", request.ag_grade, "g/t"])
    writer.writerow(["Mine Dilution", request.mine_dilution * 100, "%"])
    writer.writerow(["Ore Recovery", request.ore_recovery * 100, "%"])
    writer.writerow([])
    
    # Prices section
    writer.writerow(["PRICES", "", ""])
    writer.writerow(["Metal", "Price", "Unit"])
    writer.writerow(["Cu", request.cu_price, "$/lb"])
    writer.writerow(["Au", request.au_price, "$/oz"])
    writer.writerow(["Ag", request.ag_price, "$/oz"])
    writer.writerow([])
    
    # Technical parameters
    writer.writerow(["TECHNICAL PARAMETERS", "", ""])
    writer.writerow(["Parameter", "Value", "Unit"])
    writer.writerow(["Cu Recovery", round(request.cu_recovery * 100, 2), "%"])
    writer.writerow(["Au Recovery", round(request.au_recovery * 100, 2), "%"])
    writer.writerow(["Ag Recovery", round(request.ag_recovery * 100, 2), "%"])
    writer.writerow(["Concentrate Ratio", round(request.conc_ratio, 4), "t conc/t ore"])
    writer.writerow([])
    
    # Concentrate prices
    writer.writerow(["CONCENTRATE PRICES", "", ""])
    writer.writerow(["Metal", "Price", "Unit"])
    writer.writerow(["Cu Contribution", round(request.conc_price_cu, 2), "$/t conc"])
    writer.writerow(["Au Contribution", round(request.conc_price_au, 2), "$/t conc"])
    writer.writerow(["Ag Contribution", round(request.conc_price_ag, 2), "$/t conc"])
    writer.writerow(["Total", round(request.conc_price_total, 2), "$/t conc"])
    writer.writerow([])
    
    # NSR by metal
    writer.writerow(["NSR BY METAL", "", ""])
    writer.writerow(["Metal", "Value", "Unit"])
    writer.writerow(["Cu", round(request.nsr_cu, 2), "$/t ore"])
    writer.writerow(["Au", round(request.nsr_au, 2), "$/t ore"])
    writer.writerow(["Ag", round(request.nsr_ag, 2), "$/t ore"])
    writer.writerow(["Total", round(request.nsr_per_tonne, 2), "$/t ore"])
    writer.writerow([])
    
    # NSR cascade
    writer.writerow(["NSR CASCADE", "", ""])
    writer.writerow(["Level", "Value", "Unit"])
    writer.writerow(["Mineral Resources", round(request.nsr_mineral_resources, 2), "$/t ore"])
    writer.writerow(["Mine (after dilution)", round(request.nsr_mine, 2), "$/t ore"])
    writer.writerow(["Processing (after recovery)", round(request.nsr_processing, 2), "$/t ore"])
    writer.writerow(["Final NSR", round(request.nsr_per_tonne, 2), "$/t ore"])
    writer.writerow([])
    
    # Losses
    writer.writerow(["LOSSES", "", ""])
    writer.writerow(["Type", "Value", "Unit"])
    writer.writerow(["Dilution Loss", round(request.dilution_loss, 2), "$/t ore"])
    writer.writerow(["Recovery Loss", round(request.recovery_loss, 2), "$/t ore"])
    writer.writerow([])
    
    # Total revenue
    writer.writerow(["SUMMARY", "", ""])
    writer.writerow(["Item", "Value", "Unit"])
    writer.writerow(["Total Revenue", round(request.revenue_total, 2), "USD"])
    writer.writerow(["NSR per Tonne", round(request.nsr_per_tonne, 2), "$/t ore"])
    
    # Generate filename
    filename = f"nsr_result_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/scenarios/csv")
async def export_scenarios_csv(request: ExportScenariosRequest):
    """
    Export scenario comparison to CSV.
    
    Returns a downloadable CSV file with base case and all scenarios.
    """
    output = io.StringIO()
    
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    output.write(f"# NSR Scenario Comparison Export\n")
    output.write(f"# Generated: {timestamp}\n")
    output.write(f"# Mine: {request.base_inputs.mine}\n")
    output.write(f"# Area: {request.base_inputs.area}\n")
    output.write(f"#\n")
    
    writer = csv.writer(output)
    
    # Scenario comparison table
    headers = ["Metric", "Unit"] + [s.name for s in request.scenarios]
    writer.writerow(headers)
    
    # Price variation
    writer.writerow(
        ["Price Variation", "%"] + 
        [f"{s.variation:+.1f}%" for s in request.scenarios]
    )
    
    # Cu Price
    writer.writerow(
        ["Cu Price", "$/lb"] + 
        [round(s.cu_price, 2) for s in request.scenarios]
    )
    
    # Au Price
    writer.writerow(
        ["Au Price", "$/oz"] + 
        [round(s.au_price, 2) for s in request.scenarios]
    )
    
    # Ag Price
    writer.writerow(
        ["Ag Price", "$/oz"] + 
        [round(s.ag_price, 2) for s in request.scenarios]
    )
    
    writer.writerow([])
    
    # NSR by metal
    writer.writerow(
        ["NSR Cu", "$/t ore"] + 
        [round(s.nsr_cu, 2) for s in request.scenarios]
    )
    writer.writerow(
        ["NSR Au", "$/t ore"] + 
        [round(s.nsr_au, 2) for s in request.scenarios]
    )
    writer.writerow(
        ["NSR Ag", "$/t ore"] + 
        [round(s.nsr_ag, 2) for s in request.scenarios]
    )
    
    writer.writerow([])
    
    # Total NSR
    writer.writerow(
        ["NSR Total", "$/t ore"] + 
        [round(s.nsr_per_tonne, 2) for s in request.scenarios]
    )
    
    # Delta vs base
    base_nsr = request.scenarios[1].nsr_per_tonne if len(request.scenarios) > 1 else request.scenarios[0].nsr_per_tonne
    writer.writerow(
        ["Δ vs Base", "%"] + 
        [f"{((s.nsr_per_tonne - base_nsr) / base_nsr * 100):+.1f}%" if base_nsr != 0 else "N/A" 
         for s in request.scenarios]
    )
    
    filename = f"nsr_scenarios_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
