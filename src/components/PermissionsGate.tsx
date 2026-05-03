import React, { useState, useEffect } from 'react';
import { Camera, MapPin, AlertCircle, CheckCircle2, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';

interface Props {
  requireLocation?: boolean;
  requireCamera?: boolean;
  requireOrientation?: boolean;
  onPermissionsGranted: () => void;
}

export default function PermissionsGate({ requireLocation, requireCamera, requireOrientation, onPermissionsGranted }: Props) {
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [cameraStatus, setCameraStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const { permission: orientationStatus, requestPermission } = useDeviceOrientation();

  useEffect(() => {
    // Check initial status if possible, but standard web APIs usually require direct user interaction
    // to request. We'll wait for them to click.
    if (!requireLocation) setLocationStatus('granted');
    if (!requireCamera) setCameraStatus('granted');
  }, [requireLocation, requireCamera]);

  useEffect(() => {
    const isOrientationReady = !requireOrientation || orientationStatus === 'granted' || orientationStatus === 'unavailable';
    if (locationStatus === 'granted' && cameraStatus === 'granted' && isOrientationReady) {
      onPermissionsGranted();
    }
  }, [locationStatus, cameraStatus, orientationStatus, requireOrientation, onPermissionsGranted]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus('granted'),
      () => setLocationStatus('denied')
    );
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop tracks immediately as we just needed permission here
      stream.getTracks().forEach(track => track.stop());
      setCameraStatus('granted');
    } catch (err) {
      setCameraStatus('denied');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-[#151e18] rounded-2xl p-6 border border-slate-100 dark:border-[#24352b] shadow-xl max-w-md w-full mx-auto"
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#1a2e16] dark:text-slate-200 mb-2">Permessi Necessari</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Per partecipare a questo gioco, l'app ha bisogno di accedere ad alcune funzionalità del tuo dispositivo.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {requireLocation && (
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1a261f] rounded-xl border border-slate-100 dark:border-[#24352b]">
            <div className="flex items-center gap-3">
              <MapPin size={20} className={locationStatus === 'granted' ? 'text-[#2D5A27] dark:text-[#42a83a]' : 'text-slate-400'} />
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">GPS Sensori</p>
                <p className="text-xs text-slate-500">Per trovarti sulla mappa</p>
              </div>
            </div>
            {locationStatus === 'granted' ? (
              <CheckCircle2 size={20} className="text-[#2D5A27] dark:text-[#42a83a]" />
            ) : locationStatus === 'denied' ? (
              <span className="text-xs font-bold text-red-500 uppercase">Negato</span>
            ) : (
              <button onClick={requestLocation} className="text-xs font-bold uppercase tracking-wider text-[#2D5A27] dark:text-[#42a83a] bg-[#2D5A27]/10 dark:bg-[#42a83a]/20 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                Consenti
              </button>
            )}
          </div>
        )}

        {requireCamera && (
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1a261f] rounded-xl border border-slate-100 dark:border-[#24352b]">
            <div className="flex items-center gap-3">
              <Camera size={20} className={cameraStatus === 'granted' ? 'text-[#2D5A27] dark:text-[#42a83a]' : 'text-slate-400'} />
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Fotocamera</p>
                <p className="text-xs text-slate-500">Per fare magic scan (AR)</p>
              </div>
            </div>
            {cameraStatus === 'granted' ? (
              <CheckCircle2 size={20} className="text-[#2D5A27] dark:text-[#42a83a]" />
            ) : cameraStatus === 'denied' ? (
              <span className="text-xs font-bold text-red-500 uppercase">Negato</span>
            ) : (
              <button onClick={requestCamera} className="text-xs font-bold uppercase tracking-wider text-[#2D5A27] dark:text-[#42a83a] bg-[#2D5A27]/10 dark:bg-[#42a83a]/20 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                Consenti
              </button>
            )}
          </div>
        )}
        
        {requireOrientation && orientationStatus !== 'unavailable' && (
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1a261f] rounded-xl border border-slate-100 dark:border-[#24352b]">
            <div className="flex items-center gap-3">
              <Navigation size={20} className={orientationStatus === 'granted' ? 'text-[#2D5A27] dark:text-[#42a83a]' : 'text-slate-400'} />
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Bussola/Giroscopio</p>
                <p className="text-xs text-slate-500">Per orientarti nel mondo</p>
              </div>
            </div>
            {orientationStatus === 'granted' ? (
              <CheckCircle2 size={20} className="text-[#2D5A27] dark:text-[#42a83a]" />
            ) : orientationStatus === 'denied' ? (
              <span className="text-xs font-bold text-red-500 uppercase">Negato</span>
            ) : (
              <button onClick={requestPermission} className="text-xs font-bold uppercase tracking-wider text-[#2D5A27] dark:text-[#42a83a] bg-[#2D5A27]/10 dark:bg-[#42a83a]/20 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                Consenti
              </button>
            )}
          </div>
        )}
      </div>
      
      {(locationStatus === 'denied' || cameraStatus === 'denied' || orientationStatus === 'denied') && (
        <p className="text-xs text-red-500 text-center mb-4">
          Non puoi partecipare senza questi permessi. Controlla le impostazioni del browser o ricarica la pagina.
        </p>
      )}
    </motion.div>
  );
}
