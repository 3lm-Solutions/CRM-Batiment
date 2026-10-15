import { cn } from '@/lib/cn';

const COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-orange-100 text-orange-600',
  'bg-red-100 text-red-600',
  'bg-cyan-100 text-cyan-700',
];

/** Initials in a coloured circle (mockup client lists). Same name → same colour. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return (
    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold', COLORS[hash % COLORS.length], className)} aria-hidden>
      {initials || '?'}
    </span>
  );
}
