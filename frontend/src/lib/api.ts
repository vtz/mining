/**
 * API client for NSR Calculator backend
 */

import { authFetch, getAccessToken } from './auth';

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
    extra?: Record<string, unknown>;
  };
}

export interface PriceProvider {
  name: string;
  display_name: string;
  description: string;
  requires_api_key: boolean;
  is_available: boolean;
  is_default: boolean;
}

export interface ProvidersResponse {
  providers: PriceProvider[];
  count: number;
}

export async function fetchMetalPrices(
  provider?: string,
  refresh: boolean = false
): Promise<MetalPricesResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/prices`);
  if (provider) {
    url.searchParams.set('provider', provider);
  }
  if (refresh) {
    url.searchParams.set('refresh', 'true');
  }
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error('Failed to fetch metal prices');
  }
  
  return response.json();
}

export async function fetchPriceProviders(): Promise<ProvidersResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/prices/providers`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch price providers');
  }
  
  return response.json();
}

export async function setManualPrices(
  cuPrice: number,
  auPrice: number,
  agPrice: number,
  note?: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/prices/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cu_price: cuPrice,
      au_price: auPrice,
      ag_price: agPrice,
      note: note || '',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to set manual prices');
  }
}

export async function setDefaultProvider(providerName: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/prices/providers/${providerName}/default`,
    { method: 'POST' }
  );
  
  if (!response.ok) {
    throw new Error('Failed to set default provider');
  }
}

// Scenarios
export interface ScenarioResult {
  name: string;
  variation: number;
  cu_price: number;
  au_price: number;
  ag_price: number;
  result: NSRResult;
}

export interface ScenariosResponse {
  base: NSRResult;
  scenarios: ScenarioResult[];
}

export async function computeScenarios(
  input: NSRInput, 
  variation: number = 10
): Promise<ScenariosResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/compute/scenarios`);
  url.searchParams.set('variation', variation.toString());
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to compute scenarios');
  }

  return response.json();
}

// Export CSV
export async function exportResultCSV(result: NSRResult & NSRInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/export/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    throw new Error('Failed to export CSV');
  }

  // Download the file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nsr_result_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Mine and area data - fallback for when API is unavailable
export const MINES_DATA_FALLBACK: Record<string, string[]> = {
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
};

// Re-export for backwards compatibility during transition
export const MINES_DATA = MINES_DATA_FALLBACK;

export type MineName = string;

// Region types
export interface Region {
  id: string;
  name: string;
  country: string;
  state: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  mine_count: number;
}

export interface RegionListResponse {
  regions: Region[];
  total: number;
}

// Mine types
export interface Mine {
  id: string;
  name: string;
  region_id: string;
  region_name: string;
  primary_metal: string;
  mining_method: string;
  recovery_params: Record<string, unknown> | null;
  commercial_terms: Record<string, unknown> | null;
  user_role: string | null;
}

export interface MineListResponse {
  mines: Mine[];
  total: number;
}

// Fetch regions from API
export async function fetchRegions(): Promise<RegionListResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await authFetch(`${API_BASE_URL}/api/v1/regions`);

  if (!response.ok) {
    throw new Error('Failed to fetch regions');
  }

  return response.json();
}

// Fetch mines from API
export async function fetchMines(regionId?: string): Promise<MineListResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const url = new URL(`${API_BASE_URL}/api/v1/mines`);
  if (regionId) {
    url.searchParams.set('region_id', regionId);
  }

  const response = await authFetch(url.toString());

  if (!response.ok) {
    throw new Error('Failed to fetch mines');
  }

  return response.json();
}

// Build mines data structure from API response
export function buildMinesData(mines: Mine[]): Record<string, string[]> {
  const minesData: Record<string, string[]> = {};
  
  for (const mine of mines) {
    // Extract areas from recovery_params if available
    let areas: string[] = [];
    
    if (mine.recovery_params && typeof mine.recovery_params === 'object') {
      const recoveryAreas = mine.recovery_params.areas;
      if (recoveryAreas && typeof recoveryAreas === 'object') {
        areas = Object.keys(recoveryAreas);
      }
    }
    
    // Use extracted areas if available, otherwise use region name as default area
    minesData[mine.name] = areas.length > 0 
      ? areas 
      : [mine.region_name];
  }
  
  return minesData;
}
