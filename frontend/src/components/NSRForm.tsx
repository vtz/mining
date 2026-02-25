'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Tabs, TabList, Tab, TabPanels, TabPanel } from './ui/Tabs';
import { InfoTooltip } from './ui/Tooltip';
import { Slider } from './ui/Slider';
import { Skeleton } from './ui/Skeleton';

interface NSRFormProps {
  onSubmit: (input: NSRInput, primaryMetal: string) => void;
  isLoading: boolean;
}

// Determine which metals to show based on primary metal
function getMetalsForMine(primaryMetal: string): { cu: boolean; au: boolean; ag: boolean; isImplemented: boolean } {
  switch (primaryMetal) {
    case 'Au':
      return { cu: false, au: true, ag: true, isImplemented: false };
    case 'Ag':
      return { cu: false, au: true, ag: true, isImplemented: false };
    case 'Ni':
      return { cu: true, au: false, ag: false, isImplemented: false };
    case 'Zn':
      return { cu: true, au: false, ag: true, isImplemented: false };
    case 'Fe':
      return { cu: true, au: false, ag: false, isImplemented: false };
    case 'Cu':
      return { cu: true, au: true, ag: true, isImplemented: true };
    default:
      return { cu: true, au: true, ag: true, isImplemented: true };
  }
}

function getMetalDisplayName(primaryMetal: string): string {
  switch (primaryMetal) {
    case 'Ni': return 'Níquel (Ni)';
    case 'Zn': return 'Zinco (Zn)';
    case 'Fe': return 'Ferro (Fe)';
    default: return 'Cobre (Cu)';
  }
}

// Input field component with tooltip
interface FormFieldProps {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}

function FormField({ label, tooltip, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1 mb-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      {children}
    </div>
  );
}

// Number input with unit
interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  unit: string;
  step?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

function NumberInput({ value, onChange, unit, step = '0.01', min = '0', max, placeholder, required, disabled }: NumberInputProps) {
  return (
    <div className="relative">
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white 
          shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12 
          disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
        {unit}
      </span>
    </div>
  );
}

