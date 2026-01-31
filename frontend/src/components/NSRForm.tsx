'use client';

import { useState } from 'react';
import { MINES_DATA, MineName, NSRInput } from '@/lib/api';

interface NSRFormProps {
  onSubmit: (input: NSRInput) => void;
  isLoading: boolean;
}

export default function NSRForm({ onSubmit, isLoading }: NSRFormProps) {
  const [mine, setMine] = useState<MineName>('Vermelhos UG');
  const [area, setArea] = useState<string>('Vermelhos Sul');
  const [cuGrade, setCuGrade] = useState<string>('1.4');
  const [auGrade, setAuGrade] = useState<string>('0.23');
  const [agGrade, setAgGrade] = useState<string>('2.33');
  const [oreTonnage, setOreTonnage] = useState<string>('20000');
  const [mineDilution, setMineDilution] = useState<string>('14');
  const [oreRecovery, setOreRecovery] = useState<string>('98');

  const handleMineChange = (newMine: MineName) => {
    setMine(newMine);
    setArea(MINES_DATA[newMine][0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      mine,
      area,
      cu_grade: parseFloat(cuGrade),
      au_grade: parseFloat(auGrade),
      ag_grade: parseFloat(agGrade),
      ore_tonnage: parseFloat(oreTonnage),
      mine_dilution: parseFloat(mineDilution) / 100,
      ore_recovery: parseFloat(oreRecovery) / 100,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mine/Area Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Seleção de Mina / Área
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mina
            </label>
            <select
              value={mine}
              onChange={(e) => handleMineChange(e.target.value as MineName)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
            >
              {Object.keys(MINES_DATA).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
            >
              {MINES_DATA[mine].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Head Grades */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Teores de Cabeça
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cobre (Cu)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cuGrade}
                onChange={(e) => setCuGrade(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8 text-gray-900"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ouro (Au)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={auGrade}
                onChange={(e) => setAuGrade(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12 text-gray-900"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">g/t</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prata (Ag)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={agGrade}
                onChange={(e) => setAgGrade(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12 text-gray-900"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">g/t</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mine Parameters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Parâmetros de Mina
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tonelagem
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="1"
                value={oreTonnage}
                onChange={(e) => setOreTonnage(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8 text-gray-900"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">t</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Diluição
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={mineDilution}
                onChange={(e) => setMineDilution(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8 text-gray-900"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recuperação de Minério
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={oreRecovery}
                onChange={(e) => setOreRecovery(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8 text-gray-900"
                required
              />
              <span className="absolute right-3 top-2 text-gray-500">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Calculando...
          </span>
        ) : (
          'Calcular NSR'
        )}
      </button>
    </form>
  );
}
