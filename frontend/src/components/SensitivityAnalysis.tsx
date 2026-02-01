'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { NSRInput, computeNSR } from '@/lib/api';
import { Slider } from './ui/Slider';

interface SensitivityAnalysisProps {
  baseInput: NSRInput;
  baseNSR: number;
}

export default function SensitivityAnalysis({ baseInput, baseNSR }: SensitivityAnalysisProps) {
  const t = useTranslations('sensitivity');
  const [selectedVariable, setSelectedVariable] = useState<'cu_grade' | 'au_grade' | 'cu_price' | 'au_price'>('cu_grade');
  const [rangePercent, setRangePercent] = useState(30);
  const [isCalculating, setIsCalculating] = useState(false);
  const [sensitivityData, setSensitivityData] = useState<Array<{ x: number; nsr: number; label: string }>>([]);

  // Variables for analysis
  const variables = [
    { key: 'cu_grade', label: t('cuGrade'), unit: '%', baseValue: baseInput.cu_grade },
    { key: 'au_grade', label: t('auGrade'), unit: 'g/t', baseValue: baseInput.au_grade },
    { key: 'cu_price', label: t('cuPrice'), unit: '$/lb', baseValue: baseInput.cu_price || 4.5 },
    { key: 'au_price', label: t('auPrice'), unit: '$/oz', baseValue: baseInput.au_price || 2000 },
  ];

  const selectedVar = variables.find(v => v.key === selectedVariable)!;

  // Generate sensitivity data points
  const generateSensitivityData = async () => {
    setIsCalculating(true);
    const points = 11; // Number of points
    const data: Array<{ x: number; nsr: number; label: string }> = [];

    for (let i = 0; i < points; i++) {
      const percent = -rangePercent + (i * (2 * rangePercent)) / (points - 1);
      const factor = 1 + percent / 100;
      
      const modifiedInput = { ...baseInput };
      const newValue = selectedVar.baseValue * factor;
      
      switch (selectedVariable) {
        case 'cu_grade':
          modifiedInput.cu_grade = Math.max(0, newValue);
          break;
        case 'au_grade':
          modifiedInput.au_grade = Math.max(0, newValue);
          break;
        case 'cu_price':
          modifiedInput.cu_price = Math.max(0, newValue);
          break;
        case 'au_price':
          modifiedInput.au_price = Math.max(0, newValue);
          break;
      }

      try {
        const result = await computeNSR(modifiedInput);
        data.push({
          x: newValue,
          nsr: result.nsr_per_tonne,
          label: `${percent >= 0 ? '+' : ''}${percent.toFixed(0)}%`,
        });
      } catch (error) {
        console.error('Failed to calculate:', error);
      }
    }

    setSensitivityData(data);
    setIsCalculating(false);
  };

  // Break-even calculation
  const breakEvenValue = useMemo(() => {
    if (sensitivityData.length < 2) return null;
    
    // Find where NSR crosses zero
    for (let i = 1; i < sensitivityData.length; i++) {
      const prev = sensitivityData[i - 1];
      const curr = sensitivityData[i];
      
      if ((prev.nsr >= 0 && curr.nsr < 0) || (prev.nsr < 0 && curr.nsr >= 0)) {
        // Linear interpolation
        const slope = (curr.nsr - prev.nsr) / (curr.x - prev.x);
        const breakEven = prev.x - prev.nsr / slope;
        return breakEven;
      }
    }
    return null;
  }, [sensitivityData]);

  // Format values
  const formatValue = (value: number, unit: string) => {
    if (unit === '$/lb' || unit === '$/oz') {
      return `$${value.toFixed(2)}`;
    }
    return `${value.toFixed(2)}${unit}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          {t('title')}
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Variable selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('selectVariable')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {variables.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setSelectedVariable(v.key as typeof selectedVariable)}
                  className={`px-4 py-3 text-sm rounded-lg border transition-all ${
                    selectedVariable === v.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  <p className="font-medium">{v.label}</p>
                  <p className={`text-xs mt-1 ${selectedVariable === v.key ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                    {formatValue(v.baseValue, v.unit)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Range slider */}
          <div>
            <Slider
              value={rangePercent}
              min={10}
              max={50}
              step={5}
              onChange={setRangePercent}
              label={t('variationRange')}
              unit="%"
            />

            <button
              onClick={generateSensitivityData}
              disabled={isCalculating}
              className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isCalculating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('calculating')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {t('runAnalysis')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {sensitivityData.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('baseNSR')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(baseNSR)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedVar.label}: {formatValue(selectedVar.baseValue, selectedVar.unit)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('nsrRange')}</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-red-500">
                  {formatCurrency(Math.min(...sensitivityData.map(d => d.nsr)))}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-lg font-bold text-green-500">
                  {formatCurrency(Math.max(...sensitivityData.map(d => d.nsr)))}
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('breakEven')}</p>
              {breakEvenValue !== null ? (
                <>
                  <p className="text-2xl font-bold text-orange-500">
                    {formatValue(breakEvenValue, selectedVar.unit)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {((breakEvenValue / selectedVar.baseValue - 1) * 100).toFixed(1)}% {t('fromBase')}
                  </p>
                </>
              ) : (
                <p className="text-lg text-gray-400">{t('notInRange')}</p>
              )}
            </motion.div>
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
              {t('sensitivityChart')}
            </h4>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensitivityData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis 
                    dataKey="x" 
                    tickFormatter={(v) => formatValue(v, selectedVar.unit)}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <YAxis 
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'NSR']}
                    labelFormatter={(label) => `${selectedVar.label}: ${formatValue(label, selectedVar.unit)}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend />
                  
                  {/* Reference line at base value */}
                  <Line
                    type="monotone"
                    dataKey="nsr"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8 }}
                    name="NSR ($/t)"
                  />
                  
                  {/* Zero line */}
                  {sensitivityData.some(d => d.nsr < 0) && (
                    <Line
                      type="monotone"
                      dataKey={() => 0}
                      stroke="#ef4444"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      name={t('breakEvenLine')}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Data Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-300 font-medium">
                      {t('variation')}
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-300 font-medium">
                      {selectedVar.label}
                    </th>
                    <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                      NSR ($/t)
                    </th>
                    <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-medium">
                      Δ NSR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sensitivityData.map((point, index) => {
                    const deltaNSR = point.nsr - baseNSR;
                    const deltaPercent = (deltaNSR / baseNSR) * 100;
                    
                    return (
                      <tr 
                        key={index}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          Math.abs((point.x / selectedVar.baseValue - 1) * 100) < 1 ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {point.label}
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                          {formatValue(point.x, selectedVar.unit)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          point.nsr >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'
                        }`}>
                          {formatCurrency(point.nsr)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          deltaNSR >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {deltaNSR >= 0 ? '+' : ''}{formatCurrency(deltaNSR)} ({deltaPercent.toFixed(1)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
