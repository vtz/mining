'use client';

import { useTranslations } from 'next-intl';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import LanguageSelector from '@/components/LanguageSelector';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();

  const adminLinks = [
    { href: '/admin/users', label: t('nav.users') },
    { href: '/admin/regions', label: t('nav.regions') },
    { href: '/admin/mines', label: t('nav.mines') },
  ];

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <Link href="/" className="text-2xl font-bold text-gray-900">
                  {t('header.title')}
                </Link>
                <span className="text-gray-300">|</span>
                <span className="text-lg font-medium text-purple-600">{t('nav.admin')}</span>
              </div>
              <div className="flex items-center space-x-4">
                <LanguageSelector />
                <UserMenu />
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`py-4 px-1 border-b-2 text-sm font-medium ${
                    pathname === link.href
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
