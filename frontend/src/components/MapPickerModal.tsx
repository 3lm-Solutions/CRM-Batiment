import { useEffect, useRef, useState } from 'react';
import { X, Loader2, MapPin, CheckCircle2 } from 'lucide-react';

interface MapPickerModalProps {
  open: boolean;
  title: string;
  initialAddress?: string;
  onClose: () => void;
  onConfirm: (address: string) => void;
}

/**
 * OpenStreetMap address picker using Leaflet.
 * Click anywhere on the map → reverse-geocodes via Nominatim →
 * writes the address directly into the field and closes the modal automatically.
 * Search bar lets you jump to an address first.
 */
export function MapPickerModal({ open, title, initialAddress, onClose, onConfirm }: MapPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);

  // Keep a stable ref to callbacks so the Leaflet handler always calls the latest version
  const onConfirmRef = useRef(onConfirm);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const [address, setAddress] = useState('');
  const [searchInput, setSearchInput] = useState(initialAddress ?? '');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state each time the modal opens
  useEffect(() => {
    if (open) {
      setAddress('');
      setSearchInput(initialAddress ?? '');
      setConfirmed(false);
      setError(null);
    }
  }, [open, initialAddress]);

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;

      if (cancelled) return;

      // Fix Vite asset issue for default marker icons
      // @ts-expect-error — Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Destroy previous instance
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      const map = L.map(mapContainerRef.current!).setView([46.8, 2.3], 6);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Pre-center on initial address if provided
      if (initialAddress?.trim()) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(initialAddress)}&limit=1`,
            { headers: { 'Accept-Language': 'fr' } },
          );
          const data = await res.json();
          if (data[0] && !cancelled) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            map.setView([lat, lon], 15);
            markerRef.current = L.marker([lat, lon]).addTo(map);
          }
        } catch { /* silent */ }
      }

      // ─── MAIN CLICK HANDLER ───────────────────────────────────────────────
      // Click → reverse-geocode → write to field → close modal automatically
      map.on('click', async (e: import('leaflet').LeafletMouseEvent) => {
        if (cancelled) return;
        const { lat, lng } = e.latlng;

        setLoading(true);
        setError(null);
        setConfirmed(false);

        // Place/move marker immediately for instant feedback
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`,
          );
          const data = await res.json();
          if (cancelled) return;

          const display = (data.display_name as string) ?? '';
          setAddress(display);
          setSearchInput(display);
          setConfirmed(true);

          // ✅ Write to the form field and close the modal automatically
          onConfirmRef.current(display);
          setTimeout(() => {
            if (!cancelled) onCloseRef.current();
          }, 600); // brief moment so user sees the green ✓ flash
        } catch {
          if (!cancelled) setError('Impossible de récupérer l\'adresse. Réessayez.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSearch() {
    if (!searchInput.trim() || !mapRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const L = (await import('leaflet')).default;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&limit=1`,
        { headers: { 'Accept-Language': 'fr' } },
      );
      const data = await res.json();

      if (!data[0]) {
        setError('Adresse introuvable. Essayez une adresse plus précise.');
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      mapRef.current.setView([lat, lon], 15);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        markerRef.current = L.marker([lat, lon]).addTo(mapRef.current);
      }

      setAddress(data[0].display_name);
      setSearchInput(data[0].display_name);
    } catch {
      setError('Erreur lors de la recherche.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <MapPin size={18} className="text-primary-600" />
            {title}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Rechercher une adresse pour centrer la carte..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Chercher
          </button>
        </div>

        {/* Map */}
        <div className="relative">
          <div ref={mapContainerRef} className="h-72 w-full" />

          {/* Overlay hint */}
          {!loading && !confirmed && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-md">
                Cliquez sur la carte pour sélectionner un point
              </span>
            </div>
          )}

          {/* Loading spinner overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40">
              <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-lg">
                <Loader2 size={16} className="animate-spin text-primary-600" />
                <span className="text-sm font-medium text-slate-700">Récupération de l'adresse…</span>
              </div>
            </div>
          )}

          {/* Success flash */}
          {confirmed && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/60">
              <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-lg">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Adresse sélectionnée !</span>
              </div>
            </div>
          )}
        </div>

        {/* Address preview + error */}
        <div className="border-t border-slate-100 px-5 py-3">
          {error && (
            <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
          )}
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Adresse sélectionnée
          </p>
          <p className="min-h-[1.25rem] text-sm text-slate-700">
            {address
              ? address
              : <span className="italic text-slate-400">Cliquez sur la carte pour sélectionner…</span>
            }
          </p>
        </div>

        {/* Footer — only cancel; confirm happens automatically on click */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-[12px] text-slate-400">
            La sélection se fait directement en cliquant sur la carte
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
