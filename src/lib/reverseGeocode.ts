import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Reverse-geocoding via OpenStreetMap Nominatim (free tier, 1 req/s rate
 * limit globale per IP). Cache su Firestore `places_cache/{key}` per
 * ammortizzare chiamate ripetute sulle stesse coordinate (le foto della
 * stessa frazione cadono tutte nello stesso bucket).
 *
 * Precisione: troncamento a 4 cifre decimali (~11m). Sufficiente per il
 * Quiz "dove è stata scattata?" (granularità città/paese).
 *
 * Politica d'uso Nominatim:
 *   https://operations.osmfoundation.org/policies/nominatim/
 *   - max 1 req/s
 *   - User-Agent identificativo richiesto
 *   - cache aggressiva consigliata
 *
 * Fallback: in caso di errore di rete o rate-limit, ritorna null. Il
 * generator `guess_place` lo gestisce ritornando null al wizard, che a
 * sua volta degrada a composizione manuale.
 */

const USER_AGENT = 'marzio1777/1.0 (https://github.com/neo1777/marzio1777)';

interface CachedPlace {
   placeName: string;
   lat: number;
   lng: number;
   fetchedAt: unknown; // Firestore Timestamp
}

function geoKey(lat: number, lng: number): string {
   // Trunc to 4 decimals (~11 m precision). Padded sign to keep keys
   // monotonically formatted (no negative-sign at index 0 issues for the
   // legacy Firestore doc-id rules).
   const fmt = (n: number) => (n >= 0 ? `p${n.toFixed(4)}` : `n${(-n).toFixed(4)}`);
   return `${fmt(lat)}_${fmt(lng)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
   if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
   const key = geoKey(lat, lng);
   const cacheRef = doc(db, 'places_cache', key);

   // 1. Try cache.
   try {
      const cached = await getDoc(cacheRef);
      if (cached.exists()) {
         const data = cached.data() as CachedPlace;
         if (typeof data.placeName === 'string' && data.placeName.length > 0) {
            return data.placeName;
         }
      }
   } catch {
      // ignore — fall through to Nominatim
   }

   // 2. Hit Nominatim. Free tier, no API key, but a User-Agent is required.
   try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
         String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=14&accept-language=it`;
      const res = await fetch(url, {
         headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
         // Cache hint to the browser: same coords → same answer for hours.
         cache: 'force-cache',
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      const placeName = composePlaceName(json);
      if (!placeName) return null;

      // 3. Persist cache (best-effort). Failures are silent.
      try {
         await setDoc(cacheRef, {
            placeName,
            lat,
            lng,
            fetchedAt: serverTimestamp(),
         });
      } catch {
         // private mode / rule rejection — no-op
      }
      return placeName;
   } catch {
      return null;
   }
}

function composePlaceName(json: any): string | null {
   if (!json || typeof json !== 'object') return null;
   const a = json.address ?? {};
   // Build a "village/town/city, province" friendly string. Fall back to
   // display_name if the components aren't there (Nominatim is consistent
   // for Italian addresses but not for every coordinate).
   const town =
      a.village ||
      a.hamlet ||
      a.town ||
      a.city ||
      a.suburb ||
      a.municipality ||
      a.county ||
      null;
   const region = a.state || a.region || null;
   if (town && region) return `${town}, ${region}`;
   if (town) return town;
   if (typeof json.display_name === 'string') {
      // Trim Nominatim's verbose chain to the first 2 components.
      return json.display_name.split(',').slice(0, 2).join(',').trim();
   }
   return null;
}
