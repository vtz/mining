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
  mine_cost?: number;
  development_cost?: number;
  development_meters?: number;
  haul_cost?: number;
  plant_cost?: number;
  ga_cost?: number;
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
  
  // EBITDA (optional — populated when operational costs are provided)
  ebitda: {
    revenue: number;
    mine_cost_total: number;
    development_cost_total: number;
    haul_cost_total: number;
    plant_cost_total: number;
    ga_cost_total: number;
    total_costs: number;
    ebitda: number;
    ebitda_per_tonne: number;
    ebitda_margin: number;
  } | null;

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
  enabled_features: string[];
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

// ──────────────────────────────────────────────────────────
// Goal Seek
// ──────────────────────────────────────────────────────────

export interface GoalSeekRequest {
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
  cu_payability?: number;
  cu_tc?: number;
  cu_rc?: number;
  cu_freight?: number;
  target_variable: string;
  target_nsr: number;
}

export interface GoalSeekResponse {
  target_variable: string;
  target_variable_unit: string;
  target_nsr: number;
  threshold_value: number;
  current_value: number;
  current_nsr: number;
  delta_percent: number;
  is_currently_viable: boolean;
  converged: boolean;
  iterations: number;
  tolerance_achieved: number;
  bound_hit: string; // "lower", "upper", or ""
}

export interface GoalSeekVariable {
  name: string;
  direction: string;
  unit: string;
  lower_bound: number;
  upper_bound: number;
}

export async function computeGoalSeek(request: GoalSeekRequest): Promise<GoalSeekResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/compute/goal-seek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to compute Goal Seek');
  }

  return response.json();
}

export async function fetchGoalSeekVariables(): Promise<GoalSeekVariable[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/compute/goal-seek/variables`);
  if (!response.ok) throw new Error('Failed to fetch variables');
  const data = await response.json();
  return data.variables;
}

// ──────────────────────────────────────────────────────────
// Goal Seek Scenarios (CRUD)
// ──────────────────────────────────────────────────────────

export interface GoalSeekScenario {
  id: string;
  name: string;
  mine_id: string | null;
  base_inputs: Record<string, unknown>;
  target_variable: string;
  target_nsr: number;
  threshold_value: number;
  alert_enabled: boolean;
  alert_email: string | null;
  alert_frequency: string;
  alert_triggered_at: string | null;
  last_nsr_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScenarioCreateRequest {
  name: string;
  mine_id?: string;
  base_inputs: Record<string, unknown>;
  target_variable: string;
  target_nsr: number;
  threshold_value: number;
  alert_enabled?: boolean;
  alert_email?: string;
  alert_frequency?: string;
}

export interface NsrSnapshot {
  timestamp: string;
  nsr_per_tonne: number;
  nsr_cu: number;
  nsr_au: number;
  nsr_ag: number;
  cu_price: number;
  au_price: number;
  ag_price: number;
  cu_tc: number;
  cu_rc: number;
  cu_freight: number;
  is_viable: boolean;
}

export interface SnapshotHistoryResponse {
  scenario_id: string;
  target_nsr: number;
  snapshots: NsrSnapshot[];
  total: number;
}

export async function createGoalSeekScenario(request: ScenarioCreateRequest): Promise<GoalSeekScenario> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/goal-seek-scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create scenario');
  }
  return response.json();
}

export async function listGoalSeekScenarios(): Promise<GoalSeekScenario[]> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/goal-seek-scenarios`);
  if (!response.ok) throw new Error('Failed to list scenarios');
  const data = await response.json();
  return data.scenarios;
}

export async function deleteGoalSeekScenario(id: string): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/goal-seek-scenarios/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete scenario');
}

export async function updateScenarioAlert(
  id: string,
  update: { alert_enabled?: boolean; alert_email?: string; alert_frequency?: string }
): Promise<GoalSeekScenario> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/goal-seek-scenarios/${id}/alert`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error('Failed to update alert');
  return response.json();
}

export async function fetchScenarioHistory(
  id: string,
  from?: string,
  to?: string,
  limit?: number
): Promise<SnapshotHistoryResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/goal-seek-scenarios/${id}/history`);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  if (limit) url.searchParams.set('limit', limit.toString());

  const response = await authFetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch history');
  return response.json();
}

