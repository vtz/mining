'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, ZAxis,
} from 'recharts';
import { BlockData } from '@/lib/api';

interface ViabilityScatterProps {
  blocks: BlockData[];
  cutoffCost: number;
}

interface ScatterPoint {
  cu_grade: number;
  nsr_per_tonne: number;
  tonnage: number;
  is_viable: boolean;
  id: string;
  zone?: string;
  rock_type?: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 text-xs border border-gray-200 dark:border-gray-700">
      <div className="font-semibold text-gray-900 dark:text-white mb-1">Block</div>
      <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
        <div>Cu: {d.cu_grade.toFixed(2)}%</div>
        <div>NSR: ${d.nsr_per_tonne.toFixed(2)}/t</div>
        <div>Tonnage: {d.tonnage.toLocaleString()}t</div>
        {d.zone && <div>Zone: {d.zone}</div>}
        <div className={d.is_viable ? 'text-green-600' : 'text-red-600'}>
          {d.is_viable ? 'Viable' : 'Inviable'}
        </div>
      </div>
    </div>
  );
}

export default function ViabilityScatter({ blocks, cutoffCost }: ViabilityScatterProps) {
  const t = useTranslations('blocks');

  const { viableData, inviableData, marginalData } = useMemo(() => {
    const viable: ScatterPoint[] = [];
    const inviable: ScatterPoint[] = [];
    const marginal: ScatterPoint[] = [];
    const marginalUpper = cutoffCost * 1.1;

    for (const b of blocks) {
      if (b.nsr_per_tonne === undefined) continue;
      const point: ScatterPoint = {
        cu_grade: b.cu_grade,
        nsr_per_tonne: b.nsr_per_tonne,
        tonnage: b.tonnage || 1,
        is_viable: b.is_viable ?? false,
        id: b.id,
        zone: b.zone,
        rock_type: b.rock_type,
      };

      if (!point.is_viable) {
        inviable.push(point);
      } else if (point.nsr_per_tonne <= marginalUpper) {
        marginal.push(point);
      } else {
        viable.push(point);
      }
    }
    return { viableData: viable, inviableData: inviable, marginalData: marginal };
  }, [blocks, cutoffCost]);

  const maxTonnage = useMemo(() => {
    const all = [...viableData, ...inviableData, ...marginalData];
    return Math.max(...all.map((p) => p.tonnage), 1);
  }, [viableData, inviableData, marginalData]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('scatterTitle')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {t('scatterDescription')}
        </p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="cu_grade"
              name="Cu Grade"
              unit="%"
              type="number"
              tick={{ fontSize: 11 }}
              label={{ value: 'Cu Grade (%)', position: 'bottom', offset: 5, fontSize: 12 }}
            />
            <YAxis
              dataKey="nsr_per_tonne"
              name="NSR"
              unit="$/t"
              type="number"
              tick={{ fontSize: 11 }}
              label={{ value: 'NSR ($/t)', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <ZAxis dataKey="tonnage" range={[20, 200]} name="Tonnage" />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={cutoffCost}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: `Cutoff $${cutoffCost}`, position: 'right', fill: '#ef4444', fontSize: 11 }}
            />
            <Scatter name={t('inviable')} data={inviableData} fill="#ef4444" fillOpacity={0.6} />
            <Scatter name={t('marginal')} data={marginalData} fill="#fbbf24" fillOpacity={0.7} />
            <Scatter name={t('viable')} data={viableData} fill="#22c55e" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mt-4 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {t('viable')}: {viableData.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            {t('marginal')}: {marginalData.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            {t('inviable')}: {inviableData.length}
          </span>
        </div>
      </div>
    </div>
  );
}
