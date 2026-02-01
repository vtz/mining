'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import NSRForm from '@/components/NSRForm';
import NSRResult from '@/components/NSRResult';
import ScenarioComparison from '@/components/ScenarioComparison';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import SensitivityAnalysis from '@/components/SensitivityAnalysis';
import { saveCalculation } from '@/components/CalculationHistory';
import { useToast } from '@/components/ui/Toast';
import { ResultSkeleton } from '@/components/ui/Skeleton';
import { 
  computeNSR, 
  computeScenarios,
  exportResultCSV,
  NSRInput, 
  NSRResult as NSRResultType,
  ScenarioResult 
} from '@/lib/api';

function HomePage() {
  const t = useTranslations();
  const { success, error: showError } = useToast();
  const [result, setResult] = useState<NSRResultType | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioResult[] | null>(null);
  const [lastInput, setLastInput] = useState<NSRInput | null>(null);
  const [primaryMetal, setPrimaryMetal] = useState<string>('Cu');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScenarios, setShowScenarios] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [variation, setVariation] = useState(10);

  // Keyboard shortcut for calculate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (input: NSRInput, metal: string) => {
    setIsLoading(true);
    setError(null);
    setLastInput(input);
    setPrimaryMetal(metal);
    
    try {
      const response = await computeNSR(input);
      setResult(response);
      setScenarios(null);
      setShowScenarios(false);
      setShowSensitivity(false);
      
      // Save to history
      saveCalculation(input, response, metal);
      
      // Show success toast
      success(t('results.calculated'), `NSR: $${response.nsr_per_tonne.toFixed(2)}/t`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.nsrCalculation');
      setError(message);
      showError(t('errors.calculationFailed'), message);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComputeScenarios = async () => {
    if (!lastInput) return;
    
    setIsLoading(true);
    try {
      const response = await computeScenarios(lastInput, variation);
      setScenarios(response.scenarios);
      setShowScenarios(true);
      success(t('scenarios.generated'), `${response.scenarios.length} ${t('scenarios.scenarios')}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.scenarioCalculation');
      setError(message);
      showError(t('errors.scenarioFailed'), message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!result || !lastInput) return;
    
    try {
      const exportData = {
        ...lastInput,
        ...result,
      };
      await exportResultCSV(exportData as NSRResultType & NSRInput);
      success(t('results.exported'), t('results.exportedDescription'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.exportCSV');
      showError(t('errors.exportFailed'), message);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('header.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('header.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div>
            <NSRForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          {/* Right Column - Results */}
          <div>
            <AnimatePresence mode="wait">
              {isLoading && !result && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ResultSkeleton />
                </motion.div>
              )}

              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                        {t('results.calculationError')}
                      </h3>
                      <p className="mt-2 text-red-700 dark:text-red-300">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        {t('common.dismiss')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {result && !error && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <NSRResult result={result} primaryMetal={primaryMetal} />
                  
                  {/* Action Buttons */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
                          transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {t('results.exportCSV')}
                      </button>
                      
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <input
                          type="number"
                          value={variation}
                          onChange={(e) => setVariation(Number(e.target.value))}
                          className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                            text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                          min="1"
                          max="50"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                        <button
                          onClick={handleComputeScenarios}
                          disabled={isLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                            hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          {t('results.generateScenarios')}
                        </button>
                      </div>

                      <button
                        onClick={() => setShowSensitivity(!showSensitivity)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          showSensitivity
                            ? 'bg-purple-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        {t('results.sensitivity')}
                      </button>
                    </div>
                  </div>

                  {/* Scenario Comparison */}
                  <AnimatePresence>
                    {showScenarios && scenarios && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <ScenarioComparison scenarios={scenarios} variation={variation} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Sensitivity Analysis */}
                  <AnimatePresence>
                    {showSensitivity && lastInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <SensitivityAnalysis 
                          baseInput={lastInput} 
                          baseNSR={result.nsr_per_tonne} 
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {!result && !error && !isLoading && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center"
                >
                  <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                    {t('results.noCalculation')}
                  </h3>
                  <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    {t('results.noCalculationHint')}
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                      Ctrl
                    </kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                      Enter
                    </kbd>
                    <span className="ml-2">{t('common.toCalculate')}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  );
}
