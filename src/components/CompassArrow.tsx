import React from 'react';
import { Navigation } from 'lucide-react';
import { bearing } from '../utils/geo';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';

interface Props {
  playerPos: { lat: number, lng: number } | null;
  targetPos: { lat: number, lng: number } | null;
}

export default function CompassArrow({ playerPos, targetPos }: Props) {
  const { orientation } = useDeviceOrientation();
  const heading = orientation.heading;

  if (!playerPos || !targetPos) return null;

  const targetBearing = bearing(playerPos, targetPos);
  const rotation = heading !== null ? targetBearing - heading : targetBearing;

  return (
    <div 
      className="bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-lg w-12 h-12 rounded-2xl flex items-center justify-center text-[#2D5A27] dark:text-[#42a83a] border border-slate-200 dark:border-slate-700 transition-transform duration-200"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
       <Navigation size={24} className="fill-[#2D5A27] dark:fill-[#42a83a]" />
    </div>
  );
}
