import React from 'react';
import { QueueItem } from '../../types/audio';
import { Music, Play, X, Ban, GripVertical, AlertTriangle } from 'lucide-react';
import { Button, Avatar } from '../ui';

interface QueueItemCardProps {
   item: QueueItem;
   isDJ: boolean;
   isProposer: boolean;
   onWithdraw?: (id: string) => void;
   onKick?: (id: string) => void;
   onForcePlay?: (id: string) => void;
   dragHandleProps?: any; // For drag and drop
}

const statusColors: any = {
   queued: 'bg-secondary/50 text-secondary-foreground border-secondary',
   transferring: 'bg-primary/20 text-primary border-primary/50 animate-pulse',
   ready: 'bg-green-500/20 text-green-400 border-green-500/50',
   playing: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
   played: 'bg-muted/50 text-muted-foreground border-muted',
   skipped: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
   failed: 'bg-destructive/20 text-destructive border-destructive/50'
};

const statusLabels: any = {
   queued: 'In attesa',
   transferring: 'Caricamento...',
   ready: 'Pronto',
   playing: 'In riproduzione',
   played: 'Riprod.',
   skipped: 'Saltato',
   failed: 'Fallito'
};

export function QueueItemCard({ item, isDJ, isProposer, onWithdraw, onKick, onForcePlay, dragHandleProps }: QueueItemCardProps) {
   return (
      <div className={`flex items-center p-3 rounded-xl border bg-card/40 backdrop-blur-sm transition-all
         ${item.status === 'playing' ? 'border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]' : 'border-border/50'}`}
      >
         {isDJ && (item.status === 'queued' || item.status === 'ready') && (
            <div className="mr-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" {...dragHandleProps}>
               <GripVertical className="w-5 h-5" />
            </div>
         )}
         
         <div className="relative mr-4 shrink-0">
            {item.trackCoverDataUrl ? (
               <img src={item.trackCoverDataUrl} className="w-12 h-12 rounded-md object-cover ring-1 ring-border/50" />
            ) : (
               <div className="w-12 h-12 rounded-md bg-secondary/50 flex items-center justify-center ring-1 ring-border/50">
                  <Music className="w-6 h-6 text-muted-foreground" />
               </div>
            )}
            <Avatar
               photoURL={item.proposedByPhotoURL}
               name={item.proposedByName}
               size="xs"
               className="absolute -bottom-1 -right-1 border border-background shadow-sm"
            />
         </div>
         
         <div className="flex-1 min-w-0 mr-4">
            <div className="font-semibold text-sm truncate">{item.trackTitle}</div>
            <div className="flex items-center text-xs text-muted-foreground truncate">
               <span className="truncate">{item.trackArtist}</span>
               <span className="mx-1">•</span>
               <span>{formatMs(item.trackDurationMs)}</span>
            </div>
            
            {(item.status === 'failed' && item.transferFailureReason) && (
               <div className="text-[10px] text-destructive flex items-center mt-0.5">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {item.transferFailureReason}
               </div>
            )}
         </div>
         
         <div className="flex items-center space-x-2 shrink-0">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${statusColors[item.status]}`}>
               {statusLabels[item.status]}
            </span>
            
            {isDJ && item.status === 'ready' && onForcePlay && (
               <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/20 hover:text-primary" onClick={() => onForcePlay(item.id)}>
                  <Play className="w-4 h-4" />
               </Button>
            )}
            
            {isDJ && (item.status === 'queued' || item.status === 'failed') && onKick && (
               <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive" onClick={() => onKick(item.id)}>
                  <Ban className="w-4 h-4" />
               </Button>
            )}
            
            {isProposer && item.status === 'queued' && onWithdraw && (
               <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive" onClick={() => onWithdraw(item.id)}>
                  Ritira
               </Button>
            )}
         </div>
      </div>
   );
}

function formatMs(ms: number) {
   if (!ms) return '0:00';
   const totalSeconds = Math.floor(ms / 1000);
   const m = Math.floor(totalSeconds / 60);
   const s = totalSeconds % 60;
   return `${m}:${s.toString().padStart(2, '0')}`;
}
