'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { authFetch } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Region {
  id: string;
  name: string;
  country: string;
  description: string | null;
  mine_count: number;
}

export default function RegionsPage() {
  const t = useTranslations();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', country: 'Brazil', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/regions`);
      if (!response.ok) throw new Error('Failed to fetch regions');
      const data = await response.json();
      setRegions(data.regions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching regions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId 
        ? `${API_BASE_URL}/api/v1/regions/${editingId}`
        : `${API_BASE_URL}/api/v1/regions`;
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) throw new Error('Failed to save region');
      
      setShowForm(false);
      setFormData({ name: '', country: 'Brazil', description: '' });
      setEditingId(null);
      fetchRegions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving region');
    }
  };

  const handleEdit = (region: Region) => {
    setFormData({
      name: region.name,
      country: region.country,
      description: region.description || '',
    });
    setEditingId(region.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.regions.confirmDelete'))) return;
    
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/regions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete region');
      fetchRegions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting region');
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
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.regions.title')}</h1>
          <p className="text-gray-600">{t('admin.regions.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ name: '', country: 'Brazil', description: '' });
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          {t('admin.regions.newRegion')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? t('admin.regions.editRegion') : t('admin.regions.newRegion')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.regions.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.regions.country')}</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('admin.regions.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
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
                {t('admin.regions.name')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.regions.country')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.regions.mines')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {regions.map((region) => (
              <tr key={region.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{region.name}</div>
                  {region.description && (
                    <div className="text-sm text-gray-500">{region.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {region.country}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {region.mine_count} {region.mine_count === 1 ? 'mine' : 'mines'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleEdit(region)}
                    className="text-purple-600 hover:text-purple-900 mr-4"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(region.id)}
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
