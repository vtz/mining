'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ui/ThemeProvider';
import { ToastProvider } from './ui/Toast';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
