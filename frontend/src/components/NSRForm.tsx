'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  MINES_DATA_FALLBACK, 
  NSRInput, 
  fetchMetalPrices, 
  fetchPriceProviders,
  setManualPrices,
  PriceProvider,
  fetchMines,
  buildMinesData,
  Mine,
} from '@/lib/api';

interface NSRFormProps {
  onSubmit: (input: NSRInput, primaryMetal: string) => void;
  isLoading: boolean;
}

// Determine which metals to show based on primary metal
function getMetalsForMine(primaryMetal: string): { cu: boolean; au: boolean; ag: boolean; isImplemented: boolean } {
  switch (primaryMetal) {
    case 'Au': // Gold mine - show Au, maybe Ag
      return { cu: false, au: true, ag: true, isImplemented: false };
    case 'Ag': // Silver mine
      return { cu: false, au: true, ag: true, isImplemented: false };
    case 'Ni': // Nickel mine - show Ni as Cu placeholder for now (not fully implemented)
      return { cu: true, au: false, ag: false, isImplemented: false };
    case 'Zn': // Zinc mine
      return { cu: true, au: false, ag: true, isImplemented: false };
    case 'Fe': // Iron mine
      return { cu: true, au: false, ag: false, isImplemented: false };
    case 'Cu': // Copper mine - show all (Cu is primary, Au/Ag as byproducts)
      return { cu: true, au: true, ag: true, isImplemented: true };
    default:
      return { cu: true, au: true, ag: true, isImplemented: true };
  }
}

// Get metal display name for non-copper primary metals
function getMetalDisplayName(primaryMetal: string): string {
  switch (primaryMetal) {
    case 'Ni': return 'Níquel (Ni)';
    case 'Zn': return 'Zinco (Zn)';
    case 'Fe': return 'Ferro (Fe)';
    default: return 'Cobre (Cu)';
  }
}

