'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ScenarioResult } from '@/lib/api';

interface ScenarioComparisonProps {
  scenarios: ScenarioResult[];
  variation: number;
}

export default function ScenarioComparison({ 
  scenarios, 
  variation 
}: ScenarioComparisonProps) {
  const t = useTranslations('scenarios');
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Find base scenario
  const baseScenario = scenarios.find(s => s.name === 'Base');
  const baseNSR = baseScenario?.result.nsr_per_tonne || 0;

  // Prepare chart data
  const chartData = scenarios.map(s => ({
    name: s.name,
    nsr: s.result.nsr_per_tonne,
    cu: s.result.nsr_cu,
    au: s.result.nsr_au,
    ag: s.result.nsr_ag,
    delta: baseNSR !== 0 ? ((s.result.nsr_per_tonne - baseNSR) / baseNSR * 100) : 0,
  }));

  // Colors for scenarios
  const getScenarioColor = (name: string) => {
    switch (name) {
      case 'Downside': return '#ef4444';
      case 'Base': return '#3b82f6';
      case 'Upside': return '#22c55e';
      default: return '#6b7280';
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
              {entry.dataKey === 'nsr' ? 'NSR Total' : entry.dataKey.toUpperCase()}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {t('comparison')}
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
            ±{variation}%
          </span>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario, index) => {
          const delta = baseNSR !== 0 ? ((scenario.result.nsr_per_tonne - baseNSR) / baseNSR * 100) : 0;
          const color = getScenarioColor(scenario.name);
          
          return (
            <motion.div
              key={scenario.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border-2 ${
                scenario.name === 'Base' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span 
                  className="px-2 py-1 text-xs font-medium rounded-full"
                  style={{ 
                    backgroundColor: `${color}20`,
                    color: color,
                  }}
                >
                  {scenario.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatPercent(scenario.variation)}
                </span>
              </div>
              
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(scenario.result.nsr_per_tonne)}
              </p>
              
              {scenario.name !== 'Base' && (
                <p className={`text-sm mt-1 ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {delta >= 0 ? '↑' : '↓'} {formatPercent(delta)} vs Base
                </p>
              )}
              
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cu</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ${scenario.cu_price.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Au</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ${scenario.au_price.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ag</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ${scenario.ag_price.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
          {t('nsrComparison')}
        </h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="name" className="text-gray-600 dark:text-gray-400" />
              <YAxis tickFormatter={(v) => `$${v}`} className="text-gray-600 dark:text-gray-400" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="cu" stackId="a" fill="#f97316" name="Cu" radius={[0, 0, 0, 0]} />
              <Bar dataKey="au" stackId="a" fill="#eab308" name="Au" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ag" stackId="a" fill="#9ca3af" name="Ag" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-300">
                {t('metric')}
              </th>
              {scenarios.map((s) => (
                <th 
                  key={s.name} 
                  className={`text-center py-3 px-4 font-medium ${
                    s.name === 'Downside' ? 'text-red-600 dark:text-red-400' :
                    s.name === 'Upside' ? 'text-green-600 dark:text-green-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Prices Section */}
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <td colSpan={4} className="py-2 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {t('prices')}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 px-4 text-gray-700 dark:text-gray-300">Cu ($/lb)</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900 dark:text-white">
                  ${s.cu_price.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 px-4 text-gray-700 dark:text-gray-300">Au ($/oz)</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900 dark:text-white">
                  ${s.au_price.toFixed(0)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 px-4 text-gray-700 dark:text-gray-300">Ag ($/oz)</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900 dark:text-white">
                  ${s.ag_price.toFixed(2)}
                </td>
              ))}
            </tr>

            {/* NSR Section */}
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <td colSpan={4} className="py-2 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {t('nsrPerMetal')}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 px-4 text-gray-700 dark:text-gray-300">Cu</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900 dark:text-white">
                  {formatCurrency(s.result.nsr_cu)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 px-4 text-gray-700 dark:text-gray-300">Au</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900 dark:text-white">
                  {formatCurrency(s.result.nsr_au)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="py-2 px-4 text-gray-700 dark:text-gray-300">Ag</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900 dark:text-white">
                  {formatCurrency(s.result.nsr_ag)}
                </td>
              ))}
            </tr>

            {/* Total */}
            <tr className="bg-gray-100 dark:bg-gray-700 font-semibold">
              <td className="py-3 px-4 text-gray-900 dark:text-white">{t('totalNSR')}</td>
              {scenarios.map((s) => (
                <td 
                  key={s.name} 
                  className={`text-center py-3 px-4 ${
                    s.name === 'Downside' ? 'text-red-600 dark:text-red-400' :
                    s.name === 'Upside' ? 'text-green-600 dark:text-green-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {formatCurrency(s.result.nsr_per_tonne)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{t('deltaVsBase')}</td>
              {scenarios.map((s) => {
                const delta = baseNSR !== 0 
                  ? ((s.result.nsr_per_tonne - baseNSR) / baseNSR * 100)
                  : 0;
                return (
                  <td 
                    key={s.name} 
                    className={`text-center py-2 px-4 text-sm font-medium ${
                      delta < 0 ? 'text-red-500' :
                      delta > 0 ? 'text-green-500' :
                      'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {s.name === 'Base' ? '—' : formatPercent(delta)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
