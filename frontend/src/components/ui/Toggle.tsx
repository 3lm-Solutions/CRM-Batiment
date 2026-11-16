interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'blue' | 'green' | 'amber';
  className?: string;
}

const sizeStyles = {
  sm: {
    toggle: 'h-5 w-9',
    thumb: 'h-3 w-3 translate-x-0.5',
    thumbChecked: 'translate-x-4',
  },
  md: {
    toggle: 'h-6 w-11',
    thumb: 'h-4 w-4 translate-x-0.5',
    thumbChecked: 'translate-x-5',
  },
  lg: {
    toggle: 'h-7 w-13',
    thumb: 'h-5 w-5 translate-x-0.5',
    thumbChecked: 'translate-x-6',
  },
};

const variantStyles = {
  default: {
    unchecked: 'bg-slate-200',
    checked: 'bg-slate-900',
  },
  blue: {
    unchecked: 'bg-slate-200',
    checked: 'bg-blue-600',
  },
  green: {
    unchecked: 'bg-slate-200',
    checked: 'bg-emerald-600',
  },
  amber: {
    unchecked: 'bg-slate-200',
    checked: 'bg-amber-600',
  },
};

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = 'md',
  variant = 'default',
  className = '',
}: ToggleProps) {
  const sizeClass = sizeStyles[size];
  const variantClass = variantStyles[variant];

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass.toggle} ${
          checked ? variantClass.checked : variantClass.unchecked
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sizeClass.thumb} ${
            checked ? sizeClass.thumbChecked : ''
          }`}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-slate-900">{label}</span>
          )}
          {description && (
            <span className="text-sm text-slate-500">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
