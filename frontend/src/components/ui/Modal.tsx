import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClass = sizeStyles[size];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className={`w-full ${sizeClass} max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl`}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            {title && <h3 className="text-lg font-bold text-slate-900">{title}</h3>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6">{children}</div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
