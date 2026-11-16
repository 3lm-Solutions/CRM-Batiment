import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'elevated' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-white border border-slate-200 shadow-sm',
  bordered: 'bg-white border-2 border-slate-200',
  elevated: 'bg-white border border-slate-200 shadow-lg',
  ghost: 'bg-transparent border border-slate-200',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({ children, className = '', variant = 'default', padding = 'md', onClick }: CardProps) {
  const baseClasses = 'rounded-2xl transition-all duration-200';
  const variantClass = variantStyles[variant];
  const paddingClass = paddingStyles[padding];
  const interactiveClasses = onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : '';

  return (
    <div
      className={`${baseClasses} ${variantClass} ${paddingClass} ${interactiveClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-b border-slate-200 bg-slate-50 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`font-bold text-slate-900 ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-t border-slate-200 bg-slate-50 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}
