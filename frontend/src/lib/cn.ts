import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes, later ones win: cn('px-2', cond && 'px-4'). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
