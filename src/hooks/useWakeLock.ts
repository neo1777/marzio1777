import { useEffect, useRef } from 'react';

type Options = {
  /** Optional callback for non-fatal request errors (logged otherwise). */
  onError?: (err: unknown) => void;
};

/**
 * Acquire (and auto-renew on visibilitychange) a screen wake lock while
 * `active` is true. Releases on cleanup or when `active` flips to false.
 *
 * Best-practice 2026 feature detection:
 *   - prefers the standard `document.permissionsPolicy.allowsFeature(...)`
 *   - falls back to the older `document.featurePolicy.allowsFeature(...)`
 *   - degrades gracefully if neither is exposed (older browsers / unsupported
 *     contexts like AI Studio iframe previews / Stackblitz embeds)
 *
 * Wake locks are auto-released by the browser when the page becomes hidden;
 * we re-acquire on visibilitychange === 'visible' to keep the lock alive
 * across PWA foreground/background transitions.
 */
export function useWakeLock(active: boolean, opts: Options = {}) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;

  useEffect(() => {
    if (!active) return;

    const canRequest = () => {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return false;
      const d = typeof document !== 'undefined' ? document : null;
      if (!d) return false;
      const pp: any = (d as any).permissionsPolicy;
      if (pp?.allowsFeature) return !!pp.allowsFeature('screen-wake-lock');
      const fp: any = (d as any).featurePolicy;
      if (fp?.allowsFeature) return !!fp.allowsFeature('screen-wake-lock');
      // Neither API is exposed — assume allowed (browser will reject if not).
      return true;
    };

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || !canRequest()) return;
      try {
        sentinelRef.current = await navigator.wakeLock.request('screen');
        sentinelRef.current.addEventListener('release', () => {
          // The browser may release the lock proactively (tab backgrounded,
          // power saver). visibilitychange handler re-acquires when visible.
        });
      } catch (e) {
        const onError = onErrorRef.current;
        if (onError) onError(e);
        else console.warn('Wake Lock request failed', e);
      }
    };

    const release = async () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s) {
        try { await s.release(); } catch { /* ignore */ }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        acquire();
      }
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [active]);
}
