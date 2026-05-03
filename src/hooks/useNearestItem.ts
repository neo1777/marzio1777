import { useState, useEffect } from 'react';
import { calculateDistance, Position } from './useHighAccuracyPosition';

export interface GameItem {
   id: string;
   lat: number;
   lng: number;
   points: number;
   status: 'spawned' | 'collected';
   collectedBy: string | null;
   templateId: string;
   emoji?: string;
   label?: string;
}

export function useNearestItem(position: Position | null, items: GameItem[]) {
  const [nearestItem, setNearestItem] = useState<GameItem | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!position || !items || items.length === 0) {
      setNearestItem(null);
      setDistance(null);
      return;
    }

    let minDistance = Infinity;
    let closestItem: GameItem | null = null;

    items.forEach(item => {
      if (item.status === 'collected') return; // Skip collected items

      const dist = calculateDistance(position.lat, position.lng, item.lat, item.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestItem = item;
      }
    });

    if (minDistance === Infinity) {
       setNearestItem(null);
       setDistance(null);
    } else {
       setNearestItem(closestItem);
       setDistance(minDistance);
    }
  }, [position, items]);

  return { nearestItem, distance };
}

export function getHotColdStatus(distance: number | null): { label: string, color: string, pulse: boolean } {
   if (distance === null) return { label: 'In attesa del GPS...', color: 'text-slate-400', pulse: false };
   
   if (distance <= 15) return { label: 'BOLLENTE! È qui vicino', color: 'text-red-600', pulse: true }; // Capture radius
   if (distance <= 50) return { label: 'Fuochino...', color: 'text-orange-500', pulse: false };
   if (distance <= 150) return { label: 'Tiepido', color: 'text-amber-500', pulse: false };
   return { label: 'Acqua...', color: 'text-blue-500', pulse: false };
}
