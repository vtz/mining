'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MINES_DATA_FALLBACK,
  GoalSeekRequest,
  GoalSeekResponse,
  GoalSeekScenario,
  NsrSnapshot,
  computeGoalSeek,
  createGoalSeekScenario,
  listGoalSeekScenarios,
  deleteGoalSeekScenario,
  updateScenarioAlert,
  fetchScenarioHistory,
  fetchMetalPrices,
} from '@/lib/api';
import NsrTimeSeries from './NsrTimeSeries';

// Goal seek variable options
const VARIABLE_OPTIONS = [
  { value: 'cu_price', label: 'Cu Price', unit: '$/lb', category: 'revenue' },
  { value: 'au_price', label: 'Au Price', unit: '$/oz', category: 'revenue' },
  { value: 'ag_price', label: 'Ag Price', unit: '$/oz', category: 'revenue' },
  { value: 'cu_grade', label: 'Cu Grade', unit: '%', category: 'revenue' },
  { value: 'au_grade', label: 'Au Grade', unit: 'g/t', category: 'revenue' },
  { value: 'ag_grade', label: 'Ag Grade', unit: 'g/t', category: 'revenue' },
  { value: 'cu_tc', label: 'Treatment Charge', unit: '$/dmt', category: 'cost' },
  { value: 'cu_rc', label: 'Refining Charge', unit: '$/lb', category: 'cost' },
  { value: 'cu_freight', label: 'Freight', unit: '$/dmt', category: 'cost' },
  { value: 'mine_dilution', label: 'Mine Dilution', unit: 'decimal', category: 'cost' },
];

// Target NSR presets
const NSR_PRESETS = [
  { label: 'Break-even ($0)', value: 0 },
  { label: '$25/t', value: 25 },
  { label: '$50/t', value: 50 },
  { label: '$100/t', value: 100 },
];

// Format threshold value based on unit
function formatThreshold(value: number, variable?: { unit: string } | null): string {
  if (!variable) return value.toFixed(2);
  const u = variable.unit;
  if (u === '$/oz') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (u.includes('$')) return `$${value.toFixed(2)}`;
  return value.toFixed(4);
}

// Format current value
function formatValue(value: number, variable?: { unit: string } | null): string {
  if (!variable) return value.toFixed(2);
  const u = variable.unit;
  if (u === '$/oz') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (u.includes('$')) return `$${value.toFixed(2)}`;
  return value.toFixed(4);
}

