'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import {
  MINES_DATA_FALLBACK,
  RecoveryCurveRequest,
  RecoveryCurveResponse,
  RecoveryCurvePoint,
  computeRecoveryCurve,
  fetchMetalPrices,
} from '@/lib/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

interface ChartDataPoint {
  recovery: number;
  concGrade: number;
  nsr: number;
  nsrCu: number;
  nsrAu: number;
  nsrAg: number;
  concRatio: number;
  concPrice: number;
  isBase: boolean;
}

export default function RecoveryCurve() {
  const t = useTranslations('recoveryCurve');

  // Form state
  const [mine, setMine] = useState('Vermelhos UG');
  const [area, setArea] = useState('Vermelhos Sul');
  const [cuGrade, setCuGrade] = useState(1.4);
  const [auGrade, setAuGrade] = useState(0.23);
  const [agGrade, setAgGrade] = useState(2.33);

  // Prices
  const [cuPrice, setCuPrice] = useState<number | undefined>();
  const [auPrice, setAuPrice] = useState<number | undefined>();
  const [agPrice, setAgPrice] = useState<number | undefined>();

  // Curve parameters
  const [recoveryMin, setRecoveryMin] = useState(50);
  const [recoveryMax, setRecoveryMax] = useState(99);
  const [concGradeMax, setConcGradeMax] = useState(34.6);
  const [numPoints, setNumPoints] = useState(20);

  // Result state
  const [curveData, setCurveData] = useState<RecoveryCurveResponse | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mines = MINES_DATA_FALLBACK;
  const areas = mines[mine] || [];

  useEffect(() => {
    fetchMetalPrices()
      .then((data) => {
        setCuPrice(data.prices.cu.value);
        setAuPrice(data.prices.au.value);
        setAgPrice(data.prices.ag.value);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const newAreas = mines[mine] || [];
    if (newAreas.length > 0 && !newAreas.includes(area)) {
      setArea(newAreas[0]);
    }
  }, [mine, area, mines]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setCurveData(null);
    setChartData([]);

    try {
      const request: RecoveryCurveRequest = {
        mine,
        area,
        cu_grade: cuGrade,
        au_grade: auGrade,
        ag_grade: agGrade,
        cu_price: cuPrice,
        au_price: auPrice,
        ag_price: agPrice,
        num_points: numPoints,
        recovery_min: recoveryMin / 100,
        recovery_max: recoveryMax / 100,
        conc_grade_max: concGradeMax,
      };

      const response = await computeRecoveryCurve(request);
      setCurveData(response);

      const data: ChartDataPoint[] = response.curve.map((p: RecoveryCurvePoint) => ({
        recovery: p.cu_recovery_pct,
        concGrade: p.cu_conc_grade,
        nsr: p.nsr_per_tonne,
        nsrCu: p.nsr_cu,
        nsrAu: p.nsr_au,
        nsrAg: p.nsr_ag,
        concRatio: p.conc_ratio,
        concPrice: p.conc_price_total,
        isBase: p.is_base_point,
      }));

      setChartData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate curve');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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
                  {Object.keys(mines).map((m) => (
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
                  {areas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('headGrades')}
              </label>
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
          </div>

          {/* Right: Curve Parameters */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('curveParameters')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('recoveryMin')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="95"
                    value={recoveryMin}
                    onChange={(e) => setRecoveryMin(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('recoveryMax')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="60"
                    max="100"
                    value={recoveryMax}
                    onChange={(e) => setRecoveryMax(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('concGradeMax')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="20"
                    max="80"
                    value={concGradeMax}
                    onChange={(e) => setConcGradeMax(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('numPoints')}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="50"
                    value={numPoints}
                    onChange={(e) => setNumPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full mt-6 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('generating')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {t('generateCurve')}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">
            OK
          </button>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {curveData && chartData.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5"
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('baseNSR')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(curveData.base_point.nsr_per_tonne)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('recovery')}: {curveData.base_point.cu_recovery_pct.toFixed(1)}%
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5"
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('concGrade')}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {curveData.base_point.cu_conc_grade.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('concRatio')}: {curveData.base_point.conc_ratio.toFixed(4)}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5"
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('recovery')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {curveData.base_point.cu_recovery_pct.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {curveData.base_point.cu_conc_grade.toFixed(1)}% Cu {t('concGrade').toLowerCase()}
                </p>
              </motion.div>
            </div>

            {/* Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                {t('chart')}
              </h4>

              <div className="h-[28rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 30, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                      dataKey="concGrade"
                      type="number"
                      name={t('concGrade')}
                      domain={['dataMin - 2', 'dataMax + 2']}
                      tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                      label={{
                        value: t('concGrade'),
                        position: 'insideBottom',
                        offset: -15,
                        style: { fill: '#6b7280', fontSize: 12 },
                      }}
                    />
                    <YAxis
                      dataKey="recovery"
                      type="number"
                      name={t('recovery')}
                      domain={['dataMin - 2', 'dataMax + 2']}
                      tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                      label={{
                        value: t('recovery'),
                        angle: -90,
                        position: 'insideLeft',
                        offset: 10,
                        style: { fill: '#6b7280', fontSize: 12 },
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload as ChartDataPoint;
                        return (
                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold text-gray-900 dark:text-white mb-1">
                              {d.isBase ? t('baseOperatingPoint') : `${t('recovery')}: ${d.recovery.toFixed(1)}%`}
                            </p>
                            <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                              <p>{t('recovery')}: <span className="font-medium">{d.recovery.toFixed(1)}%</span></p>
                              <p>{t('concGrade')}: <span className="font-medium">{d.concGrade.toFixed(1)}%</span></p>
                              <hr className="my-1 border-gray-200 dark:border-gray-700" />
                              <p className="font-semibold text-emerald-600">NSR: {formatCurrency(d.nsr)}/t</p>
                              <p>{t('nsrCu')}: {formatCurrency(d.nsrCu)}</p>
                              <p>{t('nsrAu')}: {formatCurrency(d.nsrAu)}</p>
                              <p>{t('nsrAg')}: {formatCurrency(d.nsrAg)}</p>
                              <p>{t('concRatio')}: {d.concRatio.toFixed(4)}</p>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={chartData}
                      line={{ stroke: '#8b5cf6', strokeWidth: 2 }}
                      lineType="fitting"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.isBase ? '#3b82f6' : '#8b5cf6'}
                          stroke="#fff"
                          strokeWidth={entry.isBase ? 2 : 1}
                          r={entry.isBase ? 8 : 5}
                        />
                      ))}
                      <LabelList
                        dataKey="nsr"
                        position="top"
                        offset={12}
                        formatter={((v: unknown) => v != null ? `$${Number(v).toFixed(0)}` : '') as never}
                        style={{ fontSize: 10, fill: '#059669', fontWeight: 600 }}
                      />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Legend annotation */}
              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                  {t('concGrade')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                  {t('baseOperatingPoint')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-semibold">$</span>
                  NSR
                </span>
              </div>
            </motion.div>

            {/* Data Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                  {t('dataTable')}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-300 font-medium">
                        {t('recovery')}
                      </th>
                      <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {t('concGrade')}
                      </th>
                      <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {t('nsrPerTonne')}
                      </th>
                      <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {t('nsrCu')}
                      </th>
                      <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {t('nsrAu')}
                      </th>
                      <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {t('nsrAg')}
                      </th>
                      <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {t('concRatio')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {curveData.curve.map((point, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                            point.is_base_point
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                            {point.cu_recovery_pct.toFixed(1)}%
                            {point.is_base_point && (
                              <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                {t('basePoint')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-purple-600 font-medium">
                            {point.cu_conc_grade.toFixed(1)}%
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              point.nsr_per_tonne >= 0
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            }`}
                          >
                            {formatCurrency(point.nsr_per_tonne)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                            {formatCurrency(point.nsr_cu)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                            {formatCurrency(point.nsr_au)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                            {formatCurrency(point.nsr_ag)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                            {point.conc_ratio.toFixed(4)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
