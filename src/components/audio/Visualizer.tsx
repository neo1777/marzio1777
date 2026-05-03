import React, { useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  analyser: AnalyserNode;
  isPlaying: boolean;
}

export default function Visualizer({ analyser, isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      if (!isPlaying) {
         // fade out slowly
         ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         return;
      }

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0A0A0F';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Only use lower frequencies to avoid flat lines on high freq
      const barCount = 32;
      const barWidth = (canvas.width / barCount) - 2;
      let x = 0;

      for (let i = 0; i < barCount; i++) {
        // Logarithmic scale for better visualization
        const index = Math.floor(Math.pow(i / barCount, 2) * (bufferLength * 0.5));
        const barHeight = (dataArray[index] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#FFA000'); // ambra
        gradient.addColorStop(1, '#C2410C'); // crimson

        ctx.fillStyle = gradient;
        
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 160, 0, 0.5)';
        
        const y = canvas.height - barHeight;
        // rounded top using arcs is heavier, simple rect for perf
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.shadowBlur = 0;
        x += barWidth + 2;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, prefersReducedMotion]);

  if (prefersReducedMotion) {
      return <div className="w-full h-16 bg-[#0A0A0F] rounded-lg border border-[#24352b] flex items-center justify-center text-[#879b8f] text-xs">Visualizzatore disabilitato (Reduced Motion)</div>;
  }

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={100} 
      className="w-full h-16 sm:h-24 rounded-lg bg-[#0A0A0F] border border-[#24352b] object-contain"
    />
  );
}
