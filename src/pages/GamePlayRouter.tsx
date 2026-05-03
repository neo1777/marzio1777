import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGameEvent } from '../hooks/useGameEvents';
import TreasureHuntPlay from './TreasureHuntPlay';
import PhotoQuizPlay from './PhotoQuizPlay';
import { Loader2 } from 'lucide-react';

export default function GamePlayRouter() {
   const { eventId } = useParams();
   const { event } = useGameEvent(eventId || '');

   if (!event) {
      return (
         <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-500" size={32} />
         </div>
      );
   }

   if (event.type === 'treasure_hunt') {
      return <TreasureHuntPlay />;
   } else if (event.type === 'photo_quiz') {
      return <PhotoQuizPlay />;
   }

   return <Navigate to="/dashboard/giochi" />;
}
