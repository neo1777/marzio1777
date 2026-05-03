import { useState, useEffect } from 'react';

export function useCameraStream(facingMode: 'user' | 'environment' = 'environment') {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let localStream: MediaStream | null = null;

    async function initCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        localStream = s;
        setStream(s);
      } catch (err) {
        if (mounted) setError(err as Error);
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  return { stream, error };
}
