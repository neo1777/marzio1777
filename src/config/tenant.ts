/**
 * Configurazione di dominio per-istanza ("tenant").
 *
 * Centralizza i valori specifici della comunità (oggi: Marzio). È il seme della
 * futura piattaforma multi-comunità: per generare l'app di un'altra comunità
 * basterà fornire un altro `TenantConfig`, senza fork del codice. Finché Marzio
 * è l'unica istanza in produzione, questi valori NON vanno cambiati alla leggera.
 *
 * NOTA: estrazione di Fase 0 (config extraction) — qui vivono solo i valori di
 * dominio già "sicuri" da centralizzare (centro mappa, altitudine, identità,
 * storage). i18n, modello dati per-tenant e rules tenant-aware sono fasi separate.
 */
export interface TenantConfig {
  /** Identificativo stabile della comunità (chiave dati — non rinominare). */
  id: string;
  /** Nome leggibile della comunità (UI/branding). */
  name: string;
  /** Nome completo dell'istanza/app. */
  fullName: string;
  map: {
    /** Centro mappa di default [lat, lng], usato prima che arrivi il GPS. */
    center: [number, number];
    /** Zoom di default. */
    defaultZoom: number;
    /** Altitudine base della comunità (m s.l.m.), usata in profilo/gamification. */
    baseAltitude: number;
  };
  storage: {
    /** Prefisso del path su Firebase Storage per le foto. */
    photosPrefix: string;
  };
}

/** Istanza zero: la comunità del paese di Marzio (in produzione). */
export const TENANT: TenantConfig = {
  id: 'marzio',
  name: 'Marzio',
  fullName: 'marzio1777',
  map: {
    center: [45.9238, 8.8655],
    defaultZoom: 16,
    baseAltitude: 728,
  },
  storage: {
    photosPrefix: 'marzio_photos',
  },
};
