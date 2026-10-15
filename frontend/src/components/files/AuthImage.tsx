import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fichierObjectUrl } from '@/lib/files';
import { cn } from '@/lib/cn';

/**
 * <img> for a protected file: fetched with the session token, shown via a blob URL
 * that is revoked when the component unmounts.
 */
export function AuthImage({ path, alt, className, onClick }: { path: string; alt: string; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fichierObjectUrl(path)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else setSrc((url = u));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (failed) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800', className)} role="img" aria-label={alt}>
        <ImageOff className="size-5" />
      </div>
    );
  }
  if (!src) return <div className={cn('animate-pulse bg-slate-200 dark:bg-slate-800', className)} aria-hidden />;
  const img = <img src={src} alt={alt} className={cn('object-cover', className)} />;
  return onClick ? (
    <button type="button" onClick={onClick} className="block overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700">
      {img}
    </button>
  ) : (
    img
  );
}