// ──────────────────────────────────────────────────────────
// Block Model
// ──────────────────────────────────────────────────────────

export interface BlockImportData {
  id: string;
  mine_id: string;
  mine_name: string;
  name: string;
  source_filename: string;
  column_mapping: Record<string, string>;
  block_count: number;
  created_at: string;
  created_by: string | null;
}

export interface BlockData {
  id: string;
  x: number;
  y: number;
  z: number;
  dx?: number;
  dy?: number;
  dz?: number;
  cu_grade: number;
  au_grade?: number;
  ag_grade?: number;
  density?: number;
  tonnage?: number;
  rock_type?: string;
  zone?: string;
  deswik_block_id?: string;
  nsr_per_tonne?: number;
  is_viable?: boolean;
  margin?: number;
}

export interface PreviewResponse {
  headers: string[];
  sample_rows: string[][];
  suggested_mapping: Record<string, string>;
  known_fields: string[];
}

export interface HeatmapBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  dx?: number;
  dy?: number;
  cu_grade: number;
  tonnage?: number;
  rock_type?: string;
  zone?: string;
  nsr_per_tonne: number;
  nsr_cu: number;
  nsr_au: number;
  nsr_ag: number;
  is_viable: boolean;
  margin: number;
}

export interface HeatmapResponse {
  import_id: string;
  z_level: number;
  snapshot_date: string;
  blocks: HeatmapBlock[];
  cutoff_cost: number;
}

export interface ViabilityTimelinePoint {
  snapshot_date: string;
  viable_tonnage: number;
  marginal_tonnage: number;
  inviable_tonnage: number;
  viable_blocks: number;
  marginal_blocks: number;
  inviable_blocks: number;
  avg_nsr: number;
  cu_price: number;
  au_price: number;
  ag_price: number;
}

export interface ViabilityTimelineResponse {
  import_id: string;
  points: ViabilityTimelinePoint[];
}

export interface BlockStats {
  import_id: string;
  snapshot_date?: string;
  total_blocks: number;
  viable_blocks: number;
  marginal_blocks: number;
  inviable_blocks: number;
  total_tonnage: number;
  viable_tonnage: number;
  marginal_tonnage: number;
  inviable_tonnage: number;
  avg_nsr: number;
  min_nsr: number;
  max_nsr: number;
  cutoff_cost: number;
}

export interface CalculateNsrRequest {
  cutoff_cost: number;
  cu_price?: number;
  au_price?: number;
  ag_price?: number;
}

// Block Model API functions

export async function uploadBlockPreview(file: File): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/upload/preview`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to upload preview');
  }
  return response.json();
}

export async function uploadBlocks(
  file: File,
  mineId: string,
  name: string,
  columnMapping: Record<string, string>,
): Promise<BlockImportData> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mine_id', mineId);
  formData.append('name', name);
  formData.append('column_mapping', JSON.stringify(columnMapping));
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to import blocks');
  }
  return response.json();
}

export async function listBlockImports(mineId?: string): Promise<{ imports: BlockImportData[]; total: number }> {
  const url = new URL(`${API_BASE_URL}/api/v1/blocks/imports`);
  if (mineId) url.searchParams.set('mine_id', mineId);
  const response = await authFetch(url.toString());
  if (!response.ok) throw new Error('Failed to list imports');
  return response.json();
}

export async function getBlockImport(importId: string): Promise<BlockImportData> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/imports/${importId}`);
  if (!response.ok) throw new Error('Failed to get import');
  return response.json();
}

export async function deleteBlockImport(importId: string): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/imports/${importId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete import');
}

