import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  isActive: boolean;
  status: 'Speaking' | 'Thinking' | 'Listening' | 'Busy' | 'Offline' | 'Typing';
}

export default function WaveformVisualizer({ isActive, status }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high density displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;

      // Color mapping based on EXOS state
      let colorStr = 'rgba(59, 130, 246, 0.5)'; // default electric blue
      let speed = 0.08;
      let amplitude = 15;
      let waveCount = 3;

      if (!isActive || status === 'Offline' || status === 'Busy') {
        amplitude = 1.5; // subtle line
        colorStr = 'rgba(148, 163, 184, 0.2)'; // slate line
        speed = 0.01;
        waveCount = 1;
      } else if (status === 'Thinking' || status === 'Typing') {
        colorStr = 'rgba(168, 85, 247, 0.6)'; // deep purple
        speed = 0.15;
        amplitude = 20;
        waveCount = 5;
      } else if (status === 'Listening') {
        colorStr = 'rgba(20, 184, 166, 0.5)'; // teal
        speed = 0.05;
        amplitude = 10;
        waveCount = 2;
      } else if (status === 'Speaking') {
        colorStr = 'rgba(59, 130, 246, 0.7)'; // bold electric blue
        speed = 0.18;
        amplitude = 30;
        waveCount = 4;
      }

      phase += speed;

      // Draw layered sine waves for a premium "Apple/Siri glass" look
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const waveOffset = w * (Math.PI / 4);
        const currentAmp = amplitude * (1 - w * 0.2);
        
        ctx.strokeStyle = w === 0 ? colorStr : colorStr.replace(/[\d.]+\)$/, `${0.25 - w * 0.05})`);
        ctx.lineWidth = w === 0 ? 2.5 : 1.5;

        for (let x = 0; x < width; x++) {
          const progress = x / width;
          // Apply a fade on both ends of the wave so it is a closed loop visually
          const envelope = Math.sin(progress * Math.PI);
          const y = centerY + Math.sin(progress * Math.PI * 3.5 + phase + waveOffset) * currentAmp * envelope;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Responsive resize handler
    const handleResize = () => {
      const activeRect = canvas.getBoundingClientRect();
      canvas.width = activeRect.width * dpr;
      canvas.height = activeRect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, status]);

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black/10 rounded-xl overflow-hidden backdrop-blur-sm border border-white/5">
      <canvas ref={canvasRef} className="w-full h-24" />
      
      {/* Floating Indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
        <span className={`w-2 h-2 rounded-full ${
          status === 'Speaking' ? 'bg-blue-500 animate-pulse' :
          status === 'Thinking' || status === 'Typing' ? 'bg-purple-500 animate-bounce' :
          status === 'Listening' ? 'bg-teal-500 animate-ping' :
          'bg-slate-500'
        }`} />
        <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400">
          EXOS State: {status}
        </span>
      </div>
    </div>
  );
}
