'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import SensitivityAnalysis from '@/components/SensitivityAnalysis';
import { NSRInput } from '@/lib/api';

function SensitivityPage() {
  const t = useTranslations('sensitivity');
  
  // Default values for standalone sensitivity analysis
  const [baseInput] = useState<NSRInput>({
    mine: 'Caraíba',
    area: 'Surubim',
    cu_grade: 1.4,
    au_grade: 0.23,
    ag_grade: 2.33,
    ore_tonnage: 20000,
    mine_dilution: 0.14,
    ore_recovery: 0.98,
    cu_price: 4.5,
    au_price: 2300,
    ag_price: 28,
  });

  const [baseNSR] = useState(85.50); // Approximate base NSR

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('pageDescription')}
          </p>
        </div>

        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">{t('tip')}:</span> {t('tipDescription')}
          </p>
        </div>

        <SensitivityAnalysis baseInput={baseInput} baseNSR={baseNSR} />
      </div>
    </AppLayout>
  );
}

export default function Sensitivity() {
  return (
    <ProtectedRoute>
      <SensitivityPage />
    </ProtectedRoute>
  );
}
