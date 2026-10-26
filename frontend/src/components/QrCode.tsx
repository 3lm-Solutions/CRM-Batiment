import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * A QR code drawn as SVG (sharp when printed). Error correction M, as required by the SEPA
 * payment QR code; rendered in the browser, nothing is sent anywhere.
 */
export function QrCode({ value, size = 120, label, className }: { value: string; size?: number; label: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then((s) => !cancelled && setSvg(s))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('shrink-0 bg-white [&_svg]:size-full', className)}
      style={{ width: size, height: size }}
      // SVG produced by the qrcode library from our own text: no user HTML
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
