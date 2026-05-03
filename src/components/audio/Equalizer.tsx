import React, { useState, useEffect } from 'react';

interface Props {
  onEQChange: (low: number, mid: number, high: number) => void;
}

export default function Equalizer({ onEQChange }: Props) {
  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);

  useEffect(() => {
    onEQChange(low, mid, high);
  }, [low, mid, high, onEQChange]);

  const Slider = ({ label, value, setter }: { label: string, value: number, setter: (v: number) => void }) => (
    <div className="flex flex-col items-center gap-2">
       <span className="text-xs font-mono text-[#F5F0E1]">{value > 0 ? `+${value}` : value} dB</span>
       <input 
          type="range" 
          min="-12" 
          max="12" 
          step="1"
          value={value}
          onChange={(e) => setter(parseInt(e.target.value))}
          className="h-24 w-1 appearance-none bg-[#24352b] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FFA000] cursor-pointer"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
       />
       <span className="text-[10px] font-bold tracking-widest text-[#879b8f] uppercase">{label}</span>
    </div>
  );

  return (
    <div className="flex justify-center gap-8 p-4 bg-[#16161D] rounded-2xl border border-[#24352b]">
       <Slider label="Low" value={low} setter={setLow} />
       <Slider label="Mid" value={mid} setter={setMid} />
       <Slider label="High" value={high} setter={setHigh} />
    </div>
  );
}
