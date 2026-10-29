import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

/** Native <dialog>: focus trap, Escape and backdrop handled by the browser. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /** The press started on the backdrop (29/10: a text selection dragged out of the window, or a
   *  press inside released outside, no longer closes it) */
  const pressDehors = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => (pressDehors.current = e.target === ref.current)}
      onClick={(e) => {
        if (e.target === ref.current && pressDehors.current) onClose();
        pressDehors.current = false;
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] overflow-hidden rounded-3xl bg-white p-0 text-gray-800 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm',
        'dark:bg-slate-900 dark:text-slate-100',
        size === 'md' && 'max-w-lg',
        size === 'lg' && 'max-w-2xl',
        size === 'xl' && 'max-w-4xl',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">{title}</h2>
              {description && <div className="mt-0.5 text-sm text-slate-500">{description}</div>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800" aria-label="Fermer">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger,
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  /** Extra form fields (e.g. a reason) */
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <div>{message}</div>
        {children}
      </div>
    </Modal>
  );
}
