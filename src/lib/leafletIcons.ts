import L from 'leaflet';

/**
 * Inline SVG marker icons for Leaflet, served as DivIcon HTML.
 *
 * Why not the standard L.Icon with CDN PNGs?
 *  - PWA must work offline (the hunt and the game creator both ship without
 *    network on the field). External icon URLs (raw.githubusercontent.com,
 *    cdnjs, unpkg) would 404 the marker once the install cache is busted.
 *  - We're zero-deps. Bundling a sprite would mean adding leaflet-color-markers
 *    or its kin. SVGs inline cost ~600 bytes each and theme automatically.
 *
 * Color names (not free hex) so call-sites stay declarative; the palette
 * matches the project's own variables (--color-marzio-*).
 */

export type MarkerColor = 'blue' | 'gold' | 'green' | 'crimson';

const PALETTE: Record<MarkerColor, { fill: string; stroke: string }> = {
  blue:    { fill: '#2563EB', stroke: '#1E3A8A' }, // user position
  gold:    { fill: '#FFA000', stroke: '#92400E' }, // spawned items / placement
  green:   { fill: '#2D5A27', stroke: '#1A3517' }, // marzio brand
  crimson: { fill: '#C2410C', stroke: '#7C2D12' }, // alerts / collected
};

const SIZE: [number, number] = [30, 42];
// Anchor at the tip of the drop (bottom-center).
const ANCHOR: [number, number] = [15, 42];

function svgPin(color: MarkerColor): string {
  const { fill, stroke } = PALETTE[color];
  // 30x42 viewbox; classic teardrop pin with a white inner circle.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">
    <path d="M15 1C7.27 1 1 7.27 1 15c0 10.5 14 26 14 26s14-15.5 14-26C29 7.27 22.73 1 15 1z"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="15" cy="15" r="5.5" fill="#FFFFFF" stroke="${stroke}" stroke-width="1"/>
  </svg>`;
}

/**
 * Returns a Leaflet DivIcon ready to drop into <Marker icon={...} />.
 * The icon is purely local — works offline once the JS bundle is cached.
 */
export function createMarkerIcon(color: MarkerColor): L.DivIcon {
  return L.divIcon({
    html: svgPin(color),
    iconSize: SIZE,
    iconAnchor: ANCHOR,
    popupAnchor: [0, -36],
    className: 'marzio-marker', // hook for global CSS if ever needed (no default styles)
  });
}

/**
 * Offline-safe HTML for a live-user avatar inside a Leaflet `divIcon` (string
 * context — can't render React there). Mirrors the `Avatar` component policy:
 * use the photoURL when present, fall back to an initial-on-#2D5A27 circle.
 * Avoids the DiceBear CDN dependency that would 404 the marker in PWA-
 * installed/offline mode.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function liveUserAvatarHtml(opts: { photoURL?: string | null; name?: string | null; size?: number }): string {
  const size = opts.size ?? 36;
  const initial = ((opts.name ?? '?').trim()[0] ?? '?').toUpperCase();
  const common = `width:${size}px;height:${size}px;border-radius:50%;border:2px solid #10b981;box-shadow:0 4px 6px rgba(0,0,0,0.3);`;
  if (opts.photoURL) {
    return `<img src="${escapeHtml(opts.photoURL)}" referrerpolicy="no-referrer" style="${common}object-fit:cover;" />`;
  }
  return `<div style="${common}background:#2D5A27;color:white;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;font-weight:700;font-size:${Math.round(size * 0.42)}px;line-height:1;">${escapeHtml(initial)}</div>`;
}
