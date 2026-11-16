import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  position?: 'left' | 'right';
  className?: string;
}

export default function ActionMenu({ items, position = 'right', className = '' }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getItemClass = (variant: string = 'default') => {
    const baseClass = 'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors';
    
    switch (variant) {
      case 'danger':
        return `${baseClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`;
      case 'success':
        return `${baseClass} text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20`;
      default:
        return `${baseClass} text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`;
    }
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Actions"
      >
        <MoreVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2
            ${position === 'right' ? 'right-0' : 'left-0'}
          `}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                disabled={item.disabled}
                className={getItemClass(item.variant)}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
