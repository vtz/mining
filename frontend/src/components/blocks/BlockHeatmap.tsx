'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { HeatmapBlock, HeatmapResponse, fetchHeatmapData, listBlockLevels, listBlockSnapshots } from '@/lib/api';

interface BlockHeatmapProps {
  importId: string;
  onBlockSelect?: (block: HeatmapBlock) => void;
}

function nsrToColor(nsr: number, cutoff: number): string {
  if (nsr <= 0) return '#ef4444';           // red-500
  if (nsr < cutoff * 0.9) return '#f87171'; // red-400
  if (nsr < cutoff) return '#fb923c';       // orange-400
  if (nsr < cutoff * 1.1) return '#fbbf24'; // amber-400
  if (nsr < cutoff * 1.5) return '#a3e635'; // lime-400
  return '#22c55e';                          // green-500
}

export default function BlockHeatmap({ importId, onBlockSelect }: BlockHeatmapProps) {
  const t = useTranslations('blocks');

  const [levels, setLevels] = useState<number[]>([]);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<string>('');
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<HeatmapBlock | null>(null);
  const [loading, setLoading] = useState(false);

  // Load levels and snapshots
  useEffect(() => {
    async function load() {
      try {
        const [lvl, snap] = await Promise.all([
          listBlockLevels(importId),
          listBlockSnapshots(importId),
        ]);
        setLevels(lvl.levels);
        setSnapshots(snap.snapshots);
        if (lvl.levels.length > 0) {
          setCurrentLevel(lvl.levels[Math.floor(lvl.levels.length / 2)]);
        }
        if (snap.snapshots.length > 0) {
          setCurrentSnapshot(snap.snapshots[0]);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [importId]);

  // Load heatmap data when level/snapshot changes
  useEffect(() => {
    if (currentLevel === null) return;
    setLoading(true);
    fetchHeatmapData(importId, currentLevel, currentSnapshot || undefined)
      .then(setHeatmapData)
      .catch(() => setHeatmapData(null))
      .finally(() => setLoading(false));
  }, [importId, currentLevel, currentSnapshot]);

  // Calculate SVG viewport from block positions
  const { viewBox, scaleX, scaleY, offsetX, offsetY, width, height } = useMemo(() => {
    if (!heatmapData?.blocks.length) {
      return { viewBox: '0 0 800 600', scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, width: 800, height: 600 };
    }
    const blocks = heatmapData.blocks;
    const xs = blocks.map((b) => b.x);
    const ys = blocks.map((b) => b.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = blocks[0]?.dx || (maxX - minX) / Math.sqrt(blocks.length) || 10;
    const dy = blocks[0]?.dy || dx;
    const rangeX = maxX - minX + dx;
    const rangeY = maxY - minY + dy;
    const svgW = 800;
    const svgH = 600;
    const sx = svgW / (rangeX || 1);
    const sy = svgH / (rangeY || 1);
    const scale = Math.min(sx, sy);
    return {
      viewBox: `0 0 ${svgW} ${svgH}`,
      scaleX: scale,
      scaleY: scale,
      offsetX: minX,
      offsetY: minY,
      width: svgW,
      height: svgH,
    };
  }, [heatmapData]);

  const levelIdx = levels.indexOf(currentLevel ?? 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('heatmapTitle')}</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Z-level slider */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('zLevel')}: {currentLevel?.toFixed(1) ?? '—'}
            </label>
            <input
              type="range"
              min={0}
              max={levels.length - 1}
              value={levelIdx >= 0 ? levelIdx : 0}
              onChange={(e) => setCurrentLevel(levels[parseInt(e.target.value)] ?? null)}
              className="w-full accent-blue-600"
              disabled={levels.length === 0}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>{levels[0]?.toFixed(0) ?? ''}</span>
              <span>{levels[levels.length - 1]?.toFixed(0) ?? ''}</span>
            </div>
          </div>

          {/* Snapshot selector */}
          {snapshots.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t('snapshot')}
              </label>
              <select
                value={currentSnapshot}
                onChange={(e) => setCurrentSnapshot(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {snapshots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Heatmap SVG */}
        <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          <svg viewBox={viewBox} className="w-full" style={{ minHeight: 400 }}>
            {heatmapData?.blocks.map((block) => {
              const bx = (block.x - offsetX) * scaleX;
              const by = (block.y - offsetY) * scaleY;
              const bw = (block.dx || 10) * scaleX;
              const bh = (block.dy || 10) * scaleY;
              return (
                <rect
                  key={block.id}
                  x={bx}
                  y={height - by - bh}
                  width={Math.max(bw, 1)}
                  height={Math.max(bh, 1)}
                  fill={nsrToColor(block.nsr_per_tonne, heatmapData.cutoff_cost)}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={0.5}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredBlock(block)}
                  onMouseLeave={() => setHoveredBlock(null)}
                  onClick={() => onBlockSelect?.(block)}
                />
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredBlock && (
            <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 text-xs border border-gray-200 dark:border-gray-700 z-20 pointer-events-none">
              <div className="font-semibold text-gray-900 dark:text-white mb-1">
                ({hoveredBlock.x.toFixed(1)}, {hoveredBlock.y.toFixed(1)}, {hoveredBlock.z.toFixed(1)})
              </div>
              <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                <div>Cu: {hoveredBlock.cu_grade.toFixed(2)}%</div>
                <div>NSR: ${hoveredBlock.nsr_per_tonne.toFixed(2)}/t</div>
                {hoveredBlock.tonnage && <div>{t('tonnage')}: {hoveredBlock.tonnage.toLocaleString()}t</div>}
                <div className={hoveredBlock.is_viable ? 'text-green-600' : 'text-red-600'}>
                  {hoveredBlock.is_viable ? t('viable') : t('inviable')}
                  {' '}(margin: ${hoveredBlock.margin.toFixed(2)})
                </div>
                {hoveredBlock.zone && <div>{t('zone')}: {hoveredBlock.zone}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">{t('legend')}:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> {t('inviable')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> {t('marginal')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> {t('viable')}</span>
        </div>
      </div>
    </div>
  );
}
