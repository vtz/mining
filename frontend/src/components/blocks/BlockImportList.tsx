'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { BlockImportData } from '@/lib/api';

interface BlockImportListProps {
  imports: BlockImportData[];
  onSelect: (importData: BlockImportData) => void;
  onDelete: (id: string) => void;
  onCalculate: (id: string) => void;
  onExport: (id: string) => void;
}

export default function BlockImportList({
  imports,
  onSelect,
  onDelete,
  onCalculate,
  onExport,
}: BlockImportListProps) {
  const t = useTranslations('blocks');

  if (imports.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">{t('noImports')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {imports.map((bi, idx) => (
        <motion.div
          key={bi.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700
            hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onSelect(bi)}
        >
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {bi.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {bi.mine_name} &middot; {bi.source_filename}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    {bi.block_count.toLocaleString()} {t('blocks')}
                  </span>
                  <span>
                    {new Date(bi.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onCalculate(bi.id)}
                  title={t('calculateNsr')}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => onExport(bi.id)}
                  title={t('exportCsv')}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(bi.id)}
                  title={t('delete')}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
