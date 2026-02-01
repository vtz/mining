'use client';

import { useTranslations } from 'next-intl';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import CalculationHistory from '@/components/CalculationHistory';

function HistoryPage() {
  const t = useTranslations('history');

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('pageDescription')}
          </p>
        </div>

        <CalculationHistory maxItems={50} />
      </div>
    </AppLayout>
  );
}

export default function History() {
  return (
    <ProtectedRoute>
      <HistoryPage />
    </ProtectedRoute>
  );
}
