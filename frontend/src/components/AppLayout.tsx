'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import QuickStats from './QuickStats';
import UserMenu from './UserMenu';
import LanguageSelector from './LanguageSelector';
import { ThemeProvider, ThemeToggle } from './ui/ThemeProvider';
import { ToastProvider } from './ui/Toast';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const pathname = usePathname();

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setShowMobileSidebar(false);
  }, [pathname]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          {/* Sidebar - Desktop */}
          <div className="hidden lg:block">
            <Sidebar 
              isCollapsed={sidebarCollapsed} 
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
            />
          </div>

          {/* Mobile Sidebar Overlay */}
          {showMobileSidebar && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setShowMobileSidebar(false)}
            />
          )}

          {/* Mobile Sidebar */}
          <div className={`fixed inset-y-0 left-0 z-40 lg:hidden transform transition-transform duration-300 ${
            showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <Sidebar 
              isCollapsed={false} 
              onToggle={() => setShowMobileSidebar(false)} 
            />
          </div>

          {/* Main Content */}
          <div className={`transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}>
            {/* Top Header */}
            <header className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                {/* Mobile menu button */}
                <button
                  className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setShowMobileSidebar(true)}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* Logo for mobile */}
                <div className="lg:hidden flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">NSR</span>
                  </div>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <LanguageSelector />
                  </div>
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </div>
            </header>

            {/* Quick Stats Bar */}
            <QuickStats />

            {/* Page Content */}
            <main className="p-4 sm:p-6 lg:p-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-4">
              <div className="px-4 sm:px-6 lg:px-8">
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  NSR Calculator © 2024 • Powered by precision mining economics
                </p>
              </div>
            </footer>
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
