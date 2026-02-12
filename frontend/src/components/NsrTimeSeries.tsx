'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { NsrSnapshot } from '@/lib/api';

interface NsrTimeSeriesProps {
  snapshots: NsrSnapshot[];
  targetNsr: number;
  scenarioName?: string;
}

// Time range presets
const TIME_RANGES = [
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: 0 },
];

// Custom tooltip component
function NsrTooltip({ active, payload, targetNsr }: {
  active?: boolean;
  payload?: Array<{ payload: NsrSnapshot & { date: string } }>;
  targetNsr: number;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isViable = data.nsr_per_tonne >= targetNsr;

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[240px]">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {formatDate(data.date || '')}
      </p>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mb-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">NSR Total</span>
          <span className={`text-lg font-bold ${isViable ? 'text-green-600' : 'text-red-500'}`}>
            ${data.nsr_per_tonne.toFixed(2)}/t
          </span>
        </div>
        <span className={`text-xs font-medium ${isViable ? 'text-green-500' : 'text-red-400'}`}>
          {isViable ? 'viable' : 'not viable'}
        </span>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mb-2 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Cu NSR</span>
          <span className="text-gray-800 dark:text-gray-200">${data.nsr_cu.toFixed(2)}/t</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Au NSR</span>
          <span className="text-gray-800 dark:text-gray-200">${data.nsr_au.toFixed(2)}/t</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Ag NSR</span>
          <span className="text-gray-800 dark:text-gray-200">${data.nsr_ag.toFixed(2)}/t</span>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Metal Prices</p>
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Cu</span>
            <span className="text-gray-700 dark:text-gray-300">${data.cu_price.toFixed(2)}/lb</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Au</span>
            <span className="text-gray-700 dark:text-gray-300">${data.au_price.toLocaleString()}/oz</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Ag</span>
            <span className="text-gray-700 dark:text-gray-300">${data.ag_price.toFixed(2)}/oz</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Costs Used</p>
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">TC</span>
            <span className="text-gray-700 dark:text-gray-300">${data.cu_tc.toFixed(2)}/dmt</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">RC</span>
            <span className="text-gray-700 dark:text-gray-300">${data.cu_rc.toFixed(2)}/lb</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Freight</span>
            <span className="text-gray-700 dark:text-gray-300">${data.cu_freight.toFixed(2)}/dmt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NsrTimeSeries({ snapshots, targetNsr, scenarioName }: NsrTimeSeriesProps) {
  const t = useTranslations('timeSeries');
  const [selectedRange, setSelectedRange] = useState('all');

  // Filter data by selected time range
  const filteredData = useMemo(() => {
    if (selectedRange === 'all' || snapshots.length === 0) {
      return snapshots.map(s => ({ ...s, date: s.timestamp }));
    }

    const range = TIME_RANGES.find(r => r.key === selectedRange);
    if (!range || range.days === 0) {
      return snapshots.map(s => ({ ...s, date: s.timestamp }));
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    const cutoffStr = cutoff.toISOString();

    return snapshots
      .filter(s => s.timestamp >= cutoffStr)
      .map(s => ({ ...s, date: s.timestamp }));
  }, [snapshots, selectedRange]);

  // Compute NSR range for chart domain
  const nsrValues = filteredData.map(d => d.nsr_per_tonne);
  const minNsr = Math.min(...nsrValues, targetNsr) - 5;
  const maxNsr = Math.max(...nsrValues, targetNsr) + 5;

  // Format X axis labels
  const formatXAxis = (ts: string) => {
    const d = new Date(ts);
    if (selectedRange === '7d') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (filteredData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">{t('noData')}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('noDataHint')}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            {t('title')}
          </h4>
          {scenarioName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{scenarioName}</p>
          )}
        </div>

        {/* Time range selectors */}
        <div className="flex gap-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.key}
              onClick={() => setSelectedRange(range.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                selectedRange === range.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="nsrGradientGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="nsrGradientRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                className="text-gray-600 dark:text-gray-400"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                domain={[Math.floor(minNsr), Math.ceil(maxNsr)]}
                tickFormatter={(v: number) => `$${v}`}
                className="text-gray-600 dark:text-gray-400"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={<NsrTooltip targetNsr={targetNsr} />}
                cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <ReferenceLine
                y={targetNsr}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{
                  value: `Target: $${targetNsr}/t`,
                  position: 'right',
                  fill: '#f59e0b',
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="nsr_per_tonne"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#nsrGradientGreen)"
                dot={filteredData.length <= 60 ? { fill: '#3b82f6', r: 3 } : false}
                activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 pb-4 grid grid-cols-4 gap-3">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('points')}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{filteredData.length}</p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('latest')}</p>
          <p className={`text-sm font-semibold ${
            filteredData[filteredData.length - 1]?.nsr_per_tonne >= targetNsr
              ? 'text-green-600' : 'text-red-500'
          }`}>
            ${filteredData[filteredData.length - 1]?.nsr_per_tonne.toFixed(2) || '—'}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('min')}</p>
          <p className="text-sm font-semibold text-red-500">
            ${nsrValues.length ? Math.min(...nsrValues).toFixed(2) : '—'}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('max')}</p>
          <p className="text-sm font-semibold text-green-600">
            ${nsrValues.length ? Math.max(...nsrValues).toFixed(2) : '—'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
