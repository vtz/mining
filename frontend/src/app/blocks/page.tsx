'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import BlockUpload from '@/components/blocks/BlockUpload';
import BlockImportList from '@/components/blocks/BlockImportList';
import BlockHeatmap from '@/components/blocks/BlockHeatmap';
import ViabilityScatter from '@/components/blocks/ViabilityScatter';
import ViabilityTimeline from '@/components/blocks/ViabilityTimeline';
import BlockTable from '@/components/blocks/BlockTable';
import { useFeatures } from '@/hooks/useFeatures';
import {
  BlockImportData,
  BlockData,
  listBlockImports,
  deleteBlockImport,
  calculateBlockNsr,
  exportBlocksCsv,
  fetchBlockStats,
  listBlocks,
} from '@/lib/api';

type Tab = 'imports' | 'heatmap' | 'scatter' | 'timeline' | 'table';

function BlocksPage() {
  const t = useTranslations('blocks');
  const { minesWithFeature, hasFeature, isLoading: featuresLoading } = useFeatures();

  const enabledMines = minesWithFeature('block_model');
  const featureEnabled = hasFeature('block_model');

  const [imports, setImports] = useState<BlockImportData[]>([]);
  const [selectedImport, setSelectedImport] = useState<BlockImportData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('imports');
  const [loading, setLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [cutoffCost, setCutoffCost] = useState(45);

  // For scatter - need block data with NSR
  const [scatterBlocks, setScatterBlocks] = useState<BlockData[]>([]);
  const [scatterCutoff, setScatterCutoff] = useState(0);

  const refreshImports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBlockImports();
      setImports(data.imports);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (featureEnabled) {
      refreshImports();
    }
  }, [featureEnabled, refreshImports]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('delete') + '?')) return;
    try {
      await deleteBlockImport(id);
      if (selectedImport?.id === id) setSelectedImport(null);
      refreshImports();
    } catch {
      // ignore
    }
  };

  const handleCalculate = async (importId: string) => {
    setCalcLoading(true);
    try {
      await calculateBlockNsr(importId, { cutoff_cost: cutoffCost });
      // Reload scatter data if active
      if (activeTab === 'scatter' && selectedImport?.id === importId) {
        loadScatterData(importId);
      }
    } catch {
      // ignore
    } finally {
      setCalcLoading(false);
    }
  };

  const handleExport = async (id: string) => {
    try {
      await exportBlocksCsv(id);
    } catch {
      // ignore
    }
  };

  const loadScatterData = async (importId: string) => {
    try {
      const statsData = await fetchBlockStats(importId);
      const snapshotDate = statsData.snapshot_date;
      const blocksData = await listBlocks(importId, {
        page_size: 1000,
        snapshot_date: snapshotDate,
      });
      setScatterBlocks(blocksData.blocks);
      setScatterCutoff(statsData.cutoff_cost);
    } catch {
      setScatterBlocks([]);
    }
  };

  const handleSelectImport = (bi: BlockImportData) => {
    setSelectedImport(bi);
    setActiveTab('heatmap');
  };

  useEffect(() => {
    if (selectedImport && activeTab === 'scatter') {
      loadScatterData(selectedImport.id);
    }
  }, [selectedImport, activeTab]);

  // Feature not enabled
  if (!featuresLoading && !featureEnabled) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('featureDisabled')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {t('contactAdmin')}
          </p>
        </div>
      </AppLayout>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'imports', label: t('tabs.imports') },
    { key: 'heatmap', label: t('tabs.heatmap') },
    { key: 'scatter', label: t('tabs.scatter') },
    { key: 'timeline', label: t('tabs.timeline') },
    { key: 'table', label: t('tabs.table') },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('pageDescription')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              disabled={tab.key !== 'imports' && !selectedImport}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }
                ${tab.key !== 'imports' && !selectedImport ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {tab.label}
            </button>
          ))}

          {/* Calculate button (when an import is selected) */}
          {selectedImport && (
            <div className="ml-auto flex items-center gap-2">
              <input
                type="number"
                value={cutoffCost}
                onChange={(e) => setCutoffCost(Number(e.target.value))}
                className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="$/t"
              />
              <button
                onClick={() => handleCalculate(selectedImport.id)}
                disabled={calcLoading}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700
                  disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {calcLoading ? t('calculating') : t('calculateNsr')}
              </button>
            </div>
          )}
        </div>

        {/* Selected import indicator */}
        {selectedImport && activeTab !== 'imports' && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{t('selectImport')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{selectedImport.name}</span>
            <span className="text-gray-400">({selectedImport.block_count.toLocaleString()} {t('blocks')})</span>
            <button
              onClick={() => { setSelectedImport(null); setActiveTab('imports'); }}
              className="text-blue-600 hover:underline ml-2"
            >
              {t('cancel')}
            </button>
          </div>
        )}

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'imports' && (
            <motion.div
              key="imports"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <BlockUpload mines={enabledMines} onImportComplete={refreshImports} />
              <BlockImportList
                imports={imports}
                onSelect={handleSelectImport}
                onDelete={handleDelete}
                onCalculate={handleCalculate}
                onExport={handleExport}
              />
            </motion.div>
          )}

          {activeTab === 'heatmap' && selectedImport && (
            <motion.div key="heatmap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BlockHeatmap importId={selectedImport.id} />
            </motion.div>
          )}

          {activeTab === 'scatter' && selectedImport && (
            <motion.div key="scatter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ViabilityScatter blocks={scatterBlocks} cutoffCost={scatterCutoff || cutoffCost} />
            </motion.div>
          )}

          {activeTab === 'timeline' && selectedImport && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ViabilityTimeline importId={selectedImport.id} />
            </motion.div>
          )}

          {activeTab === 'table' && selectedImport && (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BlockTable importId={selectedImport.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

export default function BlocksPageWrapper() {
  return (
    <ProtectedRoute>
      <BlocksPage />
    </ProtectedRoute>
  );
}
