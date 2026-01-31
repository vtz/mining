'use client';

import { useState, useEffect } from 'react';
import { MINES_DATA, MineName, NSRInput, fetchMetalPrices, MetalPricesResponse } from '@/lib/api';

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
  
  // Metal prices
  const [cuPrice, setCuPrice] = useState<string>('');
  const [auPrice, setAuPrice] = useState<string>('');
  const [agPrice, setAgPrice] = useState<string>('');
  const [priceSource, setPriceSource] = useState<string>('');
  const [priceIsLive, setPriceIsLive] = useState<boolean>(false);
  const [loadingPrices, setLoadingPrices] = useState<boolean>(true);

  // Fetch live prices on mount
  useEffect(() => {
    const loadPrices = async () => {
      try {
        setLoadingPrices(true);
        const response = await fetchMetalPrices();
        setCuPrice(response.prices.cu.value.toString());
        setAuPrice(response.prices.au.value.toString());
        setAgPrice(response.prices.ag.value.toString());
        setPriceSource(response.metadata.source);
        setPriceIsLive(response.metadata.is_live);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
        // Use defaults
        setCuPrice('6.28');
        setAuPrice('5360');
        setAgPrice('116.39');
        setPriceSource('default');
        setPriceIsLive(false);
      } finally {
        setLoadingPrices(false);
      }
    };
    loadPrices();
  }, []);

  const refreshPrices = async () => {
    try {
      setLoadingPrices(true);
      const response = await fetchMetalPrices(true);
      setCuPrice(response.prices.cu.value.toString());
      setAuPrice(response.prices.au.value.toString());
      setAgPrice(response.prices.ag.value.toString());
      setPriceSource(response.metadata.source);
      setPriceIsLive(response.metadata.is_live);
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

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
      cu_price: cuPrice ? parseFloat(cuPrice) : undefined,
      au_price: auPrice ? parseFloat(auPrice) : undefined,
      ag_price: agPrice ? parseFloat(agPrice) : undefined,
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

      {/* Metal Prices */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Preços dos Metais
            </h2>
            <p className="text-xs text-gray-500">
              {loadingPrices ? 'Carregando...' : (
                <>
                  Fonte: <span className={priceIsLive ? 'text-green-600 font-medium' : 'text-gray-500'}>
                    {priceSource === 'metalpriceapi' ? 'COMEX (tempo real)' : 
                     priceSource === 'default' ? 'Valores padrão' : priceSource}
                  </span>
                  {priceIsLive && <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshPrices}
            disabled={loadingPrices}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {loadingPrices ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        
        {/* Price Disclaimer */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>Disclaimer:</strong> Preços obtidos via{' '}
            <a 
              href="https://www.cmegroup.com/markets/metals.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-amber-900"
            >
              COMEX (CME Group)
            </a>
            , o principal mercado de futuros de metais dos EUA. Os valores representam 
            cotações de contratos futuros e podem diferir dos preços spot. 
            Para decisões financeiras, consulte fontes oficiais e profissionais qualificados.
            {!priceIsLive && priceSource === 'default' && (
              <span className="block mt-1 text-amber-700">
                Preços padrão de Janeiro/2026. Configure a API key para dados em tempo real.
              </span>
            )}
          </p>
        </div>
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
                value={cuPrice}
                onChange={(e) => setCuPrice(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12 text-gray-900"
                placeholder="..."
              />
              <span className="absolute right-3 top-2 text-gray-500">$/lb</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ouro (Au)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={auPrice}
                onChange={(e) => setAuPrice(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12 text-gray-900"
                placeholder="..."
              />
              <span className="absolute right-3 top-2 text-gray-500">$/oz</span>
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
                value={agPrice}
                onChange={(e) => setAgPrice(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12 text-gray-900"
                placeholder="..."
              />
              <span className="absolute right-3 top-2 text-gray-500">$/oz</span>
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