export default function NSRForm({ onSubmit, isLoading }: NSRFormProps) {
  const t = useTranslations('form');
  
  // Mines data - dynamically loaded
  const [minesData, setMinesData] = useState<Record<string, string[]>>(MINES_DATA_FALLBACK);
  const [minesList, setMinesList] = useState<Mine[]>([]);
  const [loadingMines, setLoadingMines] = useState<boolean>(true);
  
  const [mine, setMine] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [primaryMetal, setPrimaryMetal] = useState<string>('Cu');
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
  
  // Price providers
  const [providers, setProviders] = useState<PriceProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState<boolean>(false);

  // Fetch mines on mount
  useEffect(() => {
    const loadMines = async () => {
      try {
        setLoadingMines(true);
        const response = await fetchMines();
        setMinesList(response.mines);
        const dynamicMinesData = buildMinesData(response.mines);
        
        // Use dynamic data if we got mines, otherwise fall back
        if (Object.keys(dynamicMinesData).length > 0) {
          setMinesData(dynamicMinesData);
          // Set initial mine and area from dynamic data
          const firstMine = Object.keys(dynamicMinesData)[0];
          setMine(firstMine);
          setArea(dynamicMinesData[firstMine][0]);
          // Set primary metal from first mine
          const firstMineData = response.mines.find((m: Mine) => m.name === firstMine);
          if (firstMineData) {
            setPrimaryMetal(firstMineData.primary_metal);
          }
        } else {
          // Fall back to static data
          setMinesData(MINES_DATA_FALLBACK);
          const firstMine = Object.keys(MINES_DATA_FALLBACK)[0];
          setMine(firstMine);
          setArea(MINES_DATA_FALLBACK[firstMine][0]);
        }
      } catch (error) {
        console.error('Failed to fetch mines:', error);
        // Fall back to static data
        setMinesData(MINES_DATA_FALLBACK);
        const firstMine = Object.keys(MINES_DATA_FALLBACK)[0];
        setMine(firstMine);
        setArea(MINES_DATA_FALLBACK[firstMine][0]);
      } finally {
        setLoadingMines(false);
      }
    };
    loadMines();
  }, []);

  // Fetch providers and prices on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingPrices(true);
        
        // Load providers
        const providersResponse = await fetchPriceProviders();
        setProviders(providersResponse.providers);
        
        // Find default provider
        const defaultProvider = providersResponse.providers.find(p => p.is_default);
        if (defaultProvider) {
          setSelectedProvider(defaultProvider.name);
        }
        
        // Load prices
        const pricesResponse = await fetchMetalPrices();
        setCuPrice(pricesResponse.prices.cu.value.toString());
        setAuPrice(pricesResponse.prices.au.value.toString());
        setAgPrice(pricesResponse.prices.ag.value.toString());
        setPriceSource(pricesResponse.metadata.source);
        setPriceIsLive(pricesResponse.metadata.is_live);
      } catch (error) {
        console.error('Failed to fetch data:', error);
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
    loadData();
  }, []);

  const handleProviderChange = async (providerName: string) => {
    setSelectedProvider(providerName);
    setIsManualMode(providerName === 'manual');
    
    if (providerName !== 'manual') {
      try {
        setLoadingPrices(true);
        const response = await fetchMetalPrices(providerName);
        setCuPrice(response.prices.cu.value.toString());
        setAuPrice(response.prices.au.value.toString());
        setAgPrice(response.prices.ag.value.toString());
        setPriceSource(response.metadata.source);
        setPriceIsLive(response.metadata.is_live);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      } finally {
        setLoadingPrices(false);
      }
    } else {
      // Manual mode - keep current prices editable
      setPriceSource('manual');
      setPriceIsLive(false);
    }
  };

  const refreshPrices = async () => {
    if (isManualMode) return;
    
    try {
      setLoadingPrices(true);
      const response = await fetchMetalPrices(selectedProvider, true);
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

  const saveManualPrices = async () => {
    try {
      await setManualPrices(
        parseFloat(cuPrice),
        parseFloat(auPrice),
        parseFloat(agPrice),
        'Set via UI'
      );
      setPriceSource('manual');
    } catch (error) {
      console.error('Failed to save manual prices:', error);
    }
  };

  const handleMineChange = (newMine: string) => {
    setMine(newMine);
    if (minesData[newMine] && minesData[newMine].length > 0) {
      setArea(minesData[newMine][0]);
    }
    // Update primary metal based on selected mine
    const selectedMine = minesList.find((m) => m.name === newMine);
    if (selectedMine) {
      setPrimaryMetal(selectedMine.primary_metal);
    }
  };

  // Get metals visibility based on current mine
  const metalsToShow = getMetalsForMine(primaryMetal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      mine,
      area,
      cu_grade: metalsToShow.cu ? parseFloat(cuGrade) : 0,
      au_grade: metalsToShow.au ? parseFloat(auGrade) : 0,
      ag_grade: metalsToShow.ag ? parseFloat(agGrade) : 0,
      ore_tonnage: parseFloat(oreTonnage),
      mine_dilution: parseFloat(mineDilution) / 100,
      ore_recovery: parseFloat(oreRecovery) / 100,
      cu_price: cuPrice ? parseFloat(cuPrice) : undefined,
      au_price: auPrice ? parseFloat(auPrice) : undefined,
      ag_price: agPrice ? parseFloat(agPrice) : undefined,
    }, primaryMetal);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mine/Area Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('mineSelection')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mine')}
            </label>
            <select
              value={mine}
              onChange={(e) => handleMineChange(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              disabled={loadingMines}
            >
              {loadingMines ? (
                <option value="">Carregando...</option>
              ) : (
                Object.keys(minesData).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('area')}
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
              disabled={loadingMines}
            >
              {loadingMines ? (
                <option value="">Carregando...</option>
              ) : (
                (minesData[mine] || []).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Head Grades */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('headGrades')}
        </h2>
        
        {/* Warning for non-implemented metals */}
        {!metalsToShow.isImplemented && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <span className="font-medium">Modo Demo:</span> Cálculo NSR para {getMetalDisplayName(primaryMetal)} ainda não está totalmente implementado. 
              Os valores são simulados usando parâmetros de cobre.
            </p>
          </div>
        )}
        
        <div className={`grid grid-cols-1 gap-4 ${
          [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 3 
            ? 'md:grid-cols-3' 
            : [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 2 
              ? 'md:grid-cols-2' 
              : ''
        }`}>
          {metalsToShow.cu && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {primaryMetal === 'Cu' ? t('copper') : getMetalDisplayName(primaryMetal)}
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
          )}
          {metalsToShow.au && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('gold')}
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
          )}
          {metalsToShow.ag && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('silver')}
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
          )}
        </div>
      </div>

      {/* Metal Prices */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t('metalPrices')}
            </h2>
            <p className="text-xs text-gray-500">
              {loadingPrices ? t('refreshing') : (
                <>
                  {t('source')}: <span className={priceIsLive ? 'text-green-600 font-medium' : 'text-gray-500'}>
                    {priceSource === 'metalpriceapi' ? t('comexRealtime') : 
                     priceSource === 'manual' ? t('manual') :
                     priceSource === 'default' ? t('defaultValues') : priceSource}
                  </span>
                  {priceIsLive && <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isManualMode && (
              <button
                type="button"
                onClick={saveManualPrices}
                className="text-sm text-green-600 hover:text-green-800"
              >
                {t('save', { ns: 'common' })}
              </button>
            )}
            {!isManualMode && (
              <button
                type="button"
                onClick={refreshPrices}
                disabled={loadingPrices}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                {loadingPrices ? t('refreshing') : t('refresh')}
              </button>
            )}
          </div>
        </div>

        {/* Provider Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('priceSource')}
          </label>
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <button
                key={provider.name}
                type="button"
                onClick={() => handleProviderChange(provider.name)}
                disabled={!provider.is_available && provider.name !== 'manual'}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  selectedProvider === provider.name
                    ? 'bg-blue-600 text-white border-blue-600'
                    : provider.is_available || provider.name === 'manual'
                    ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                }`}
                title={provider.description}
              >
                {provider.display_name}
                {!provider.is_available && provider.name !== 'manual' && (
                  <span className="ml-1 text-xs">{t('noApiKey')}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Price Disclaimer */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            {isManualMode ? (
              <>{t('manualModeDescription')}</>
            ) : (
              <>
                {t('priceDisclaimer')}
                {!priceIsLive && priceSource === 'default' && (
                  <span className="block mt-1 text-amber-700">
                    {t('defaultPricesNotice')}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div className={`grid grid-cols-1 gap-4 ${
          [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 3 
            ? 'md:grid-cols-3' 
            : [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 2 
              ? 'md:grid-cols-2' 
              : ''
        }`}>
          {metalsToShow.cu && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {primaryMetal === 'Cu' ? t('copper') : getMetalDisplayName(primaryMetal)}
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
          )}
          {metalsToShow.au && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('gold')}
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
          )}
          {metalsToShow.ag && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('silver')}
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
          )}
        </div>
      </div>

      {/* Mine Parameters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('mineParameters')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tonnage')}
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
              {t('dilution')}
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
              {t('oreRecovery')}
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
            {t('calculating')}
          </span>
        ) : (
          t('calculateNSR')
        )}
      </button>
    </form>
  );
}
