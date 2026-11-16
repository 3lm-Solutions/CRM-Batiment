import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'error' | 'success';
  inputSize?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20',
  error: 'border-red-300 focus:border-red-500 focus:ring-red-500/20 bg-red-50',
  success: 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, variant = 'default', inputSize = 'md', className = '', ...props }, ref) => {
    const currentVariant = error ? 'error' : variant;
    const variantClass = variantStyles[currentVariant];
    const sizeClass = sizeStyles[inputSize];

    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full rounded-xl border bg-white py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${variantClass} ${sizeClass} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
