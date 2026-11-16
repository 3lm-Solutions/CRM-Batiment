import type { ReactNode } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'square' | 'rounded';
  className?: string;
  children?: ReactNode;
}

const sizeStyles = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
};

const variantStyles = {
  circle: 'rounded-full',
  square: 'rounded-lg',
  rounded: 'rounded-2xl',
};

const colorStyles = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function getInitialsColor(index: number) {
  return colorStyles[index % colorStyles.length];
}

function getInitials(name?: string) {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({
  src,
  alt = '',
  initials,
  size = 'md',
  variant = 'circle',
  className = '',
  children,
}: AvatarProps) {
  const sizeClass = sizeStyles[size];
  const variantClass = variantStyles[variant];
  const displayInitials = initials || getInitials(alt);

  return (
    <div
      className={`flex items-center justify-center font-semibold ${sizeClass} ${variantClass} ${className} ${
        src ? 'bg-slate-100' : getInitialsColor(alt.length || 0)
      }`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : children ? (
        children
      ) : (
        <span>{displayInitials}</span>
      )}
    </div>
  );
}

export function AvatarGroup({ children, max = 4 }: { children: ReactNode; max?: number }) {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleChildren = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  return (
    <div className="flex -space-x-2">
      {visibleChildren.map((child, index) => (
        <div key={index} className="ring-2 ring-white rounded-full">
          {child}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600 ring-2 ring-white">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
