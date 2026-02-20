"""CSV parser and block import service for Deswik block models."""

import csv
import io
import uuid
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block_model import BlockImport, Block

logger = logging.getLogger(__name__)

# ── Heuristic column mapping ─────────────────────────────────
# Maps common Deswik header names to our internal field names.
# All keys are uppercase for case-insensitive matching.
HEURISTIC_MAPPING: Dict[str, str] = {
    # Coordinates
    "XCENTRE": "x",
    "YCENTRE": "y",
    "ZCENTRE": "z",
    "XC": "x",
    "YC": "y",
    "ZC": "z",
    "XWORLD": "x",
    "YWORLD": "y",
    "ZWORLD": "z",
    "CENTROID_X": "x",
    "CENTROID_Y": "y",
    "CENTROID_Z": "z",
    "EAST": "x",
    "NORTH": "y",
    "RL": "z",
    "ELEVATION": "z",
    # Block dimensions
    "XINC": "dx",
    "YINC": "dy",
    "ZINC": "dz",
    "DX": "dx",
    "DY": "dy",
    "DZ": "dz",
    "XSIZE": "dx",
    "YSIZE": "dy",
    "ZSIZE": "dz",
    # Grades
    "CU": "cu_grade",
    "CU_PCT": "cu_grade",
    "CU%": "cu_grade",
    "CU_GRADE": "cu_grade",
    "COPPER": "cu_grade",
    "AU": "au_grade",
    "AU_GPT": "au_grade",
    "AU_GRADE": "au_grade",
    "GOLD": "au_grade",
    "AG": "ag_grade",
    "AG_GPT": "ag_grade",
    "AG_GRADE": "ag_grade",
    "SILVER": "ag_grade",
    # Physical
    "DENSITY": "density",
    "SG": "density",
    "SPECIFIC_GRAVITY": "density",
    "TONNES": "tonnage",
    "TONNAGE": "tonnage",
    "TONS": "tonnage",
    "WEIGHT": "tonnage",
    "VOLUME": "volume",  # not a direct field, but useful
    # Rock / zone
    "ROCKTYPE": "rock_type",
    "ROCK_TYPE": "rock_type",
    "ROCK": "rock_type",
    "LITH": "rock_type",
    "LITHOLOGY": "rock_type",
    "ZONE": "zone",
    "DOMAIN": "zone",
    "GEOLOGICAL_DOMAIN": "zone",
    # ID
    "BLOCK_ID": "deswik_block_id",
    "BLOCKID": "deswik_block_id",
    "ID": "deswik_block_id",
    "IJK": "deswik_block_id",
}

# Internal fields we recognize
KNOWN_FIELDS = {
    "x", "y", "z", "dx", "dy", "dz",
    "cu_grade", "au_grade", "ag_grade",
    "density", "tonnage",
    "rock_type", "zone",
    "deswik_block_id",
}

# Required fields (must be mapped)
REQUIRED_FIELDS = {"x", "y", "z", "cu_grade"}


def auto_detect_mapping(headers: List[str]) -> Dict[str, str]:
    """Suggest column mapping based on heuristics.

    Returns a dict of {csv_header: internal_field} for recognised columns.
    """
    mapping: Dict[str, str] = {}
    used_fields: set = set()

    for header in headers:
        key = header.strip().upper().replace(" ", "_")
        if key in HEURISTIC_MAPPING:
            field = HEURISTIC_MAPPING[key]
            if field not in used_fields:
                mapping[header] = field
                used_fields.add(field)

    return mapping


def validate_mapping(mapping: Dict[str, str]) -> List[str]:
    """Return list of error messages. Empty list = valid."""
    errors: List[str] = []
    mapped_fields = set(mapping.values())

    for req in REQUIRED_FIELDS:
        if req not in mapped_fields:
            errors.append(f"Required field '{req}' is not mapped to any CSV column.")

    # Check for unknown target fields
    for csv_col, field in mapping.items():
        if field not in KNOWN_FIELDS:
            errors.append(
                f"Column '{csv_col}' is mapped to unknown field '{field}'."
            )

    return errors


