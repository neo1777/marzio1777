import React, { useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GameItem } from '../hooks/useNearestItem';
import { CameraOff, X } from 'lucide-react';
import { useCameraStream } from '../hooks/useCameraStream';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';

interface Props {
  item: GameItem;
  onCatch: (item: GameItem) => void;
  onCancel: (reason?: string) => void;
}

export default function ARCaptureLayer({ item, onCatch, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, error } = useCameraStream('environment');
  const { orientation } = useDeviceOrientation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleTap = async () => {
    onCatch(item);
  };

  if (error) {
     return (
        <div className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-6 text-center text-white">
           <CameraOff size={48} className="mb-4 text-slate-500" />
           <h2 className="text-xl font-bold mb-2">Errore Fotocamera</h2>
           <p className="text-slate-400 mb-6">{error.message}</p>
           <button onClick={() => onCancel()} className="px-6 py-3 bg-white/20 rounded-xl font-bold">Torna alla Mappa</button>
        </div>
     );
  }

  const xOffset = Math.max(-50, Math.min(50, orientation.gamma * 2));
  const yOffset = Math.max(-50, Math.min(50, (orientation.beta - 45) * 2));

  return (
    <div className="fixed inset-0 z-[2000] bg-black overflow-hidden flex flex-col">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <motion.div
           className="text-8xl pointer-events-auto cursor-pointer drop-shadow-2xl select-none min-w-[80px] min-h-[80px] flex items-center justify-center"
           style={{ x: prefersReducedMotion ? 0 : xOffset, y: prefersReducedMotion ? 0 : yOffset }}
           animate={prefersReducedMotion ? { scale: [1, 1.05, 1] } : {
             scale: [1, 1.1, 1],
             rotate: [0, 5, -5, 0],
           }}
           transition={{
             duration: 4,
             repeat: Infinity,
             ease: 'easeInOut',
           }}
           onClick={handleTap}
           role="button"
           aria-label="Cattura questo oggetto"
         >
           {item.emoji || '🍺'}
         </motion.div>
      </div>

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-10 bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-10">
         <div className="text-white mt-12 bg-black/40 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/10">
            <h3 className="font-bold text-lg leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{item.label || 'Mistero'}</h3>
            <p className="text-sm font-black text-amber-400" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{item.points} pt</p>
         </div>
         <button 
           onClick={() => onCancel()} 
           className="pointer-events-auto bg-black/50 mt-12 w-14 h-14 flex items-center justify-center rounded-full text-white backdrop-blur border border-white/10 min-w-[56px] min-h-[56px]"
           aria-label="Chiudi e torna alla mappa"
         >
            <X size={28} />
         </button>
      </div>

      <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none drop-shadow-2xl z-10" aria-live="polite">
         <p className="text-white font-bold text-lg bg-black/60 inline-block px-5 py-3 rounded-full backdrop-blur-md border border-white/20" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            Tocca l'oggetto per catturarlo!
         </p>
      </div>
    </div>
  );
}
