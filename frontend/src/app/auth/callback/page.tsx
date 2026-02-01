'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setTokens } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Get tokens from URL
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      setTokens({ access_token: accessToken, refresh_token: refreshToken });
      router.push('/');
    } else {
      // Error - redirect to login
      router.push('/login?error=auth_failed');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Autenticando...</p>
      </div>
    </div>
  );
}