def parse_csv_preview(
    csv_content: str,
    max_rows: int = 5,
) -> Tuple[List[str], List[List[str]], Dict[str, str]]:
    """Parse first N rows of a CSV and suggest column mapping.

    Returns:
        (headers, sample_rows, suggested_mapping)
    """
    reader = csv.reader(io.StringIO(csv_content))
    headers = next(reader, [])
    headers = [h.strip() for h in headers]

    sample_rows: List[List[str]] = []
    for i, row in enumerate(reader):
        if i >= max_rows:
            break
        sample_rows.append(row)

    suggested = auto_detect_mapping(headers)
    return headers, sample_rows, suggested


async def import_blocks_from_csv(
    db: AsyncSession,
    csv_content: str,
    mine_id: uuid.UUID,
    name: str,
    source_filename: str,
    column_mapping: Dict[str, str],
    user_id: Optional[uuid.UUID] = None,
) -> BlockImport:
    """Parse CSV and bulk-insert blocks.

    Args:
        db: Database session
        csv_content: Full CSV text
        mine_id: Target mine UUID
        name: Human label (e.g. "LOM 2026 Q1")
        source_filename: Original file name
        column_mapping: {csv_header: internal_field}
        user_id: Who uploaded

    Returns:
        Created BlockImport with block_count populated
    """
    errors = validate_mapping(column_mapping)
    if errors:
        raise ValueError("; ".join(errors))

    # Invert mapping for lookup: internal_field -> csv_header
    field_to_col: Dict[str, str] = {v: k for k, v in column_mapping.items()}

    # Columns that will go to extra_attributes
    mapped_csv_cols = set(column_mapping.keys())

    reader = csv.DictReader(io.StringIO(csv_content))
    if reader.fieldnames is None:
        raise ValueError("CSV has no header row.")

    all_csv_cols = set(h.strip() for h in reader.fieldnames)
    extra_cols = all_csv_cols - mapped_csv_cols

    # Create import record
    block_import = BlockImport(
        id=uuid.uuid4(),
        mine_id=mine_id,
        name=name,
        source_filename=source_filename,
        column_mapping=column_mapping,
        block_count=0,
        created_by=user_id,
    )
    db.add(block_import)

    blocks: List[Block] = []
    row_num = 1  # 1-indexed (header is row 0)
    for row in reader:
        row_num += 1
        try:
            block = _row_to_block(
                row, field_to_col, extra_cols, block_import.id, row_num
            )
            blocks.append(block)
        except (ValueError, KeyError) as exc:
            logger.warning("Skipping row %d: %s", row_num, exc)
            continue

    if not blocks:
        raise ValueError("No valid blocks found in the CSV.")

    block_import.block_count = len(blocks)
    db.add_all(blocks)

    await db.flush()
    return block_import


def _row_to_block(
    row: Dict[str, str],
    field_to_col: Dict[str, str],
    extra_cols: set,
    import_id: uuid.UUID,
    row_num: int,
) -> Block:
    """Convert a single CSV row to a Block instance."""

    def get_float(field: str, required: bool = False) -> Optional[float]:
        col = field_to_col.get(field)
        if col is None:
            if required:
                raise ValueError(f"Row {row_num}: missing required field '{field}'")
            return None
        raw = row.get(col, "").strip()
        if not raw:
            if required:
                raise ValueError(f"Row {row_num}: empty value for required field '{field}'")
            return None
        return float(raw)

    def get_str(field: str) -> Optional[str]:
        col = field_to_col.get(field)
        if col is None:
            return None
        raw = row.get(col, "").strip()
        return raw if raw else None

    x = get_float("x", required=True)
    y = get_float("y", required=True)
    z = get_float("z", required=True)
    cu_grade = get_float("cu_grade", required=True)

    # Collect extra attributes
    extras: Dict[str, Any] = {}
    for col in extra_cols:
        val = row.get(col, "").strip()
        if val:
            extras[col] = val

    return Block(
        id=uuid.uuid4(),
        import_id=import_id,
        x=x,  # type: ignore[arg-type]
        y=y,  # type: ignore[arg-type]
        z=z,  # type: ignore[arg-type]
        dx=get_float("dx"),
        dy=get_float("dy"),
        dz=get_float("dz"),
        cu_grade=cu_grade,  # type: ignore[arg-type]
        au_grade=get_float("au_grade"),
        ag_grade=get_float("ag_grade"),
        density=get_float("density"),
        tonnage=get_float("tonnage"),
        rock_type=get_str("rock_type"),
        zone=get_str("zone"),
        deswik_block_id=get_str("deswik_block_id"),
        extra_attributes=extras if extras else None,
    )
