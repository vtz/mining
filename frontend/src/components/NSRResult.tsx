'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { NSRResult as NSRResultType } from '@/lib/api';
import { DonutChart, WaterfallChart } from './ui/Charts';

interface NSRResultProps {
  result: NSRResultType;
  primaryMetal?: string;
}

function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function getMetalDisplayCode(primaryMetal: string): string {
  switch (primaryMetal) {
    case 'Ni': return 'Ni';
    case 'Zn': return 'Zn';
    case 'Fe': return 'Fe';
    default: return 'Cu';
  }
}

// Animated number counter
function AnimatedValue({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const endValue = value;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(easeOut * endValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [value, duration]);

  return <>{formatCurrency(displayValue)}</>;
}

// Get viability color based on NSR value
function getViabilityColor(nsr: number): { bg: string; text: string; label: string } {
  if (nsr >= 100) return { bg: 'bg-green-500', text: 'text-green-600', label: 'Excellent' };
  if (nsr >= 75) return { bg: 'bg-emerald-500', text: 'text-emerald-600', label: 'Good' };
  if (nsr >= 50) return { bg: 'bg-yellow-500', text: 'text-yellow-600', label: 'Moderate' };
  if (nsr >= 25) return { bg: 'bg-orange-500', text: 'text-orange-600', label: 'Low' };
  return { bg: 'bg-red-500', text: 'text-red-600', label: 'Critical' };
}

export default function NSRResult({ result, primaryMetal = 'Cu' }: NSRResultProps) {
  const t = useTranslations('results');
  const [showDetails, setShowDetails] = useState(false);
  
  const primaryCode = getMetalDisplayCode(primaryMetal);
  const viability = getViabilityColor(result.nsr_per_tonne);
  
  // Prepare data for donut chart
  const donutData = [
    { name: primaryCode, value: result.nsr_cu, color: primaryMetal === 'Cu' ? '#f97316' : '#14b8a6' },
    { name: 'Au', value: result.nsr_au, color: '#eab308' },
    { name: 'Ag', value: result.nsr_ag, color: '#9ca3af' },
  ].filter(item => item.value > 0);

  const totalNSR = result.nsr_cu + result.nsr_au + result.nsr_ag;

  // Prepare data for waterfall chart
  const waterfallSteps = [
    { name: t('mineralResources'), value: result.nsr_mineral_resources, type: 'start' as const, color: 'bg-green-500' },
    { name: t('dilution'), value: result.dilution_loss, type: 'subtract' as const },
    { name: t('nsrMine'), value: result.nsr_mine, type: 'start' as const, color: 'bg-blue-500' },
    { name: t('recovery'), value: result.recovery_loss, type: 'subtract' as const },
    { name: t('nsrProcessing'), value: result.nsr_processing, type: 'start' as const, color: 'bg-purple-500' },
    { name: t('sellingCosts'), value: result.nsr_processing - result.nsr_per_tonne, type: 'subtract' as const },
    { name: t('nsrFinal'), value: result.nsr_per_tonne, type: 'total' as const, color: 'bg-gray-800' },
  ];

  // Metal breakdown for display
  const metalBreakdown = donutData.map(item => ({
    ...item,
    percentage: totalNSR > 0 ? (item.value / totalNSR) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Main NSR Result Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 dark:from-blue-700 dark:via-blue-800 dark:to-blue-900 
          rounded-2xl shadow-2xl p-6 text-white relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        {/* Viability indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${viability.bg} animate-pulse`} />
          <span className="text-sm text-blue-200">{viability.label}</span>
        </div>

        <div className="relative text-center">
          <p className="text-blue-200 text-sm uppercase tracking-widest mb-2">
            {t('nsrPerTonne')}
          </p>
          <div className="text-6xl font-bold tracking-tight">
            <AnimatedValue value={result.nsr_per_tonne} />
          </div>
          <p className="text-blue-200 mt-1">/t ore</p>
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-6">
          <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-blue-200 text-sm">{t('totalRevenue')}</p>
            <p className="text-2xl font-bold">{formatCurrency(result.revenue_total, 0)}</p>
          </div>
          <div className="text-center p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-blue-200 text-sm">{t('tonnage')}</p>
            <p className="text-2xl font-bold">{formatNumber(result.ore_tonnage, 0)} t</p>
          </div>
        </div>
      </motion.div>

      {/* Metal Contribution - Donut Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          {t('metalContribution')}
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Donut Chart */}
          <DonutChart
            data={donutData}
            centerLabel="Total NSR"
            centerValue={formatCurrency(totalNSR)}
            height={280}
          />

          {/* Legend with details */}
          <div className="space-y-4 flex flex-col justify-center">
            {metalBreakdown.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(item.value)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.percentage.toFixed(1)}%
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Concentrate Prices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('concentratePrice')}
        </h3>

        <div className={`grid grid-cols-2 gap-4 ${metalBreakdown.length >= 3 ? 'md:grid-cols-4' : metalBreakdown.length === 2 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {result.nsr_cu > 0 && (
            <div className={`text-center p-4 rounded-xl ${primaryMetal === 'Cu' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-teal-50 dark:bg-teal-900/20'}`}>
              <p className="text-sm text-gray-600 dark:text-gray-400">{primaryCode}</p>
              <p className={`text-xl font-bold ${primaryMetal === 'Cu' ? 'text-orange-600 dark:text-orange-400' : 'text-teal-600 dark:text-teal-400'}`}>
                {formatCurrency(result.conc_price_cu)}
              </p>
            </div>
          )}
          {result.nsr_au > 0 && (
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400">Au</p>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {formatCurrency(result.conc_price_au)}
              </p>
            </div>
          )}
          {result.nsr_ag > 0 && (
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400">Ag</p>
              <p className="text-xl font-bold text-gray-600 dark:text-gray-300">
                {formatCurrency(result.conc_price_ag)}
              </p>
            </div>
          )}
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('total')}</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(result.conc_price_total)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Technical Parameters - Collapsible */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
      >
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('technicalParameters')}
          </h3>
          <motion.svg
            animate={{ rotate: showDetails ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>

        <motion.div
          initial={false}
          animate={{ height: showDetails ? 'auto' : 0, opacity: showDetails ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="px-6 pb-6">
            <div className={`grid grid-cols-2 gap-4 ${metalBreakdown.length >= 3 ? 'md:grid-cols-4' : metalBreakdown.length === 2 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {result.nsr_cu > 0 && (
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {primaryMetal === 'Cu' ? t('cuRecovery') : `Recuperação ${primaryCode}`}
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPercent(result.cu_recovery)}
                  </p>
                </div>
              )}
              {result.nsr_au > 0 && (
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('auRecovery')}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPercent(result.au_recovery)}
                  </p>
                </div>
              )}
              {result.nsr_ag > 0 && (
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('agRecovery')}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPercent(result.ag_recovery)}
                  </p>
                </div>
              )}
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('concentrateRatio')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(result.conc_ratio, 4)}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* NSR Waterfall Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          {t('nsrCascade')}
        </h3>

        <WaterfallChart steps={waterfallSteps} className="mt-4" />

        {/* Legend */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 bg-green-500 rounded" />
            <span className="text-gray-600 dark:text-gray-400">{t('mineralResources')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 bg-red-400 rounded" />
            <span className="text-gray-600 dark:text-gray-400">{t('deductions')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-gray-600 dark:text-gray-400">{t('intermediate')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 bg-gray-800 dark:bg-gray-200 rounded" />
            <span className="text-gray-600 dark:text-gray-400">{t('final')}</span>
          </div>
        </div>
      </motion.div>

      {/* EBITDA Card */}
      {result.ebitda && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            EBITDA
          </h3>

          {/* EBITDA headline */}
          <div className={`rounded-xl p-4 mb-4 ${
            result.ebitda.ebitda >= 0 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">EBITDA</p>
                <p className={`text-3xl font-bold ${
                  result.ebitda.ebitda >= 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(result.ebitda.ebitda, 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaPerTonne')}</p>
                <p className={`text-xl font-bold ${
                  result.ebitda.ebitda_per_tonne >= 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(result.ebitda.ebitda_per_tonne)}/t
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    result.ebitda.ebitda_margin >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(result.ebitda.ebitda_margin, 0), 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {formatNumber(result.ebitda.ebitda_margin, 1)}%
              </span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaRevenue')}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(result.ebitda.revenue, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaMineCost')}</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(result.ebitda.mine_cost_total, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaDevCost')}</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(result.ebitda.development_cost_total, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaHaulCost')}</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(result.ebitda.haul_cost_total, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaPlantCost')}</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(result.ebitda.plant_cost_total, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('ebitdaGaCost')}</span>
              <span className="font-medium text-red-600 dark:text-red-400">
                -{formatCurrency(result.ebitda.ga_cost_total, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-t-2 border-gray-200 dark:border-gray-600 font-semibold">
              <span className="text-sm text-gray-900 dark:text-white">{t('ebitdaTotalCosts')}</span>
              <span className="text-red-600 dark:text-red-400">
                -{formatCurrency(result.ebitda.total_costs, 0)}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Copy NSR Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={() => {
          navigator.clipboard.writeText(result.nsr_per_tonne.toFixed(2));
        }}
        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl
          text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400
          transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        {t('copyNSR')}
      </motion.button>
    </div>
  );
}
