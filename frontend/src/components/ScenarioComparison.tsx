'use client';

import { useTranslations } from 'next-intl';
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

  // Find base scenario for delta calculation
  const baseScenario = scenarios.find(s => s.name === 'Base');
  const baseNSR = baseScenario?.result.nsr_per_tonne || 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('comparison')}
        </h3>
        <span className="text-sm text-gray-500">
          {t('variation')}: ±{variation}%
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-medium text-gray-600">
                {t('metric')}
              </th>
              {scenarios.map((s) => (
                <th 
                  key={s.name} 
                  className={`text-center py-3 px-4 font-medium ${
                    s.name === 'Downside' ? 'text-red-600' :
                    s.name === 'Upside' ? 'text-green-600' :
                    'text-blue-600'
                  }`}
                >
                  {s.name}
                  <span className="block text-xs font-normal text-gray-400">
                    {formatPercent(s.variation)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Prices */}
            <tr className="border-b border-gray-100 bg-gray-50">
              <td colSpan={4} className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                {t('prices')}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Cu ($/lb)</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900">
                  ${s.cu_price.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Au ($/oz)</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900">
                  ${s.au_price.toFixed(0)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Ag ($/oz)</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900">
                  ${s.ag_price.toFixed(2)}
                </td>
              ))}
            </tr>

            {/* NSR by Metal */}
            <tr className="border-b border-gray-100 bg-gray-50">
              <td colSpan={4} className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                {t('nsrPerMetal')}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Cu</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900">
                  {formatCurrency(s.result.nsr_cu)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Au</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900">
                  {formatCurrency(s.result.nsr_au)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2 text-gray-700">Ag</td>
              {scenarios.map((s) => (
                <td key={s.name} className="text-center py-2 px-4 text-gray-900">
                  {formatCurrency(s.result.nsr_ag)}
                </td>
              ))}
            </tr>

            {/* Total NSR */}
            <tr className="border-b border-gray-100 bg-gray-50">
              <td colSpan={4} className="py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                {t('result')}
              </td>
            </tr>
            <tr className="border-b border-gray-200 font-medium">
              <td className="py-3 px-2 text-gray-900">{t('totalNSR')}</td>
              {scenarios.map((s) => (
                <td 
                  key={s.name} 
                  className={`text-center py-3 px-4 ${
                    s.name === 'Downside' ? 'text-red-700' :
                    s.name === 'Upside' ? 'text-green-700' :
                    'text-blue-700'
                  }`}
                >
                  {formatCurrency(s.result.nsr_per_tonne)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 px-2 text-gray-500">{t('deltaVsBase')}</td>
              {scenarios.map((s) => {
                const delta = baseNSR !== 0 
                  ? ((s.result.nsr_per_tonne - baseNSR) / baseNSR * 100)
                  : 0;
                return (
                  <td 
                    key={s.name} 
                    className={`text-center py-2 px-4 text-sm ${
                      delta < 0 ? 'text-red-600' :
                      delta > 0 ? 'text-green-600' :
                      'text-gray-500'
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
    </div>
  );
}
