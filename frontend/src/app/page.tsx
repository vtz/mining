'use client';

import { useState } from 'react';
import NSRForm from '@/components/NSRForm';
import NSRResult from '@/components/NSRResult';
import ScenarioComparison from '@/components/ScenarioComparison';
import { 
  computeNSR, 
  computeScenarios,
  exportResultCSV,
  NSRInput, 
  NSRResult as NSRResultType,
  ScenarioResult 
} from '@/lib/api';

export default function Home() {
  const [result, setResult] = useState<NSRResultType | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioResult[] | null>(null);
  const [lastInput, setLastInput] = useState<NSRInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScenarios, setShowScenarios] = useState(false);
  const [variation, setVariation] = useState(10);

  const handleSubmit = async (input: NSRInput) => {
    setIsLoading(true);
    setError(null);
    setLastInput(input);
    
    try {
      const response = await computeNSR(input);
      setResult(response);
      setScenarios(null);
      setShowScenarios(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular NSR');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular cenários');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar CSV');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                NSR Calculator
              </h1>
              <p className="text-sm text-gray-500">
                Mina Caraíba - Net Smelter Return
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                MVP v0.1.0
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Parâmetros de Entrada
            </h2>
            <NSRForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          {/* Right Column - Results */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Resultados
            </h2>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Erro no cálculo
                    </h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {result ? (
              <>
                <NSRResult result={result} />
                
                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar CSV
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={variation}
                      onChange={(e) => setVariation(Number(e.target.value))}
                      className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                      min="1"
                      max="50"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <button
                      onClick={handleComputeScenarios}
                      disabled={isLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Gerar Cenários
                    </button>
                  </div>
                </div>

                {/* Scenario Comparison */}
                {showScenarios && scenarios && (
                  <div className="mt-6">
                    <ScenarioComparison scenarios={scenarios} variation={variation} />
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Nenhum cálculo realizado
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Preencha os parâmetros e clique em &quot;Calcular NSR&quot; para ver os
                  resultados.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            NSR Calculator — Substituindo Excel por confiabilidade
          </p>
        </div>
      </footer>
    </div>
  );
}
