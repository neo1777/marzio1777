import React, { useCallback, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface Props {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}

export default function UploadZone({ onUpload, isUploading }: Props) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files));
    }
  }, [onUpload]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
  }, [onUpload]);

  return (
    <div 
      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors mb-6 ${isDragActive ? 'border-[#C2410C] bg-[#C2410C]/10' : 'border-[#24352b] bg-[#1a261f] hover:bg-[#24352b]'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        multiple 
        accept="audio/*" 
        className="hidden" 
        id="audio-upload" 
        onChange={handleChange}
        disabled={isUploading}
      />
      <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center justify-center min-h-[120px]">
        {isUploading ? (
          <>
            <Loader2 className="w-10 h-10 text-[#FFA000] animate-spin mb-3" />
            <p className="text-[#F5F0E1] font-medium">Elaborazione in corso...</p>
          </>
        ) : (
          <>
            <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? 'text-[#C2410C]' : 'text-[#879b8f]'}`} />
            <p className="text-[#F5F0E1] font-bold text-lg">Trascina tracce audio qui</p>
            <p className="text-[#879b8f] text-sm mt-1 mb-4">oppure tocca per selezionare (max 50MB per file)</p>
            <span className="px-5 py-2 rounded-xl bg-[#2D5A27] text-white font-bold text-sm tracking-widest hover:bg-[#23471f] transition-colors">
              SCEGLI FILE
            </span>
          </>
        )}
      </label>
    </div>
  );
}
