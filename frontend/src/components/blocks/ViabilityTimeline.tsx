'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ViabilityTimelineResponse, fetchViabilityTimeline } from '@/lib/api';

interface ViabilityTimelineProps {
  importId: string;
}

interface ChartPoint {
  date: string;
  viable: number;
  marginal: number;
  inviable: number;
  avg_nsr: number;
  cu_price: number;
}

function TimelineTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 text-xs border border-gray-200 dark:border-gray-700">
      <div className="font-semibold text-gray-900 dark:text-white mb-1">{label}</div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {p.value.toLocaleString()} t
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ViabilityTimeline({ importId }: ViabilityTimelineProps) {
  const t = useTranslations('blocks');
  const [data, setData] = useState<ViabilityTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchViabilityTimeline(importId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [importId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t('noSnapshots')}</p>
      </div>
    );
  }

  const chartData: ChartPoint[] = data.points.map((p) => ({
    date: p.snapshot_date,
    viable: p.viable_tonnage,
    marginal: p.marginal_tonnage,
    inviable: p.inviable_tonnage,
    avg_nsr: p.avg_nsr,
    cu_price: p.cu_price,
  }));

  // KPIs from latest point
  const latest = data.points[data.points.length - 1];
  const totalTonnage = latest.viable_tonnage + latest.marginal_tonnage + latest.inviable_tonnage;
  const viablePct = totalTonnage > 0 ? ((latest.viable_tonnage + latest.marginal_tonnage) / totalTonnage * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('timelineTitle')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {t('timelineDescription')}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <div className="text-xs text-green-600 dark:text-green-400">{t('viableTonnage')}</div>
          <div className="text-lg font-bold text-green-700 dark:text-green-300">
            {latest.viable_tonnage.toLocaleString()} t
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
          <div className="text-xs text-amber-600 dark:text-amber-400">{t('marginalTonnage')}</div>
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {latest.marginal_tonnage.toLocaleString()} t
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
          <div className="text-xs text-red-600 dark:text-red-400">{t('inviableTonnage')}</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-300">
            {latest.inviable_tonnage.toLocaleString()} t
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-600 dark:text-blue-400">{t('viablePercent')}</div>
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {viablePct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: t('tonnage') + ' (t)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
            <Tooltip content={<TimelineTooltip />} />
            <Legend />
            <Bar dataKey="viable" name={t('viable')} stackId="a" fill="#22c55e" />
            <Bar dataKey="marginal" name={t('marginal')} stackId="a" fill="#fbbf24" />
            <Bar dataKey="inviable" name={t('inviable')} stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
