'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BlockData, listBlocks } from '@/lib/api';

interface BlockTableProps {
  importId: string;
  snapshotDate?: string;
  onBlockClick?: (block: BlockData) => void;
}

export default function BlockTable({ importId, snapshotDate, onBlockClick }: BlockTableProps) {
  const t = useTranslations('blocks');

  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);

  // Filters
  const [zoneFilter, setZoneFilter] = useState('');
  const [rockTypeFilter, setRockTypeFilter] = useState('');
  const [cuMin, setCuMin] = useState('');
  const [cuMax, setCuMax] = useState('');
  const [viableOnly, setViableOnly] = useState<boolean | undefined>(undefined);

  // Sort
  const [sortField, setSortField] = useState<string>('cu_grade');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBlocks(importId, {
        zone: zoneFilter || undefined,
        rock_type: rockTypeFilter || undefined,
        cu_min: cuMin ? parseFloat(cuMin) : undefined,
        cu_max: cuMax ? parseFloat(cuMax) : undefined,
        viable_only: viableOnly,
        snapshot_date: snapshotDate,
        page,
        page_size: pageSize,
      });
      setBlocks(data.blocks);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [importId, zoneFilter, rockTypeFilter, cuMin, cuMax, viableOnly, snapshotDate, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side sorting
  const sortedBlocks = [...blocks].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField];
    const bVal = (b as unknown as Record<string, unknown>)[sortField];
    const aNum = typeof aVal === 'number' ? aVal : 0;
    const bNum = typeof bVal === 'number' ? bVal : 0;
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
    </span>
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('tableTitle')}</h3>
      </div>

      {/* Filters */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('zone')}</label>
            <input
              type="text"
              value={zoneFilter}
              onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }}
              placeholder={t('all')}
              className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('rockType')}</label>
            <input
              type="text"
              value={rockTypeFilter}
              onChange={(e) => { setRockTypeFilter(e.target.value); setPage(1); }}
              placeholder={t('all')}
              className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cu Min %</label>
            <input
              type="number"
              step="0.01"
              value={cuMin}
              onChange={(e) => { setCuMin(e.target.value); setPage(1); }}
              className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cu Max %</label>
            <input
              type="number"
              step="0.01"
              value={cuMax}
              onChange={(e) => { setCuMax(e.target.value); setPage(1); }}
              className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('viability')}</label>
            <select
              value={viableOnly === undefined ? '' : viableOnly.toString()}
              onChange={(e) => {
                const v = e.target.value;
                setViableOnly(v === '' ? undefined : v === 'true');
                setPage(1);
              }}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('all')}</option>
              <option value="true">{t('viable')}</option>
              <option value="false">{t('inviable')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              {[
                { key: 'x', label: 'X' },
                { key: 'y', label: 'Y' },
                { key: 'z', label: 'Z' },
                { key: 'cu_grade', label: 'Cu %' },
                { key: 'au_grade', label: 'Au g/t' },
                { key: 'ag_grade', label: 'Ag g/t' },
                { key: 'tonnage', label: t('tonnage') },
                { key: 'nsr_per_tonne', label: 'NSR $/t' },
                { key: 'zone', label: t('zone') },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium cursor-pointer
                    hover:text-gray-900 dark:hover:text-white whitespace-nowrap"
                >
                  {col.label}
                  <SortIcon field={col.key} />
                </th>
              ))}
              <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
                </td>
              </tr>
            ) : sortedBlocks.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                  {t('noBlocks')}
                </td>
              </tr>
            ) : (
              sortedBlocks.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => onBlockClick?.(b)}
                  className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50
                    cursor-pointer transition-colors"
                >
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.x.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.y.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.z.toFixed(1)}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">{b.cu_grade.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.au_grade?.toFixed(2) ?? '—'}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.ag_grade?.toFixed(2) ?? '—'}</td>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                    {b.tonnage?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">
                    {b.nsr_per_tonne !== undefined ? `$${b.nsr_per_tonne.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{b.zone ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    {b.is_viable !== undefined && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium
                          ${b.is_viable
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}
                      >
                        {b.is_viable ? t('viable') : t('inviable')}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <span>
            {t('showing')} {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} {t('of')} {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              &laquo;
            </button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
