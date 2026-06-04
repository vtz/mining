'use client';

import { useTranslations } from 'next-intl';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import RecoveryCurve from '@/components/RecoveryCurve';

function RecoveryCurvePage() {
  const t = useTranslations('recoveryCurve');

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

        <RecoveryCurve />
      </div>
    </AppLayout>
  );
}

export default function RecoveryCurvePageWrapper() {
  return (
    <ProtectedRoute>
      <RecoveryCurvePage />
    </ProtectedRoute>
  );
}
