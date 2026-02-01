'use client';

import { useState, createContext, useContext, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  className?: string;
  onChange?: (tab: string) => void;
}

export function Tabs({ defaultTab, children, className = '', onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div className={`flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Tab({ value, children, icon, className = '' }: TabProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 
        ${isActive 
          ? 'text-blue-700 dark:text-blue-300' 
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
        } ${className}`}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
          initial={false}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}

interface TabPanelsProps {
  children: ReactNode;
  className?: string;
}

export function TabPanels({ children, className = '' }: TabPanelsProps) {
  return <div className={className}>{children}</div>;
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className = '' }: TabPanelProps) {
  const { activeTab } = useTabs();

  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
