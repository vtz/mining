/**
 * API client for NSR Calculator backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface NSRInput {
  mine: string;
  area: string;
  cu_grade: number;
  au_grade: number;
  ag_grade: number;
  ore_tonnage?: number;
  mine_dilution?: number;
  ore_recovery?: number;
  cu_price?: number;
  au_price?: number;
  ag_price?: number;
}

export interface NSRResult {
  // Concentrate prices
  conc_price_cu: number;
  conc_price_au: number;
  conc_price_ag: number;
  conc_price_total: number;
  
  // NSR by metal
  nsr_cu: number;
  nsr_au: number;
  nsr_ag: number;
  
  // NSR levels
  nsr_mineral_resources: number;
  nsr_processing: number;
  nsr_mine: number;
  nsr_per_tonne: number;
  
  // Losses
  dilution_loss: number;
  recovery_loss: number;
  
  // Ratios
  conc_ratio: number;
  cu_recovery: number;
  au_recovery: number;
  ag_recovery: number;
  
  // Revenue
  revenue_total: number;
  
  // Metadata
  currency: string;
  ore_tonnage: number;
  inputs_used: Record<string, unknown>;
}

export async function computeNSR(input: NSRInput): Promise<NSRResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/compute/nsr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to compute NSR');
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

export interface MetalPrice {
  value: number;
  unit: string;
  name: string;
}

export interface MetalPricesResponse {
  prices: {
    cu: MetalPrice;
    au: MetalPrice;
    ag: MetalPrice;
  };
  metadata: {
    source: string;
    timestamp: number;
    is_live: boolean;
  };
}

export async function fetchMetalPrices(refresh: boolean = false): Promise<MetalPricesResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/prices`);
  if (refresh) {
    url.searchParams.set('refresh', 'true');
  }
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error('Failed to fetch metal prices');
  }
  
  return response.json();
}

// Mine and area data (from Caraíba)
export const MINES_DATA = {
  'Vermelhos UG': ['Vermelhos Sul', 'UG03', 'N5/UG04', 'N8 - UG'],
  'Pilar UG': [
    'Deepening Above - 965',
    'Deepening Below - 965',
    'MSBSUL',
    'P1P2NE',
    'P1P2W',
    'BARAUNA',
    'HONEYPOT',
    'R22UG',
    'MSBW',
    'GO2040',
    'PROJETO N-100',
    'EAST LIMB',
  ],
  'Surubim & C12': ['Surubim OP', 'C12 OP', 'C12 UG'],
  'Vermelhos OP': ['N8', 'N9'],
  'Suçuarana OP': ['Suçuarana OP', 'S10', 'S5'],
} as const;

export type MineName = keyof typeof MINES_DATA;
