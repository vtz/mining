'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { authFetch } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Mine {
  id: string;
  name: string;
  region_id: string;
  region_name: string;
  primary_metal: string;
  mining_method: string;
}

interface Region {
  id: string;
  name: string;
  country: string;
  state: string | null;
  municipality: string | null;
}

interface Metal {
  code: string;
  name: string;
  unit: string;
  implemented: boolean;
}

interface NewRegionData {
  name: string;
  country: string;
  state: string;
  municipality: string;
  latitude: string;
  longitude: string;
}

const emptyNewRegion: NewRegionData = {
  name: '',
  country: 'Brazil',
  state: 'Bahia',
  municipality: '',
  latitude: '',
  longitude: '',
};

export default function MinesPage() {
  const t = useTranslations();
  const [mines, setMines] = useState<Mine[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    region_id: '',
    primary_metal: 'Cu',
    mining_method: 'UG',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New region inline creation
  const [createNewRegion, setCreateNewRegion] = useState(false);
  const [newRegionData, setNewRegionData] = useState<NewRegionData>(emptyNewRegion);

  useEffect(() => {
    Promise.all([fetchMines(), fetchRegions(), fetchMetals()]);
  }, []);

  const fetchMines = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/mines`);
      if (!response.ok) throw new Error('Failed to fetch mines');
      const data = await response.json();
      setMines(data.mines);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching mines');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/regions`);
      if (!response.ok) throw new Error('Failed to fetch regions');
      const data = await response.json();
      setRegions(data.regions);
    } catch (err) {
      console.error('Error fetching regions:', err);
    }
  };

  const fetchMetals = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/mines/metals`);
      if (!response.ok) throw new Error('Failed to fetch metals');
      const data = await response.json();
      setMetals(data.metals);
    } catch (err) {
      console.error('Error fetching metals:', err);
    }
  };

  const createRegion = async (): Promise<string | null> => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/regions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRegionData.name,
          country: newRegionData.country,
          state: newRegionData.state || null,
          municipality: newRegionData.municipality || null,
          latitude: newRegionData.latitude ? parseFloat(newRegionData.latitude) : null,
          longitude: newRegionData.longitude ? parseFloat(newRegionData.longitude) : null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create region');
      }
      
      const region = await response.json();
      await fetchRegions(); // Refresh regions list
      return region.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating region');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    let regionId = formData.region_id;
    
    // If creating new region, create it first
    if (createNewRegion) {
      if (!newRegionData.name.trim()) {
        setError(t('admin.mines.regionRequired'));
        return;
      }
      const newRegionId = await createRegion();
      if (!newRegionId) return; // Error already set
      regionId = newRegionId;
    }
    
    if (!regionId) {
      setError(t('admin.mines.selectOrCreateRegion'));
      return;
    }
    
    try {
      const url = editingId 
        ? `${API_BASE_URL}/api/v1/mines/${editingId}`
        : `${API_BASE_URL}/api/v1/mines`;
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, region_id: regionId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save mine');
      }
      
      setShowForm(false);
      setFormData({ name: '', region_id: '', primary_metal: 'Cu', mining_method: 'UG' });
      setEditingId(null);
      setCreateNewRegion(false);
      setNewRegionData(emptyNewRegion);
      fetchMines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving mine');
    }
  };

  const handleEdit = (mine: Mine) => {
    setFormData({
      name: mine.name,
      region_id: mine.region_id,
      primary_metal: mine.primary_metal,
      mining_method: mine.mining_method,
    });
    setEditingId(mine.id);
    setCreateNewRegion(false);
    setNewRegionData(emptyNewRegion);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.mines.confirmDelete'))) return;
    
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/mines/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete mine');
      fetchMines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting mine');
    }
  };

  const handleRegionChange = (value: string) => {
    if (value === '__new__') {
      setCreateNewRegion(true);
      setFormData({ ...formData, region_id: '' });
    } else {
      setCreateNewRegion(false);
      setFormData({ ...formData, region_id: value });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.mines.title')}</h1>
          <p className="text-gray-600">{t('admin.mines.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ name: '', region_id: '', primary_metal: 'Cu', mining_method: 'UG' });
            setCreateNewRegion(false);
            setNewRegionData(emptyNewRegion);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          {t('admin.mines.newMine')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? t('admin.mines.editMine') : t('admin.mines.newMine')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.mineName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.regionComplex')}</label>
                <select
                  value={createNewRegion ? '__new__' : formData.region_id}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required={!createNewRegion}
                >
                  <option value="">{t('admin.mines.select')}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                  <option value="__new__">{t('admin.mines.createNewRegion')}</option>
                </select>
              </div>
            </div>

            {/* New Region Form */}
            {createNewRegion && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <h3 className="text-sm font-medium text-blue-800">{t('admin.mines.newRegionComplex')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('admin.mines.regionNameRequired')}</label>
                    <input
                      type="text"
                      value={newRegionData.name}
                      onChange={(e) => setNewRegionData({ ...newRegionData, name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('admin.regions.country')}</label>
                    <input
                      type="text"
                      value={newRegionData.country}
                      onChange={(e) => setNewRegionData({ ...newRegionData, country: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('admin.mines.state')}</label>
                    <input
                      type="text"
                      value={newRegionData.state}
                      onChange={(e) => setNewRegionData({ ...newRegionData, state: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('admin.mines.municipality')}</label>
                    <input
                      type="text"
                      value={newRegionData.municipality}
                      onChange={(e) => setNewRegionData({ ...newRegionData, municipality: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('admin.mines.latitude')}</label>
                    <input
                      type="text"
                      value={newRegionData.latitude}
                      onChange={(e) => setNewRegionData({ ...newRegionData, latitude: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                      placeholder="-9.45"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('admin.mines.longitude')}</label>
                    <input
                      type="text"
                      value={newRegionData.longitude}
                      onChange={(e) => setNewRegionData({ ...newRegionData, longitude: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                      placeholder="-39.85"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.primaryMetal')}</label>
                <select
                  value={formData.primary_metal}
                  onChange={(e) => setFormData({ ...formData, primary_metal: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  {metals.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name} ({m.code}) {!m.implemented && '- Mocked'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.miningMethod')}</label>
                <select
                  value={formData.mining_method}
                  onChange={(e) => setFormData({ ...formData, mining_method: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  <option value="UG">{t('admin.mines.underground')} (UG)</option>
                  <option value="OP">{t('admin.mines.openPit')} (OP)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {createNewRegion ? t('admin.mines.createRegionAndSave') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setCreateNewRegion(false);
                  setNewRegionData(emptyNewRegion);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.mines.name')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.mines.region')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.mines.metal')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.mines.method')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mines.map((mine) => (
              <tr key={mine.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{mine.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {mine.region_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    mine.primary_metal === 'Cu' ? 'bg-orange-100 text-orange-800' :
                    mine.primary_metal === 'Au' ? 'bg-yellow-100 text-yellow-800' :
                    mine.primary_metal === 'Fe' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {mine.primary_metal}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {mine.mining_method === 'UG' ? t('admin.mines.underground') : t('admin.mines.openPit')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleEdit(mine)}
                    className="text-purple-600 hover:text-purple-900 mr-4"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(mine.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