export default function NSRForm({ onSubmit, isLoading }: NSRFormProps) {
  const t = useTranslations('form');
  
  // Mines data
  const [minesData, setMinesData] = useState<Record<string, string[]>>(MINES_DATA_FALLBACK);
  const [minesList, setMinesList] = useState<Mine[]>([]);
  const [loadingMines, setLoadingMines] = useState<boolean>(true);
  
  // Form state
  const [mine, setMine] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [primaryMetal, setPrimaryMetal] = useState<string>('Cu');
  const [cuGrade, setCuGrade] = useState<string>('1.4');
  const [auGrade, setAuGrade] = useState<string>('0.23');
  const [agGrade, setAgGrade] = useState<string>('2.33');
  const [oreTonnage, setOreTonnage] = useState<string>('20000');
  const [mineDilution, setMineDilution] = useState<number>(14);
  const [oreRecovery, setOreRecovery] = useState<number>(98);
  
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

  // Operational costs (EBITDA — always enabled)
  const [mineCost, setMineCost] = useState<string>('28');
  const [developmentCost, setDevelopmentCost] = useState<string>('2257');
  const [developmentMeters, setDevelopmentMeters] = useState<string>('50');
  const [haulCost, setHaulCost] = useState<string>('13.57');
  const [plantCost, setPlantCost] = useState<string>('7.4');
  const [gaCost, setGaCost] = useState<string>('5');

  // Active tab
  const [activeTab, setActiveTab] = useState<string>('location');

  // Fetch mines on mount
  useEffect(() => {
    const loadMines = async () => {
      try {
        setLoadingMines(true);
        const response = await fetchMines();
        setMinesList(response.mines);
        const dynamicMinesData = buildMinesData(response.mines);
        
        if (Object.keys(dynamicMinesData).length > 0) {
          setMinesData(dynamicMinesData);
          const firstMine = Object.keys(dynamicMinesData)[0];
          setMine(firstMine);
          setArea(dynamicMinesData[firstMine][0]);
          const firstMineData = response.mines.find((m: Mine) => m.name === firstMine);
          if (firstMineData) {
            setPrimaryMetal(firstMineData.primary_metal);
          }
        } else {
          setMinesData(MINES_DATA_FALLBACK);
          const firstMine = Object.keys(MINES_DATA_FALLBACK)[0];
          setMine(firstMine);
          setArea(MINES_DATA_FALLBACK[firstMine][0]);
        }
      } catch (error) {
        console.error('Failed to fetch mines:', error);
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

  // Fetch providers and prices
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingPrices(true);
        
        const providersResponse = await fetchPriceProviders();
        setProviders(providersResponse.providers);
        
        const defaultProvider = providersResponse.providers.find(p => p.is_default);
        if (defaultProvider) {
          setSelectedProvider(defaultProvider.name);
        }
        
        const pricesResponse = await fetchMetalPrices();
        setCuPrice(pricesResponse.prices.cu.value.toString());
        setAuPrice(pricesResponse.prices.au.value.toString());
        setAgPrice(pricesResponse.prices.ag.value.toString());
        setPriceSource(pricesResponse.metadata.source);
        setPriceIsLive(pricesResponse.metadata.is_live);
      } catch (error) {
        console.error('Failed to fetch data:', error);
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
    const selectedMine = minesList.find((m) => m.name === newMine);
    if (selectedMine) {
      setPrimaryMetal(selectedMine.primary_metal);
    }
  };

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
      mine_dilution: mineDilution / 100,
      ore_recovery: oreRecovery / 100,
      cu_price: cuPrice ? parseFloat(cuPrice) : undefined,
      au_price: auPrice ? parseFloat(auPrice) : undefined,
      ag_price: agPrice ? parseFloat(agPrice) : undefined,
      mine_cost: mineCost ? parseFloat(mineCost) : undefined,
      development_cost: developmentCost ? parseFloat(developmentCost) : undefined,
      development_meters: developmentMeters ? parseFloat(developmentMeters) : undefined,
      haul_cost: haulCost ? parseFloat(haulCost) : undefined,
      plant_cost: plantCost ? parseFloat(plantCost) : undefined,
      ga_cost: gaCost ? parseFloat(gaCost) : undefined,
    }, primaryMetal);
  };

  // Calculate estimated NSR preview (simplified)
  const estimatedNSR = cuPrice && cuGrade 
    ? (parseFloat(cuGrade) * parseFloat(cuPrice) * 22.0462 * 0.9 * (1 - mineDilution/100) * (oreRecovery/100)).toFixed(2)
    : '--';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* NSR Preview Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl p-4 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide">{t('estimatedNSR')}</p>
            <p className="text-3xl font-bold">
              ${estimatedNSR}
              <span className="text-lg font-normal text-blue-200 ml-1">/t</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-xs">{t('clickToCalculate')}</p>
            <p className="text-sm text-blue-100">{mine} • {area}</p>
          </div>
        </div>
      </motion.div>

      {/* Tabbed Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <Tabs defaultTab="location" onChange={setActiveTab}>
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 pt-4">
            <TabList className="gap-1 -mb-px">
              <Tab value="location" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }>
                {t('location')}
              </Tab>
              <Tab value="grades" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              }>
                {t('grades')}
              </Tab>
              <Tab value="prices" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }>
                {t('prices')}
              </Tab>
              <Tab value="parameters" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }>
                {t('parameters')}
              </Tab>
              <Tab value="costs" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }>
                {t('costs')}
              </Tab>
            </TabList>
          </div>

          <TabPanels className="p-6">
            {/* Location Tab */}
            <TabPanel value="location">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label={t('mine')} tooltip={t('mineTooltip')}>
                    {loadingMines ? (
                      <Skeleton variant="rectangular" height={42} />
                    ) : (
                      <select
                        value={mine}
                        onChange={(e) => handleMineChange(e.target.value)}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white 
                          shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {Object.keys(minesData).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    )}
                  </FormField>

                  <FormField label={t('area')} tooltip={t('areaTooltip')}>
                    {loadingMines ? (
                      <Skeleton variant="rectangular" height={42} />
                    ) : (
                      <select
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white 
                          shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {(minesData[mine] || []).map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    )}
                  </FormField>
                </div>

                {/* Mine Info Card */}
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{primaryMetal}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{mine}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('primaryMetal')}: {getMetalDisplayName(primaryMetal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* Grades Tab */}
            <TabPanel value="grades">
              <div className="space-y-4">
                {!metalsToShow.isImplemented && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <span className="font-medium">Modo Demo:</span> Cálculo NSR para {getMetalDisplayName(primaryMetal)} ainda não está totalmente implementado.
                    </p>
                  </div>
                )}

                <div className={`grid gap-6 ${
                  [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 3 
                    ? 'md:grid-cols-3' 
                    : [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 2 
                      ? 'md:grid-cols-2' 
                      : ''
                }`}>
                  {metalsToShow.cu && (
                    <FormField 
                      label={primaryMetal === 'Cu' ? t('copper') : getMetalDisplayName(primaryMetal)}
                      tooltip={t('gradeTooltip')}
                    >
                      <NumberInput
                        value={cuGrade}
                        onChange={setCuGrade}
                        unit="%"
                        step="0.01"
                        max="100"
                        required
                      />
                    </FormField>
                  )}

                  {metalsToShow.au && (
                    <FormField label={t('gold')} tooltip={t('goldGradeTooltip')}>
                      <NumberInput
                        value={auGrade}
                        onChange={setAuGrade}
                        unit="g/t"
                        step="0.01"
                        required
                      />
                    </FormField>
                  )}

                  {metalsToShow.ag && (
                    <FormField label={t('silver')} tooltip={t('silverGradeTooltip')}>
                      <NumberInput
                        value={agGrade}
                        onChange={setAgGrade}
                        unit="g/t"
                        step="0.01"
                        required
                      />
                    </FormField>
                  )}
                </div>
              </div>
            </TabPanel>

            {/* Prices Tab */}
            <TabPanel value="prices">
              <div className="space-y-4">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('priceSource')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {providers.map((provider) => (
                      <button
                        key={provider.name}
                        type="button"
                        onClick={() => handleProviderChange(provider.name)}
                        disabled={!provider.is_available && provider.name !== 'manual'}
                        className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                          selectedProvider === provider.name
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : provider.is_available || provider.name === 'manual'
                            ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                        }`}
                        title={provider.description}
                      >
                        {provider.display_name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Status */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${priceIsLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {priceSource === 'metalpriceapi' ? t('comexRealtime') : 
                       priceSource === 'manual' ? t('manual') :
                       priceSource === 'default' ? t('defaultValues') : priceSource}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {isManualMode && (
                      <button
                        type="button"
                        onClick={saveManualPrices}
                        className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      >
                        {t('save')}
                      </button>
                    )}
                    {!isManualMode && (
                      <button
                        type="button"
                        onClick={refreshPrices}
                        disabled={loadingPrices}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                      >
                        {loadingPrices ? t('refreshing') : t('refresh')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Price Inputs */}
                <div className={`grid gap-6 ${
                  [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 3 
                    ? 'md:grid-cols-3' 
                    : [metalsToShow.cu, metalsToShow.au, metalsToShow.ag].filter(Boolean).length === 2 
                      ? 'md:grid-cols-2' 
                      : ''
                }`}>
                  {metalsToShow.cu && (
                    <FormField 
                      label={primaryMetal === 'Cu' ? t('copper') : getMetalDisplayName(primaryMetal)}
                    >
                      <NumberInput
                        value={cuPrice}
                        onChange={setCuPrice}
                        unit="$/lb"
                        placeholder="..."
                        disabled={!isManualMode && loadingPrices}
                      />
                    </FormField>
                  )}

                  {metalsToShow.au && (
                    <FormField label={t('gold')}>
                      <NumberInput
                        value={auPrice}
                        onChange={setAuPrice}
                        unit="$/oz"
                        step="1"
                        placeholder="..."
                        disabled={!isManualMode && loadingPrices}
                      />
                    </FormField>
                  )}

                  {metalsToShow.ag && (
                    <FormField label={t('silver')}>
                      <NumberInput
                        value={agPrice}
                        onChange={setAgPrice}
                        unit="$/oz"
                        placeholder="..."
                        disabled={!isManualMode && loadingPrices}
                      />
                    </FormField>
                  )}
                </div>

                {/* Price Disclaimer */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isManualMode ? t('manualModeDescription') : t('priceDisclaimer')}
                </p>
              </div>
            </TabPanel>

            {/* Parameters Tab */}
            <TabPanel value="parameters">
              <div className="space-y-6">
                <FormField label={t('tonnage')} tooltip={t('tonnageTooltip')}>
                  <NumberInput
                    value={oreTonnage}
                    onChange={setOreTonnage}
                    unit="t"
                    step="1"
                    min="1"
                    required
                  />
                </FormField>

                <Slider
                  value={mineDilution}
                  min={0}
                  max={50}
                  step={1}
                  onChange={setMineDilution}
                  label={t('dilution')}
                  unit="%"
                />

                <Slider
                  value={oreRecovery}
                  min={50}
                  max={100}
                  step={1}
                  onChange={setOreRecovery}
                  label={t('oreRecovery')}
                  unit="%"
                />
              </div>
            </TabPanel>

            {/* Costs Tab (EBITDA) */}
            <TabPanel value="costs">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label={t('mineCost')} tooltip={t('mineCostTooltip')}>
                    <NumberInput
                      value={mineCost}
                      onChange={setMineCost}
                      unit="$/t"
                      step="0.01"
                    />
                  </FormField>

                  <FormField label={t('haulCost')} tooltip={t('haulCostTooltip')}>
                    <NumberInput
                      value={haulCost}
                      onChange={setHaulCost}
                      unit="$/t"
                      step="0.01"
                    />
                  </FormField>

                  <FormField label={t('plantCost')} tooltip={t('plantCostTooltip')}>
                    <NumberInput
                      value={plantCost}
                      onChange={setPlantCost}
                      unit="$/t"
                      step="0.01"
                    />
                  </FormField>

                  <FormField label={t('gaCost')} tooltip={t('gaCostTooltip')}>
                    <NumberInput
                      value={gaCost}
                      onChange={setGaCost}
                      unit="$/t"
                      step="0.01"
                    />
                  </FormField>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium uppercase tracking-wide">
                    {t('developmentSection')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label={t('developmentCost')} tooltip={t('developmentCostTooltip')}>
                      <NumberInput
                        value={developmentCost}
                        onChange={setDevelopmentCost}
                        unit="$/m"
                        step="1"
                      />
                    </FormField>

                    <FormField label={t('developmentMeters')} tooltip={t('developmentMetersTooltip')}>
                      <NumberInput
                        value={developmentMeters}
                        onChange={setDevelopmentMeters}
                        unit="m"
                        step="1"
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      {/* Submit Button - Sticky */}
      <div className="sticky bottom-4 z-10">
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
            text-white py-4 px-6 rounded-xl font-medium shadow-lg hover:shadow-xl
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
            disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('calculating')}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {t('calculateNSR')}
              <span className="text-blue-200 text-sm">(Ctrl+Enter)</span>
            </span>
          )}
        </motion.button>
      </div>
    </form>
  );
}
