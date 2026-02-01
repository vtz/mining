'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDevStatus, devLogin, localLogin, DevStatus } from '@/lib/auth';
import LanguageSelector from '@/components/LanguageSelector';

export default function LoginPage() {
  const t = useTranslations();
  const { user, loading, login, refreshUser } = useAuth();
  const router = useRouter();
  const [devStatus, setDevStatus] = useState<DevStatus | null>(null);
  const [devEmail, setDevEmail] = useState('admin@example.com');
  const [devName, setDevName] = useState('Admin Dev');
  const [devIsAdmin, setDevIsAdmin] = useState(true);
  const [devLoading, setDevLoading] = useState(false);
  
  // Local login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    getDevStatus().then(setDevStatus);
  }, []);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);
    
    const result = await localLogin(email, password);
    
    if (result.success) {
      await refreshUser();
      router.push('/');
    } else {
      setLocalError(result.error || 'Erro ao fazer login');
    }
    
    setLocalLoading(false);
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    const result = await devLogin(devEmail, devName, devIsAdmin);
    if (result) {
      await refreshUser();
      router.push('/');
    }
    setDevLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
      {/* Language selector in top right */}
      <div className="absolute top-4 right-4">
        <div className="bg-white rounded-lg px-2 py-1">
          <LanguageSelector />
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('header.title')}
          </h1>
          <p className="text-gray-600">
            {t('header.subtitle')}
          </p>
        </div>

        <div className="space-y-4">
          {/* Local Login Form */}
          <form onSubmit={handleLocalLogin} className="space-y-4">
            {localError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {localError}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="email@example.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={localLoading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {localLoading ? t('auth.loggingIn') : t('auth.login')}
            </button>
          </form>

          {/* Google Login */}
          {devStatus?.google_oauth_configured && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{t('common.or')}</span>
                </div>
              </div>
              
              <button
                onClick={login}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t('auth.loginWithGoogle')}
              </button>
            </>
          )}

          {/* Dev Login */}
          {devStatus?.dev_login_available && (
            <>
              {devStatus?.google_oauth_configured && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">{t('common.or')}</span>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-800">{t('auth.devMode')}</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                    <input
                      type="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('auth.name')}</label>
                    <input
                      type="text"
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={devIsAdmin}
                      onChange={(e) => setDevIsAdmin(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{t('auth.admin')}</span>
                  </label>
                  <button
                    onClick={handleDevLogin}
                    disabled={devLoading}
                    className="w-full px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    {devLoading ? t('auth.loggingIn') : t('auth.loginDev')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-sm text-gray-500">
            {t('auth.termsNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
