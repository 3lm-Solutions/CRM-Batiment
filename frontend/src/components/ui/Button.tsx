import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'gradient-blue' | 'gradient-amber';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
  'gradient-blue': 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500',
  'gradient-amber': 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 focus:ring-amber-500',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const iconSizeStyles = {
  sm: '14',
  md: '16',
  lg: '20',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm';
  const variantClass = variantStyles[variant];
  const sizeClass = sizeStyles[size];
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin" width={iconSizeStyles[size]} height={iconSizeStyles[size]} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Chargement...
        </>
      ) : (
        <>
          {leftIcon && <span>{leftIcon}</span>}
          {children}
          {rightIcon && <span>{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
