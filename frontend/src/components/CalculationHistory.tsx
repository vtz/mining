'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { NSRInput, NSRResult } from '@/lib/api';

interface CalculationRecord {
  id: string;
  timestamp: Date;
  input: NSRInput;
  result: NSRResult;
  primaryMetal: string;
}

interface CalculationHistoryProps {
  onSelect?: (record: CalculationRecord) => void;
  onCompare?: (records: CalculationRecord[]) => void;
  maxItems?: number;
}

// Local storage key
const STORAGE_KEY = 'nsr_calculation_history';

// Helper to save to local storage
export function saveCalculation(input: NSRInput, result: NSRResult, primaryMetal: string) {
  const records = getCalculationHistory();
  const newRecord: CalculationRecord = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    timestamp: new Date(),
    input,
    result,
    primaryMetal,
  };
  
  records.unshift(newRecord);
  
  // Keep only last 50 records
  const trimmed = records.slice(0, 50);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
  
  return newRecord;
}

// Helper to get history
export function getCalculationHistory(): CalculationRecord[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const records = JSON.parse(stored);
    return records.map((r: CalculationRecord & { timestamp: string }) => ({
      ...r,
      timestamp: new Date(r.timestamp),
    }));
  } catch {
    return [];
  }
}

// Helper to clear history
export function clearCalculationHistory() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export default function CalculationHistory({ onSelect, onCompare, maxItems = 10 }: CalculationHistoryProps) {
  const t = useTranslations('history');
  const [records, setRecords] = useState<CalculationRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    setRecords(getCalculationHistory());
  }, []);

  const handleSelect = (record: CalculationRecord) => {
    if (isCompareMode) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(record.id)) {
        newSelected.delete(record.id);
      } else if (newSelected.size < 3) {
        newSelected.add(record.id);
      }
      setSelectedIds(newSelected);
    } else {
      onSelect?.(record);
    }
  };

  const handleCompare = () => {
    const selected = records.filter(r => selectedIds.has(r.id));
    onCompare?.(selected);
  };

  const handleClear = () => {
    if (confirm(t('confirmClear'))) {
      clearCalculationHistory();
      setRecords([]);
    }
  };

  const handleDelete = (id: string) => {
    const newRecords = records.filter(r => r.id !== id);
    setRecords(newRecords);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
    }
  };

  const filteredRecords = records
    .filter(r => 
      !filter || 
      r.input.mine.toLowerCase().includes(filter.toLowerCase()) ||
      r.input.area.toLowerCase().includes(filter.toLowerCase())
    )
    .slice(0, maxItems);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{t('noHistory')}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('noHistoryDescription')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('title')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsCompareMode(!isCompareMode);
                setSelectedIds(new Set());
              }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isCompareMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('compare')}
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              {t('clearAll')}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Compare action bar */}
      <AnimatePresence>
        {isCompareMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {t('selectedCount', { count: selectedIds.size })}
              </span>
              <button
                onClick={handleCompare}
                disabled={selectedIds.size < 2}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('compareSelected')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Records list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
        <AnimatePresence>
          {filteredRecords.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelect(record)}
              className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                selectedIds.has(record.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox for compare mode */}
                {isCompareMode && (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(record.id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedIds.has(record.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}

                {/* Metal badge */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                  record.primaryMetal === 'Cu' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                  record.primaryMetal === 'Au' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {record.primaryMetal}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {record.input.mine}
                    </p>
                    <span className="text-gray-400 dark:text-gray-500">•</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {record.input.area}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>{format(record.timestamp, 'dd/MM/yyyy HH:mm')}</span>
                    <span>Cu: {record.input.cu_grade}%</span>
                    {record.input.au_grade > 0 && <span>Au: {record.input.au_grade} g/t</span>}
                  </div>
                </div>

                {/* NSR Value */}
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(record.result.nsr_per_tonne)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">/t</p>
                </div>

                {/* Delete button */}
                {!isCompareMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(record.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Show more */}
      {records.length > maxItems && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('showingCount', { shown: maxItems, total: records.length })}
          </span>
        </div>
      )}
    </div>
  );
}
