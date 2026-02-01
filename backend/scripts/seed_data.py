"""Seed data script for initial database population."""

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Seed data for Caraíba mine
# Commercial terms shared across all Caraíba mines
CARAIBA_COMMERCIAL_TERMS = {
    "cu_discount": 0.0335,
    "cu_payability": 0.9665,
    "cu_tc": 40.0,
    "cu_rc": 1.90,
    "cu_freight": 84.0,
    "cu_conc_grade": 33.5,
    "au_payability": 0.90,
    "au_rc": 4.00,
    "ag_payability": 0.90,
    "ag_rc": 0.35,
    "cfem_rate": 0.02,
    "mine_dilution": 0.14,
    "ore_recovery": 0.98,
}

# Coordinates for Caraíba complex (Vale do Curaçá, Bahia)
# Central coordinates: approximately -9.45, -39.85
CARAIBA_LAT = -9.45
CARAIBA_LON = -39.85

SEED_DATA = {
    "regions": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "name": "Vermelhos",
            "country": "Brazil",
            "state": "Bahia",
            "municipality": "Jaguarari",
            "latitude": -9.4520,
            "longitude": -39.8480,
            "description": "Depósito Vermelhos - Complexo Caraíba, Vale do Curaçá",
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "name": "Pilar",
            "country": "Brazil",
            "state": "Bahia",
            "municipality": "Jaguarari",
            "latitude": -9.4580,
            "longitude": -39.8520,
            "description": "Depósito Pilar - Complexo Caraíba, Vale do Curaçá",
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "name": "Surubim",
            "country": "Brazil",
            "state": "Bahia",
            "municipality": "Jaguarari",
            "latitude": -9.4450,
            "longitude": -39.8600,
            "description": "Depósito Surubim - Complexo Caraíba, Vale do Curaçá",
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440004",
            "name": "C12",
            "country": "Brazil",
            "state": "Bahia",
            "municipality": "Jaguarari",
            "latitude": -9.4400,
            "longitude": -39.8550,
            "description": "Depósito C12 - Complexo Caraíba, Vale do Curaçá",
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440005",
            "name": "Suçuarana",
            "country": "Brazil",
            "state": "Bahia",
            "municipality": "Jaguarari",
            "latitude": -9.4650,
            "longitude": -39.8700,
            "description": "Depósito Suçuarana - Complexo Caraíba, Vale do Curaçá",
        },
    ],
    "mines": [
        # =====================================================================
        # Vermelhos (region_id: 001)
        # =====================================================================
        {
            "id": "550e8400-e29b-41d4-a716-446655440010",
            "name": "Vermelhos Sul",
            "region_id": "550e8400-e29b-41d4-a716-446655440001",  # Vermelhos
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 2.8286, "b": 92.584, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440011",
            "name": "UG03",
            "region_id": "550e8400-e29b-41d4-a716-446655440001",  # Vermelhos
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 2.8286, "b": 92.584, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440012",
            "name": "N5/UG04",
            "region_id": "550e8400-e29b-41d4-a716-446655440001",  # Vermelhos
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 2.8286, "b": 92.584, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440013",
            "name": "N8 - UG",
            "region_id": "550e8400-e29b-41d4-a716-446655440001",  # Vermelhos
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 2.8286, "b": 92.584, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440050",
            "name": "N8",
            "region_id": "550e8400-e29b-41d4-a716-446655440001",  # Vermelhos
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 2.8286, "b": 92.584, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440051",
            "name": "N9",
            "region_id": "550e8400-e29b-41d4-a716-446655440001",  # Vermelhos
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 2.8286, "b": 92.584, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        # =====================================================================
        # Pilar (region_id: 002)
        # =====================================================================
        {
            "id": "550e8400-e29b-41d4-a716-446655440020",
            "name": "Deepening Above - 965",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 4.0851, "b": 90.346, "fixed": 92.9},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440021",
            "name": "Deepening Below - 965",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 4.0851, "b": 90.346, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440022",
            "name": "MSBSUL",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 7.5986, "b": 85.494, "fixed": 90.0},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440023",
            "name": "P1P2NE",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 2.3826, "b": 91.442, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440024",
            "name": "P1P2W",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 8.8922, "b": 87.637, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440025",
            "name": "BARAUNA",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 4.0851, "b": 90.346, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440026",
            "name": "HONEYPOT",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 4.0851, "b": 90.346, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440027",
            "name": "R22UG",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 3.0368, "b": 91.539, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440028",
            "name": "MSBW",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 3.0368, "b": 91.539, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440029",
            "name": "GO2040",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 5.4967, "b": 88.751, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440030",
            "name": "PROJETO N-100",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 4.0851, "b": 90.346, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440031",
            "name": "EAST LIMB",
            "region_id": "550e8400-e29b-41d4-a716-446655440002",  # Pilar
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 0.0, "b": 91.0, "fixed": 91.0},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        # =====================================================================
        # Surubim (region_id: 003)
        # =====================================================================
        {
            "id": "550e8400-e29b-41d4-a716-446655440040",
            "name": "Surubim OP",
            "region_id": "550e8400-e29b-41d4-a716-446655440003",  # Surubim
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 4.0718, "b": 87.885, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        # =====================================================================
        # C12 (region_id: 004)
        # =====================================================================
        {
            "id": "550e8400-e29b-41d4-a716-446655440041",
            "name": "C12 OP",
            "region_id": "550e8400-e29b-41d4-a716-446655440004",  # C12
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 4.0718, "b": 87.885, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440042",
            "name": "C12 UG",
            "region_id": "550e8400-e29b-41d4-a716-446655440004",  # C12
            "primary_metal": "Cu",
            "mining_method": "UG",
            "recovery_params": {"a": 4.0718, "b": 87.885, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        # =====================================================================
        # Suçuarana (region_id: 005)
        # =====================================================================
        {
            "id": "550e8400-e29b-41d4-a716-446655440060",
            "name": "Suçuarana OP",
            "region_id": "550e8400-e29b-41d4-a716-446655440005",  # Suçuarana
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 4.0718, "b": 87.885, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440061",
            "name": "S10",
            "region_id": "550e8400-e29b-41d4-a716-446655440005",  # Suçuarana
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 4.0718, "b": 87.885, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440062",
            "name": "S5",
            "region_id": "550e8400-e29b-41d4-a716-446655440005",  # Suçuarana
            "primary_metal": "Cu",
            "mining_method": "OP",
            "recovery_params": {"a": 4.0718, "b": 87.885, "fixed": None},
            "commercial_terms": CARAIBA_COMMERCIAL_TERMS,
        },
    ],
}


async def seed_database(database_url: str):
    """Seed the database with initial data."""
    # Convert sync URL to async
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(database_url, echo=True)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Insert regions
        for region in SEED_DATA["regions"]:
            await session.execute(
                text("""
                    INSERT INTO regions (id, name, country, state, municipality, 
                                        latitude, longitude, description, created_at)
                    VALUES (:id, :name, :country, :state, :municipality,
                            :latitude, :longitude, :description, :created_at)
                    ON CONFLICT (name) DO NOTHING
                """),
                {
                    "id": uuid.UUID(region["id"]),
                    "name": region["name"],
                    "country": region["country"],
                    "state": region.get("state"),
                    "municipality": region.get("municipality"),
                    "latitude": region.get("latitude"),
                    "longitude": region.get("longitude"),
                    "description": region["description"],
                    "created_at": datetime.now(timezone.utc),
                }
            )
        
        # Insert mines
        for mine in SEED_DATA["mines"]:
            import json
            await session.execute(
                text("""
                    INSERT INTO mines (id, name, region_id, primary_metal, mining_method, 
                                       recovery_params, commercial_terms, created_at)
                    VALUES (:id, :name, :region_id, :primary_metal, :mining_method,
                            :recovery_params, :commercial_terms, :created_at)
                    ON CONFLICT DO NOTHING
                """),
                {
                    "id": uuid.UUID(mine["id"]),
                    "name": mine["name"],
                    "region_id": uuid.UUID(mine["region_id"]),
                    "primary_metal": mine["primary_metal"],
                    "mining_method": mine["mining_method"],
                    "recovery_params": json.dumps(mine["recovery_params"]),
                    "commercial_terms": json.dumps(mine["commercial_terms"]),
                    "created_at": datetime.now(timezone.utc),
                }
            )
        
        await session.commit()
        print("Seed data inserted successfully!")
    
    await engine.dispose()


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    database_url = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/nsr"
    )
    
    asyncio.run(seed_database(database_url))
