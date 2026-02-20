'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Mine, PreviewResponse, uploadBlockPreview, uploadBlocks } from '@/lib/api';

interface BlockUploadProps {
  mines: Mine[];
  onImportComplete: () => void;
}

export default function BlockUpload({ mines, onImportComplete }: BlockUploadProps) {
  const t = useTranslations('blocks');
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'mapping' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedMine, setSelectedMine] = useState(mines[0]?.id || '');
  const [importName, setImportName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Update selectedMine when mines load/change
  useEffect(() => {
    if (!selectedMine && mines.length > 0) {
      setSelectedMine(mines[0].id);
    }
  }, [mines, selectedMine]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setImportName(f.name.replace(/\.csv$/i, ''));
    try {
      const prev = await uploadBlockPreview(f);
      setPreview(prev);
      setMapping(prev.suggested_mapping);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && f.name.endsWith('.csv')) handleFile(f);
      else setError(t('errorNotCsv'));
    },
    [handleFile, t],
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleMappingChange = (csvHeader: string, field: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (field === '') {
        delete next[csvHeader];
      } else {
        next[csvHeader] = field;
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!file || !selectedMine) return;
    setStep('importing');
    setError(null);
    try {
      await uploadBlocks(file, selectedMine, importName || file.name, mapping);
      onImportComplete();
      setStep('upload');
      setFile(null);
      setPreview(null);
      setMapping({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('mapping');
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setMapping({});
    setError(null);
  };

  // Check required fields
  const mappedFields = new Set(Object.values(mapping));
  const requiredFields = ['x', 'y', 'z', 'cu_grade'];
  const missingRequired = requiredFields.filter((f) => !mappedFields.has(f));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('uploadTitle')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('uploadDescription')}
        </p>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileSelect}
                />
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  {t('dropCsv')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('orClickToSelect')}
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && preview && (
            <motion.div
              key="mapping"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Import settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('importName')}
                  </label>
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('selectMine')}
                  </label>
                  <select
                    value={selectedMine}
                    onChange={(e) => setSelectedMine(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    {mines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column Mapping */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {t('columnMapping')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">{t('csvColumn')}</th>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">{t('mapTo')}</th>
                        <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">{t('sampleValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.headers.map((header, idx) => (
                        <tr key={header} className="border-t border-gray-200 dark:border-gray-600">
                          <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">
                            {header}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={mapping[header] || ''}
                              onChange={(e) => handleMappingChange(header, e.target.value)}
                              className={`w-full px-2 py-1 border rounded text-xs
                                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                ${mapping[header]
                                  ? 'border-blue-300 dark:border-blue-600'
                                  : 'border-gray-300 dark:border-gray-600'
                                }`}
                            >
                              <option value="">{t('skipColumn')}</option>
                              {preview.known_fields.map((field) => (
                                <option key={field} value={field}>
                                  {field}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {preview.sample_rows[0]?.[idx] || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Validation */}
              {missingRequired.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('missingRequired')}: <strong>{missingRequired.join(', ')}</strong>
                  </p>
                </div>
              )}

              {/* Preview table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('preview')} ({preview.sample_rows.length} {t('rows')})
                </h3>
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        {preview.headers.map((h) => (
                          <th key={h} className="px-2 py-1 text-left text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample_rows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleImport}
                  disabled={missingRequired.length > 0 || !selectedMine}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('importBlocks')} ({file?.name})
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <motion.div
              key="importing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">{t('importing')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
