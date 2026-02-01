'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { fetchMetalPrices } from '@/lib/api';

interface MetalPrice {
  symbol: string;
  name: string;
  price: number;
  unit: string;
  change?: number;
  color: string;
}

export default function QuickStats() {
  const t = useTranslations('stats');
  const [prices, setPrices] = useState<MetalPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const loadPrices = async () => {
      try {
        const response = await fetchMetalPrices();
        setPrices([
          {
            symbol: 'Cu',
            name: t('copper'),
            price: response.prices.cu.value,
            unit: '$/lb',
            color: 'text-orange-500',
          },
          {
            symbol: 'Au',
            name: t('gold'),
            price: response.prices.au.value,
            unit: '$/oz',
            color: 'text-yellow-500',
          },
          {
            symbol: 'Ag',
            name: t('silver'),
            price: response.prices.ag.value,
            unit: '$/oz',
            color: 'text-gray-400',
          },
        ]);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch prices:', error);
        // Use defaults
        setPrices([
          { symbol: 'Cu', name: t('copper'), price: 4.25, unit: '$/lb', color: 'text-orange-500' },
          { symbol: 'Au', name: t('gold'), price: 2350, unit: '$/oz', color: 'text-yellow-500' },
          { symbol: 'Ag', name: t('silver'), price: 28.50, unit: '$/oz', color: 'text-gray-400' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPrices();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [t]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="space-y-1">
                  <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 overflow-x-auto">
            {prices.map((metal, index) => (
              <motion.div
                key={metal.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 py-1"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                  ${metal.symbol === 'Cu' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                    metal.symbol === 'Au' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {metal.symbol}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{metal.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${metal.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-gray-400">{metal.unit}</span>
                    {metal.change !== undefined && (
                      <span className={`text-xs font-medium ${metal.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {metal.change >= 0 ? '+' : ''}{metal.change.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {lastUpdate && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>{t('lastUpdate')}: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
