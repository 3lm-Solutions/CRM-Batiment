import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 transition ' +
  'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 ' +
  'disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ' +
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20';

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Label + control + error/hint, wired for screen readers. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type Common = { label?: string; error?: string; hint?: string; containerClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common & { icon?: ReactNode }>(
  ({ label, error, hint, containerClassName, className, required, icon, ...props }, ref) => (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
      {(a11y) =>
        icon ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 [&>svg]:size-4" aria-hidden>{icon}</span>
            <input ref={ref} required={required} className={cn(CONTROL, 'pl-10', className)} {...a11y} {...props} />
          </div>
        ) : (
          <input ref={ref} required={required} className={cn(CONTROL, className)} {...a11y} {...props} />
        )
      }
    </Field>
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(
  ({ label, error, hint, containerClassName, className, required, rows = 3, ...props }, ref) => (
    <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
      {(a11y) => <textarea ref={ref} rows={rows} required={required} className={cn(CONTROL, className)} {...a11y} {...props} />}
    </Field>
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & Common & { options: { value: string | number; label: string }[]; placeholder?: string }
>(({ label, error, hint, containerClassName, className, options, placeholder, required, ...props }, ref) => (
  <Field label={label} error={error} hint={hint} required={required} className={containerClassName}>
    {(a11y) => (
      <select ref={ref} required={required} className={cn(CONTROL, 'pr-8', className)} {...a11y} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )}
  </Field>
));
Select.displayName = 'Select';
