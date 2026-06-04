'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { authFetch } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Region { id: string; name: string; country: string; state: string | null; municipality: string | null; }
interface Mineral { id: string; code: string; name: string; price_unit: string; default_price: number; grade_unit: string; implemented: boolean; }
interface MineMineral { mineral_id: string; is_primary: boolean; recovery_rate: number | null; commercial_terms: Record<string, unknown> | null; }
interface ParamDef { id: string; key: string; name: string; description: string | null; category: string; data_type: string; unit: string | null; default_value: string | null; is_required: boolean; validation_rules: Record<string, number> | null; sort_order: number; }
interface UserEntry { user_id: string; email: string; name: string; role: string; }
interface Feature { feature_key: string; name: string; description: string; enabled: boolean; is_default: boolean; }
interface UserOption { id: string; email: string; name: string; }

const STEPS = ['basicInfo', 'selectMinerals', 'customParameters', 'assignUsers', 'enableFeatures', 'reviewCommission'] as const;

export default function CommissionPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mineId = searchParams.get('id');

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!!mineId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState({ name: '', region_id: '', mining_method: 'UG', primary_metal: 'Cu' });
  const [regions, setRegions] = useState<Region[]>([]);
  const [metals, setMetals] = useState<Mineral[]>([]);
  const [createdMineId, setCreatedMineId] = useState<string | null>(mineId);

  // Step 2: Minerals
  const [allMinerals, setAllMinerals] = useState<Mineral[]>([]);
  const [mineMinerals, setMineMinerals] = useState<MineMineral[]>([]);

  // Step 3: Parameters
  const [paramDefs, setParamDefs] = useState<ParamDef[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // Step 4: Users
  const [mineUsers, setMineUsers] = useState<UserEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [addUserRole, setAddUserRole] = useState('viewer');

  // Step 5: Features
  const [features, setFeatures] = useState<Feature[]>([]);

  const loadInitialData = useCallback(async () => {
    try {
      const [regRes, minRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/v1/regions`),
        authFetch(`${API_BASE_URL}/api/v1/minerals`),
      ]);
      if (regRes.ok) { const d = await regRes.json(); setRegions(d.regions); }
      if (minRes.ok) {
        const d = await minRes.json();
        setAllMinerals(d.minerals);
        setMetals(d.minerals);
      }

      const usersRes = await authFetch(`${API_BASE_URL}/api/v1/users`);
      if (usersRes.ok) { const d = await usersRes.json(); setAllUsers(d.users || d); }

      if (mineId) {
        const mineRes = await authFetch(`${API_BASE_URL}/api/v1/mines/${mineId}`);
        if (mineRes.ok) {
          const mine = await mineRes.json();
          setBasicInfo({ name: mine.name, region_id: mine.region_id, mining_method: mine.mining_method, primary_metal: mine.primary_metal });
        }

        const mmRes = await authFetch(`${API_BASE_URL}/api/v1/mines/${mineId}/minerals`);
        if (mmRes.ok) {
          const d = await mmRes.json();
          setMineMinerals(d.minerals.map((m: { mineral_id: string; is_primary: boolean; recovery_rate: number | null; commercial_terms: Record<string, unknown> | null }) => ({
            mineral_id: m.mineral_id, is_primary: m.is_primary, recovery_rate: m.recovery_rate, commercial_terms: m.commercial_terms,
          })));
        }

        const mpRes = await authFetch(`${API_BASE_URL}/api/v1/mines/${mineId}/parameters`);
        if (mpRes.ok) {
          const d = await mpRes.json();
          const vals: Record<string, string> = {};
          d.parameters.forEach((p: { parameter_id: string; value: string }) => { vals[p.parameter_id] = p.value; });
          setParamValues(vals);
        }

        const featRes = await authFetch(`${API_BASE_URL}/api/v1/mines/${mineId}/features`);
        if (featRes.ok) { const d = await featRes.json(); setFeatures(d.features); }
      }

      const pdRes = await authFetch(`${API_BASE_URL}/api/v1/parameters`);
      if (pdRes.ok) { const d = await pdRes.json(); setParamDefs(d.parameters); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [mineId]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  const ensureMineCreated = async (): Promise<string | null> => {
    if (createdMineId) return createdMineId;
    setSaving(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/mines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basicInfo),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create mine');
      }
      const mine = await response.json();
      setCreatedMineId(mine.id);
      return mine.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating mine');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveMinerals = async (id: string) => {
    if (mineMinerals.length === 0) return;
    await authFetch(`${API_BASE_URL}/api/v1/mines/${id}/minerals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minerals: mineMinerals }),
    });
  };

  const saveParameters = async (id: string) => {
    const params = Object.entries(paramValues)
      .filter(([, v]) => v !== '')
      .map(([parameter_id, value]) => ({ parameter_id, value }));
    if (params.length === 0) return;
    await authFetch(`${API_BASE_URL}/api/v1/mines/${id}/parameters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters: params }),
    });
  };

  const handleNext = async () => {
    setError(null);
    if (step === 0) {
      if (!basicInfo.name.trim()) { setError('Name is required'); return; }
      if (!basicInfo.region_id) { setError('Region is required'); return; }
      const id = await ensureMineCreated();
      if (!id) return;
    }
    if (step === 1 && createdMineId) {
      await saveMinerals(createdMineId);
    }
    if (step === 2 && createdMineId) {
      await saveParameters(createdMineId);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleCommission = async () => {
    if (!createdMineId) return;
    setSaving(true);
    setError(null);
    try {
      await saveMinerals(createdMineId);
      await saveParameters(createdMineId);
      const response = await authFetch(`${API_BASE_URL}/api/v1/mines/${createdMineId}/commission`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = err.detail;
        if (typeof detail === 'object' && detail.errors) {
          setError(detail.errors.join('\n'));
        } else {
          throw new Error(typeof detail === 'string' ? detail : 'Commission failed');
        }
        return;
      }
      router.push('/admin/mines');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error commissioning mine');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!createdMineId || !addUserId) return;
    try {
      await authFetch(`${API_BASE_URL}/api/v1/mines/${createdMineId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId, role: addUserRole }),
      });
      const user = allUsers.find((u) => u.id === addUserId);
      if (user) {
        setMineUsers([...mineUsers, { user_id: user.id, email: user.email, name: user.name, role: addUserRole }]);
      }
      setAddUserId('');
      setAddUserRole('viewer');
    } catch {
      setError('Failed to add user');
    }
  };

  const handleFeatureToggle = async (featureKey: string, enabled: boolean) => {
    if (!createdMineId) return;
    await authFetch(`${API_BASE_URL}/api/v1/mines/${createdMineId}/features/${featureKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setFeatures((prev) => prev.map((f) => f.feature_key === featureKey ? { ...f, enabled } : f));
  };

  const loadFeatures = useCallback(async () => {
    if (!createdMineId) return;
    const res = await authFetch(`${API_BASE_URL}/api/v1/mines/${createdMineId}/features`);
    if (res.ok) { const d = await res.json(); setFeatures(d.features); }
  }, [createdMineId]);

  useEffect(() => {
    if (step === 4 && createdMineId && features.length === 0) loadFeatures();
  }, [step, createdMineId, features.length, loadFeatures]);

  // Group parameters by category
  const paramsByCategory = paramDefs.reduce<Record<string, ParamDef[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  const stepLabel = (key: string) => t(`admin.commissioning.${key}`);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {mineId ? t('admin.commissioning.editTitle') : t('admin.commissioning.title')}
        </h1>
        <p className="text-gray-600">{t('admin.commissioning.subtitle')}</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((key, i) => (
            <div key={key} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                i < step ? 'bg-purple-600 text-white' :
                i === step ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {i + 1}
              </div>
              <span className={`ml-2 text-xs hidden sm:inline ${i === step ? 'text-purple-700 font-medium' : 'text-gray-500'}`}>
                {stepLabel(key)}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 mx-2 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 whitespace-pre-line">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">x</button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 min-h-[300px]">
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">{stepLabel('basicInfo')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.mineName')}</label>
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.regionComplex')}</label>
                <select
                  value={basicInfo.region_id}
                  onChange={(e) => setBasicInfo({ ...basicInfo, region_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  required
                >
                  <option value="">{t('admin.mines.select')}</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.primaryMetal')}</label>
                <select
                  value={basicInfo.primary_metal}
                  onChange={(e) => setBasicInfo({ ...basicInfo, primary_metal: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  {metals.map((m) => (
                    <option key={m.id} value={m.code}>{m.name} ({m.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.mines.miningMethod')}</label>
                <select
                  value={basicInfo.mining_method}
                  onChange={(e) => setBasicInfo({ ...basicInfo, mining_method: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  <option value="UG">{t('admin.mines.underground')} (UG)</option>
                  <option value="OP">{t('admin.mines.openPit')} (OP)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Minerals */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">{stepLabel('selectMinerals')}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.commissioning.primaryMineral')}</label>
              <select
                value={mineMinerals.find((m) => m.is_primary)?.mineral_id || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setMineMinerals((prev) => {
                    const without = prev.filter((m) => !m.is_primary);
                    if (!id) return without;
                    return [{ mineral_id: id, is_primary: true, recovery_rate: null, commercial_terms: null }, ...without];
                  });
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
              >
                <option value="">{t('admin.commissioning.selectPrimary')}</option>
                {allMinerals.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">{t('admin.commissioning.byproducts')}</label>
                <button
                  type="button"
                  onClick={() => setMineMinerals([...mineMinerals, { mineral_id: '', is_primary: false, recovery_rate: null, commercial_terms: null }])}
                  className="text-sm text-purple-600 hover:text-purple-800"
                >
                  + {t('admin.commissioning.addByproduct')}
                </button>
              </div>
              {mineMinerals.filter((m) => !m.is_primary).map((mm, idx) => (
                <div key={idx} className="flex items-center gap-3 mb-2">
                  <select
                    value={mm.mineral_id}
                    onChange={(e) => {
                      const updated = [...mineMinerals];
                      const realIdx = mineMinerals.indexOf(mm);
                      updated[realIdx] = { ...mm, mineral_id: e.target.value };
                      setMineMinerals(updated);
                    }}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                  >
                    <option value="">{t('admin.mines.select')}</option>
                    {allMinerals.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setMineMinerals(mineMinerals.filter((x) => x !== mm))}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Parameters */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{stepLabel('customParameters')}</h2>
            {Object.entries(paramsByCategory).map(([category, defs]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 capitalize">{category}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {defs.map((pd) => (
                    <div key={pd.id}>
                      <label className="block text-sm font-medium text-gray-700">
                        {pd.name}
                        {pd.is_required && <span className="text-red-500 ml-1">*</span>}
                        {pd.unit && <span className="text-gray-400 ml-1">({pd.unit})</span>}
                      </label>
                      {pd.description && <p className="text-xs text-gray-400 mb-1">{pd.description}</p>}
                      {pd.data_type === 'boolean' ? (
                        <select
                          value={paramValues[pd.id] ?? pd.default_value ?? ''}
                          onChange={(e) => setParamValues({ ...paramValues, [pd.id]: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                        >
                          <option value="">--</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          type={pd.data_type === 'float' || pd.data_type === 'integer' ? 'number' : 'text'}
                          step={pd.data_type === 'float' ? 'any' : undefined}
                          value={paramValues[pd.id] ?? pd.default_value ?? ''}
                          onChange={(e) => setParamValues({ ...paramValues, [pd.id]: e.target.value })}
                          min={pd.validation_rules?.min}
                          max={pd.validation_rules?.max}
                          required={pd.is_required}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {paramDefs.length === 0 && (
              <p className="text-gray-500 text-sm">{t('admin.parameters.subtitle')}</p>
            )}
          </div>
        )}

        {/* Step 4: Users */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">{stepLabel('assignUsers')}</h2>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">{t('admin.users.user')}</label>
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  <option value="">{t('admin.mines.select')}</option>
                  {allUsers
                    .filter((u) => !mineUsers.some((mu) => mu.user_id === u.id))
                    .map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('admin.commissioning.role')}</label>
                <select
                  value={addUserRole}
                  onChange={(e) => setAddUserRole(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddUser}
                disabled={!addUserId}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {t('common.add')}
              </button>
            </div>
            {mineUsers.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('admin.commissioning.noUsersAssigned')}</p>
            ) : (
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {mineUsers.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{u.name}</span>
                      <span className="text-sm text-gray-500 ml-2">{u.email}</span>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">{u.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Features */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">{stepLabel('enableFeatures')}</h2>
            {features.map((feat) => (
              <div key={feat.feature_key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-sm text-gray-900">{feat.name}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{feat.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={feat.enabled}
                    onChange={(e) => handleFeatureToggle(feat.feature_key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                </label>
              </div>
            ))}
          </div>
        )}

        {/* Step 6: Review */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">{stepLabel('reviewCommission')}</h2>
            <p className="text-sm text-gray-500">{t('admin.commissioning.reviewSummary')}</p>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{stepLabel('basicInfo')}</h3>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="text-gray-500">{t('admin.mines.name')}</dt><dd className="text-gray-900 font-medium">{basicInfo.name}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">{t('admin.mines.region')}</dt><dd className="text-gray-900">{regions.find((r) => r.id === basicInfo.region_id)?.name}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">{t('admin.mines.method')}</dt><dd className="text-gray-900">{basicInfo.mining_method}</dd></div>
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.commissioning.minerals')}</h3>
                {mineMinerals.length === 0 ? (
                  <p className="text-sm text-gray-400">--</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {mineMinerals.map((mm) => {
                      const mineral = allMinerals.find((m) => m.id === mm.mineral_id);
                      return (
                        <li key={mm.mineral_id} className="flex items-center gap-2">
                          <span className="text-gray-900">{mineral?.name} ({mineral?.code})</span>
                          {mm.is_primary && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Primary</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.commissioning.parameters')}</h3>
                <dl className="text-sm space-y-1">
                  {paramDefs.filter((pd) => paramValues[pd.id]).map((pd) => (
                    <div key={pd.id} className="flex justify-between">
                      <dt className="text-gray-500">{pd.name}</dt>
                      <dd className="text-gray-900">{paramValues[pd.id]} {pd.unit}</dd>
                    </div>
                  ))}
                  {paramDefs.filter((pd) => paramValues[pd.id]).length === 0 && <p className="text-gray-400">--</p>}
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.commissioning.users')}</h3>
                {mineUsers.length === 0 ? <p className="text-sm text-gray-400">--</p> : (
                  <ul className="text-sm space-y-1">
                    {mineUsers.map((u) => (
                      <li key={u.user_id} className="flex justify-between">
                        <span className="text-gray-900">{u.name}</span>
                        <span className="text-gray-500">{u.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.commissioning.features')}</h3>
              <div className="flex flex-wrap gap-2">
                {features.filter((f) => f.enabled).map((f) => (
                  <span key={f.feature_key} className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">{f.name}</span>
                ))}
                {features.filter((f) => f.enabled).length === 0 && <span className="text-sm text-gray-400">--</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
        >
          {t('admin.commissioning.previous')}
        </button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('admin.commissioning.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCommission}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('admin.commissioning.commissionNow')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