export default function GoalSeek() {
  const t = useTranslations('goalSeek');

  // Form state
  const [mine, setMine] = useState('Vermelhos UG');
  const [area, setArea] = useState('Vermelhos Sul');
  const [cuGrade, setCuGrade] = useState(1.4);
  const [auGrade, setAuGrade] = useState(0.23);
  const [agGrade, setAgGrade] = useState(2.33);
  const [targetVariable, setTargetVariable] = useState('cu_price');
  const [targetNsr, setTargetNsr] = useState(0);
  const [customNsr, setCustomNsr] = useState(false);

  // Prices
  const [cuPrice, setCuPrice] = useState<number | undefined>();
  const [auPrice, setAuPrice] = useState<number | undefined>();
  const [agPrice, setAgPrice] = useState<number | undefined>();

  // Result state
  const [result, setResult] = useState<GoalSeekResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertFrequency, setAlertFrequency] = useState('daily');
  const [isSaving, setIsSaving] = useState(false);

  // Saved scenarios
  const [scenarios, setScenarios] = useState<GoalSeekScenario[]>([]);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [scenarioSnapshots, setScenarioSnapshots] = useState<Record<string, NsrSnapshot[]>>({});

  const mines = MINES_DATA_FALLBACK;
  const areas = mines[mine] || [];

  // Fetch prices on mount
  useEffect(() => {
    fetchMetalPrices().then(data => {
      setCuPrice(data.prices.cu.value);
      setAuPrice(data.prices.au.value);
      setAgPrice(data.prices.ag.value);
    }).catch(() => {});
  }, []);

  // Load saved scenarios
  const loadScenarios = useCallback(async () => {
    try {
      const data = await listGoalSeekScenarios();
      setScenarios(data);
    } catch {
      // silently fail if not authenticated
    }
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  // Update area when mine changes
  useEffect(() => {
    const newAreas = mines[mine] || [];
    if (newAreas.length > 0 && !newAreas.includes(area)) {
      setArea(newAreas[0]);
    }
  }, [mine, area, mines]);

  const handleCompute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const request: GoalSeekRequest = {
        mine,
        area,
        cu_grade: cuGrade,
        au_grade: auGrade,
        ag_grade: agGrade,
        cu_price: cuPrice,
        au_price: auPrice,
        ag_price: agPrice,
        target_variable: targetVariable,
        target_nsr: targetNsr,
      };

      const response = await computeGoalSeek(request);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !scenarioName.trim()) return;
    setIsSaving(true);

    try {
      await createGoalSeekScenario({
        name: scenarioName.trim(),
        base_inputs: {
          mine,
          area,
          cu_grade: cuGrade,
          au_grade: auGrade,
          ag_grade: agGrade,
          cu_price: cuPrice,
          au_price: auPrice,
          ag_price: agPrice,
        },
        target_variable: targetVariable,
        target_nsr: targetNsr,
        threshold_value: result.threshold_value,
        alert_enabled: alertEnabled,
        alert_email: alertEnabled ? alertEmail : undefined,
        alert_frequency: alertFrequency,
      });

      setShowSaveDialog(false);
      setScenarioName('');
      setAlertEnabled(false);
      setAlertEmail('');
      await loadScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await deleteGoalSeekScenario(id);
      setScenarios(prev => prev.filter(s => s.id !== id));
      if (expandedScenario === id) setExpandedScenario(null);
    } catch {
      // ignore
    }
  };

  const handleToggleAlert = async (scenario: GoalSeekScenario) => {
    try {
      const updated = await updateScenarioAlert(scenario.id, {
        alert_enabled: !scenario.alert_enabled,
      });
      setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch {
      // ignore
    }
  };

  const handleExpandScenario = async (id: string) => {
    if (expandedScenario === id) {
      setExpandedScenario(null);
      return;
    }
    setExpandedScenario(id);

    if (!scenarioSnapshots[id]) {
      try {
        const history = await fetchScenarioHistory(id);
        setScenarioSnapshots(prev => ({ ...prev, [id]: history.snapshots }));
      } catch {
        setScenarioSnapshots(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const selectedVar = VARIABLE_OPTIONS.find(v => v.value === targetVariable);

  return (
    <div className="space-y-6">
      {/* Goal Seek Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {t('title')}
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Mine/Area + Grades */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('mine')}
                </label>
                <select
                  value={mine}
                  onChange={(e) => setMine(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {Object.keys(mines).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('area')}
                </label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {areas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cu (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cuGrade}
                  onChange={(e) => setCuGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Au (g/t)</label>
                <input
                  type="number"
                  step="0.01"
                  value={auGrade}
                  onChange={(e) => setAuGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ag (g/t)</label>
                <input
                  type="number"
                  step="0.01"
                  value={agGrade}
                  onChange={(e) => setAgGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Right: Target Variable + Target NSR */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('targetVariable')}
              </label>
              <select
                value={targetVariable}
                onChange={(e) => setTargetVariable(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <optgroup label={t('revenueVariables')}>
                  {VARIABLE_OPTIONS.filter(v => v.category === 'revenue').map(v => (
                    <option key={v.value} value={v.value}>{v.label} ({v.unit})</option>
                  ))}
                </optgroup>
                <optgroup label={t('costVariables')}>
                  {VARIABLE_OPTIONS.filter(v => v.category === 'cost').map(v => (
                    <option key={v.value} value={v.value}>{v.label} ({v.unit})</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('targetNsr')}
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {NSR_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => { setTargetNsr(preset.value); setCustomNsr(false); }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      !customNsr && targetNsr === preset.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => setCustomNsr(true)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    customNsr
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  {t('custom')}
                </button>
              </div>
              {customNsr && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    step="1"
                    value={targetNsr}
                    onChange={(e) => setTargetNsr(Number(e.target.value))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500">/t</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleCompute}
          disabled={isLoading}
          className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('computing')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t('calculateThreshold')}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">{t('dismiss')}</button>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('result')}
              </h4>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                result.is_currently_viable
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {result.is_currently_viable ? t('viable') : t('notViable')}
              </span>
            </div>

            {/* Main threshold display */}
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-4">
              {result.bound_hit ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      {t('alwaysViable')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    {t('boundHitExplanation', {
                      variable: selectedVar?.label || result.target_variable,
                      bound: formatThreshold(result.threshold_value, selectedVar),
                      unit: selectedVar?.unit || '',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {t('currentNsr')}: <span className="font-semibold text-green-600">${result.current_nsr.toFixed(2)}/t</span> | {t('targetNsr')}: ${targetNsr}/t
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    {selectedVar?.label} {t('needsToBe')}
                  </p>
                  <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {formatThreshold(result.threshold_value, selectedVar)}
                    <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-1">
                      {selectedVar?.unit.replace('$', '')}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('forNsr')} ${targetNsr}/t
                  </p>
                </>
              )}
            </div>

            {/* Comparison */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('currentValue')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatValue(result.current_value, selectedVar)}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('currentNsr')}</p>
                <p className={`text-lg font-semibold ${
                  result.current_nsr >= targetNsr ? 'text-green-600' : 'text-red-500'
                }`}>
                  ${result.current_nsr.toFixed(2)}/t
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('delta')}</p>
                <p className={`text-lg font-semibold ${
                  result.delta_percent >= 0 ? 'text-red-500' : 'text-green-600'
                }`}>
                  {result.delta_percent >= 0 ? '+' : ''}{result.delta_percent.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{t('currentValue')}</span>
                <span>{t('threshold')}</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.is_currently_viable ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(5, (result.current_value / result.threshold_value) * 100))}%`
                  }}
                />
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={() => setShowSaveDialog(true)}
              className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {t('saveScenario')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('saveScenario')}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('scenarioName')}
                  </label>
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder={t('scenarioNamePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Alert config */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {t('enableAlert')}
                    </label>
                    <button
                      onClick={() => setAlertEnabled(!alertEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        alertEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        alertEnabled ? 'translate-x-5' : ''
                      }`} />
                    </button>
                  </div>

                  {alertEnabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('alertEmail')}</label>
                        <input
                          type="email"
                          value={alertEmail}
                          onChange={(e) => setAlertEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('alertFrequency')}</label>
                        <select
                          value={alertFrequency}
                          onChange={(e) => setAlertFrequency(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="hourly">{t('hourly')}</option>
                          <option value="daily">{t('daily')}</option>
                          <option value="weekly">{t('weekly')}</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        {t('alertPreview', { nsr: targetNsr })}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!scenarioName.trim() || isSaving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {isSaving ? t('saving') : t('save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Scenarios */}
      {scenarios.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {t('savedScenarios')} ({scenarios.length})
            </h4>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {scenarios.map(scenario => (
              <div key={scenario.id}>
                <div
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => handleExpandScenario(scenario.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {scenario.name}
                        </p>
                        {scenario.alert_enabled && (
                          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {scenario.target_variable} | {t('target')}: ${scenario.target_nsr}/t | {t('threshold')}: {scenario.threshold_value.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {scenario.last_nsr_value !== null && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          scenario.last_nsr_value >= scenario.target_nsr
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          ${scenario.last_nsr_value.toFixed(2)}/t
                        </span>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleAlert(scenario); }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          scenario.alert_enabled
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={scenario.alert_enabled ? t('disableAlert') : t('enableAlert')}
                      >
                        <svg className="w-4 h-4" fill={scenario.alert_enabled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteScenario(scenario.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedScenario === scenario.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded: Time Series Chart */}
                {expandedScenario === scenario.id && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4">
                    <NsrTimeSeries
                      snapshots={scenarioSnapshots[scenario.id] || []}
                      targetNsr={scenario.target_nsr}
                      scenarioName={scenario.name}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
