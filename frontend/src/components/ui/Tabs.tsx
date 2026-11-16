import type { ReactNode } from 'react';
import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  default: {
    container: 'border-b border-slate-200',
    tab: 'border-b-2 border-transparent',
    activeTab: 'border-blue-600 text-blue-600',
    inactiveTab: 'text-slate-600 hover:text-slate-900 hover:border-slate-300',
  },
  pills: {
    container: 'bg-slate-100 p-1 rounded-xl',
    tab: 'rounded-lg',
    activeTab: 'bg-white text-slate-900 shadow-sm',
    inactiveTab: 'text-slate-600 hover:text-slate-900',
  },
  underline: {
    container: 'border-b border-slate-200',
    tab: 'border-b-2 border-transparent',
    activeTab: 'border-blue-600 text-blue-600',
    inactiveTab: 'text-slate-600 hover:text-slate-900 hover:border-slate-300',
  },
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Tabs({ tabs, defaultTab, variant = 'default', size = 'md', className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const styles = variantStyles[variant];
  const sizeClass = sizeStyles[size];

  if (!tabs.length) return null;

  return (
    <div className={className}>
      {/* Tab Headers */}
      <div className={`${styles.container} flex gap-2 overflow-x-auto`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`inline-flex items-center gap-2 font-medium transition-all whitespace-nowrap ${sizeClass} ${styles.tab} ${
              activeTab === tab.id
                ? styles.activeTab
                : styles.inactiveTab
            } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? 'block' : 'hidden'}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