export async function listBlocks(
  importId: string,
  params?: {
    zone?: string;
    rock_type?: string;
    cu_min?: number;
    cu_max?: number;
    viable_only?: boolean;
    snapshot_date?: string;
    page?: number;
    page_size?: number;
  },
): Promise<{ blocks: BlockData[]; total: number; page: number; page_size: number }> {
  const url = new URL(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/blocks`);
  if (params) {
    if (params.zone) url.searchParams.set('zone', params.zone);
    if (params.rock_type) url.searchParams.set('rock_type', params.rock_type);
    if (params.cu_min !== undefined) url.searchParams.set('cu_min', params.cu_min.toString());
    if (params.cu_max !== undefined) url.searchParams.set('cu_max', params.cu_max.toString());
    if (params.viable_only !== undefined) url.searchParams.set('viable_only', params.viable_only.toString());
    if (params.snapshot_date) url.searchParams.set('snapshot_date', params.snapshot_date);
    if (params.page) url.searchParams.set('page', params.page.toString());
    if (params.page_size) url.searchParams.set('page_size', params.page_size.toString());
  }
  const response = await authFetch(url.toString());
  if (!response.ok) throw new Error('Failed to list blocks');
  return response.json();
}

export async function listBlockLevels(importId: string): Promise<{ levels: number[]; count: number }> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/levels`);
  if (!response.ok) throw new Error('Failed to list levels');
  return response.json();
}

export async function calculateBlockNsr(
  importId: string,
  request: CalculateNsrRequest,
): Promise<Record<string, unknown>> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to calculate NSR');
  }
  return response.json();
}

export async function listBlockSnapshots(importId: string): Promise<{ snapshots: string[]; count: number }> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/snapshots`);
  if (!response.ok) throw new Error('Failed to list snapshots');
  return response.json();
}

export async function fetchHeatmapData(
  importId: string,
  z: number,
  snapshot?: string,
): Promise<HeatmapResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/heatmap`);
  url.searchParams.set('z', z.toString());
  if (snapshot) url.searchParams.set('snapshot', snapshot);
  const response = await authFetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch heatmap');
  return response.json();
}

export async function fetchBlockStats(
  importId: string,
  snapshot?: string,
): Promise<BlockStats> {
  const url = new URL(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/stats`);
  if (snapshot) url.searchParams.set('snapshot', snapshot);
  const response = await authFetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function fetchViabilityTimeline(importId: string): Promise<ViabilityTimelineResponse> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/viability-timeline`);
  if (!response.ok) throw new Error('Failed to fetch timeline');
  return response.json();
}

export async function exportBlocksCsv(importId: string, snapshot?: string): Promise<void> {
  const url = new URL(`${API_BASE_URL}/api/v1/blocks/imports/${importId}/export`);
  if (snapshot) url.searchParams.set('snapshot', snapshot);
  const response = await authFetch(url.toString());
  if (!response.ok) throw new Error('Failed to export CSV');
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `block_nsr_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}

// ──────────────────────────────────────────────────────────
// Feature Toggles
// ──────────────────────────────────────────────────────────

export interface FeatureCatalogItem {
  key: string;
  name: string;
  description: string;
  default_enabled: boolean;
  icon: string;
}

export interface MineFeatureStatus {
  feature_key: string;
  name: string;
  description: string;
  enabled: boolean;
  enabled_at: string | null;
  disabled_at: string | null;
  notes: string | null;
  is_default: boolean;
}

export async function fetchFeatureCatalog(): Promise<{ features: FeatureCatalogItem[] }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/features/catalog`);
  if (!response.ok) throw new Error('Failed to fetch feature catalog');
  return response.json();
}

export async function fetchMineFeatures(mineId: string): Promise<{ mine_id: string; features: MineFeatureStatus[] }> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/mines/${mineId}/features`);
  if (!response.ok) throw new Error('Failed to fetch mine features');
  return response.json();
}

export async function updateMineFeature(
  mineId: string,
  featureKey: string,
  enabled: boolean,
  notes?: string,
): Promise<{ feature_key: string; mine_id: string; enabled: boolean; notes: string | null }> {
  const response = await authFetch(`${API_BASE_URL}/api/v1/mines/${mineId}/features/${featureKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, notes }),
  });
  if (!response.ok) throw new Error('Failed to update feature');
  return response.json();
}
