'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { authFetch } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Mineral {
  id: string;
  code: string;
  name: string;
  price_unit: string;
  default_price: number;
  grade_unit: string;
  implemented: boolean;
}

const emptyForm = {
  code: '',
  name: '',
  price_unit: '$/lb',
  default_price: '',
  grade_unit: '%',
  implemented: false,
};

export default function MineralsPage() {
  const t = useTranslations();
  const [minerals, setMinerals] = useState<Mineral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadMinerals = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/minerals`);
      if (!response.ok) throw new Error('Failed to fetch minerals');
      const data = await response.json();
      setMinerals(data.minerals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching minerals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMinerals(); }, [loadMinerals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      code: formData.code,
      name: formData.name,
      price_unit: formData.price_unit,
      default_price: parseFloat(formData.default_price),
      grade_unit: formData.grade_unit,
      implemented: formData.implemented,
    };

    try {
      const url = editingId
        ? `${API_BASE_URL}/api/v1/minerals/${editingId}`
        : `${API_BASE_URL}/api/v1/minerals`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save mineral');
      }

      setShowForm(false);
      setFormData(emptyForm);
      setEditingId(null);
      loadMinerals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving mineral');
    }
  };

  const handleEdit = (mineral: Mineral) => {
    setFormData({
      code: mineral.code,
      name: mineral.name,
      price_unit: mineral.price_unit,
      default_price: String(mineral.default_price),
      grade_unit: mineral.grade_unit,
      implemented: mineral.implemented,
    });
    setEditingId(mineral.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.minerals.confirmDelete'))) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/minerals/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete mineral');
      loadMinerals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting mineral');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.minerals.title')}</h1>
          <p className="text-gray-600">{t('admin.minerals.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormData(emptyForm); }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          {t('admin.minerals.newMineral')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">x</button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? t('admin.minerals.editMineral') : t('admin.minerals.newMineral')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.minerals.code')}</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={t('admin.minerals.codePlaceholder')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.minerals.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('admin.minerals.namePlaceholder')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.minerals.priceUnit')}</label>
                <input
                  type="text"
                  value={formData.price_unit}
                  onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })}
                  placeholder={t('admin.minerals.priceUnitPlaceholder')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.minerals.defaultPrice')}</label>
                <input
                  type="number"
                  step="any"
                  value={formData.default_price}
                  onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.minerals.gradeUnit')}</label>
                <select
                  value={formData.grade_unit}
                  onChange={(e) => setFormData({ ...formData, grade_unit: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  <option value="%">%</option>
                  <option value="g/t">g/t</option>
                  <option value="ppm">ppm</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="implemented"
                checked={formData.implemented}
                onChange={(e) => setFormData({ ...formData, implemented: e.target.checked })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="implemented" className="text-sm font-medium text-gray-700">
                {t('admin.minerals.implemented')}
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.minerals.code')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.minerals.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.minerals.priceUnit')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.minerals.defaultPrice')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.minerals.gradeUnit')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.minerals.implemented')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {minerals.map((mineral) => (
              <tr key={mineral.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800">
                    {mineral.code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mineral.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mineral.price_unit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mineral.default_price}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mineral.grade_unit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 text-xs rounded-full ${mineral.implemented ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {mineral.implemented ? t('admin.minerals.yes') : t('admin.minerals.no')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button onClick={() => handleEdit(mineral)} className="text-purple-600 hover:text-purple-900 mr-4">
                    {t('common.edit')}
                  </button>
                  <button onClick={() => handleDelete(mineral.id)} className="text-red-600 hover:text-red-900">
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
