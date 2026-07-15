import { useState, useRef, useEffect, MouseEvent } from 'react';
import { WhiteboardElement } from '../types';
import { exosAdapter } from '../lib/exosAdapter';
import { Square, Circle, Type as FontIcon, Trash2, Palette, Edit3, Sparkles } from 'lucide-react';

interface SharedWhiteboardProps {
  meetingId: string;
}

export default function SharedWhiteboard({ meetingId }: SharedWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [tool, setTool] = useState<'path' | 'rect' | 'circle' | 'text'>('path');
  const [color, setColor] = useState<string>('#3b82f6'); // Electric blue by default
  const [textInput, setTextInput] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePath = useRef<number[]>([]);

  // Load whiteboard elements
  useEffect(() => {
    let active = true;
    const fetchWhiteboard = async () => {
      try {
        const boardElements = await exosAdapter.getWhiteboard(meetingId);
        if (active) {
          setElements(boardElements);
          redrawCanvas(boardElements);
        }
      } catch (e) {
        console.error('Failed to load whiteboard elements:', e);
      }
    };

    fetchWhiteboard();
    // Poll whiteboard updates every 4 seconds to simulate collaboration
    const interval = setInterval(fetchWhiteboard, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [meetingId]);

  // Redraw canvas from element array
  const redrawCanvas = (allElements: WhiteboardElement[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    allElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = 3;

      if (el.type === 'path' && el.points) {
        ctx.beginPath();
        for (let i = 0; i < el.points.length; i += 2) {
          if (i === 0) {
            ctx.moveTo(el.points[i], el.points[i + 1]);
          } else {
            ctx.lineTo(el.points[i], el.points[i + 1]);
          }
        }
        ctx.stroke();
      } else if (el.type === 'rect' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'circle' && el.x !== undefined && el.y !== undefined && el.width !== undefined) {
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.width, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'text' && el.x !== undefined && el.y !== undefined && el.text) {
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText(el.text, el.x, el.y);
      }
    });
  };

  const getCanvasCoords = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    startPos.current = coords;

    if (tool === 'path') {
      activePath.current = [coords.x, coords.y];
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    // Live preview
    redrawCanvas(elements);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;

    if (tool === 'path') {
      activePath.current.push(coords.x, coords.y);
      ctx.beginPath();
      for (let i = 0; i < activePath.current.length; i += 2) {
        if (i === 0) {
          ctx.moveTo(activePath.current[i], activePath.current[i + 1]);
        } else {
          ctx.lineTo(activePath.current[i], activePath.current[i + 1]);
        }
      }
      ctx.stroke();
    } else if (tool === 'rect') {
      const width = coords.x - startPos.current.x;
      const height = coords.y - startPos.current.y;
      ctx.strokeRect(startPos.current.x, startPos.current.y, width, height);
    } else if (tool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(coords.x - startPos.current.x, 2) + Math.pow(coords.y - startPos.current.y, 2)
      );
      ctx.beginPath();
      ctx.arc(startPos.current.x, startPos.current.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const handleMouseUp = async (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const coords = getCanvasCoords(e);
    let newElement: WhiteboardElement | null = null;

    if (tool === 'path' && activePath.current.length > 2) {
      newElement = {
        id: `el-${Date.now()}`,
        type: 'path',
        points: [...activePath.current],
        color,
      };
    } else if (tool === 'rect') {
      const width = coords.x - startPos.current.x;
      const height = coords.y - startPos.current.y;
      newElement = {
        id: `el-${Date.now()}`,
        type: 'rect',
        x: startPos.current.x,
        y: startPos.current.y,
        width,
        height,
        color,
      };
    } else if (tool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(coords.x - startPos.current.x, 2) + Math.pow(coords.y - startPos.current.y, 2)
      );
      newElement = {
        id: `el-${Date.now()}`,
        type: 'circle',
        x: startPos.current.x,
        y: startPos.current.y,
        width: radius,
        color,
      };
    } else if (tool === 'text') {
      const textToSave = textInput.trim() || 'Text Label';
      newElement = {
        id: `el-${Date.now()}`,
        type: 'text',
        x: startPos.current.x,
        y: startPos.current.y,
        text: textToSave,
        color,
      };
      setTextInput('');
    }

    if (newElement) {
      try {
        const saved = await exosAdapter.saveWhiteboardElement(meetingId, newElement);
        const updatedList = [...elements, saved];
        setElements(updatedList);
        redrawCanvas(updatedList);
      } catch (err) {
        console.error('Failed to save element:', err);
      }
    }
  };

  const clearCanvas = async () => {
    try {
      await exosAdapter.clearWhiteboard(meetingId);
      setElements([]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (e) {
      console.error('Failed to clear whiteboard:', e);
    }
  };

  const handleAIWhiteboardGenerate = async () => {
    // Simulated AI assistance that places standard mock diagram templates
    const flowElements: WhiteboardElement[] = [
      { id: 'flow-1', type: 'rect', x: 50, y: 100, width: 120, height: 60, color: '#3b82f6' },
      { id: 'flow-2', type: 'text', x: 65, y: 135, text: 'EXOS Core', color: '#3b82f6' },
      { id: 'flow-3', type: 'circle', x: 300, y: 130, width: 40, color: '#14b8a6' },
      { id: 'flow-4', type: 'text', x: 270, y: 135, text: 'Brain-AI', color: '#14b8a6' },
      { id: 'flow-5', type: 'rect', x: 450, y: 100, width: 120, height: 60, color: '#a855f7' },
      { id: 'flow-6', type: 'text', x: 465, y: 135, text: 'Compliance', color: '#a855f7' }
    ];

    for (const el of flowElements) {
      await exosAdapter.saveWhiteboardElement(meetingId, el);
    }
    const refreshed = await exosAdapter.getWhiteboard(meetingId);
    setElements(refreshed);
    redrawCanvas(refreshed);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Control Rail */}
      <div className="flex items-center justify-between p-2 bg-slate-900/60 border border-white/5 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <button
            id="wb-pen"
            onClick={() => setTool('path')}
            className={`p-2 rounded-lg transition-all ${
              tool === 'path' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Pen Tool"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            id="wb-rect"
            onClick={() => setTool('rect')}
            className={`p-2 rounded-lg transition-all ${
              tool === 'rect' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Rectangle Tool"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            id="wb-circle"
            onClick={() => setTool('circle')}
            className={`p-2 rounded-lg transition-all ${
              tool === 'circle' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Circle Tool"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            id="wb-text"
            onClick={() => setTool('text')}
            className={`p-2 rounded-lg transition-all ${
              tool === 'text' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Text Tool"
          >
            <FontIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Text Input Indicator for Font tool */}
        {tool === 'text' && (
          <input
            id="wb-text-val"
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type text, then drag on canvas..."
            className="px-2 py-1 text-xs bg-slate-800 border border-white/10 rounded text-white w-40 outline-none"
          />
        )}

        {/* Color Palette */}
        <div className="flex items-center gap-1">
          {['#3b82f6', '#a855f7', '#14b8a6', '#f43f5e', '#ffffff'].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border transition-transform ${
                color === c ? 'scale-125 border-white' : 'border-white/10 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="wb-ai-diagram"
            onClick={handleAIWhiteboardGenerate}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-blue-400 transition-all cursor-pointer"
            title="Generate AI Blueprint Architecture Diagram"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Flow</span>
          </button>
          <button
            id="wb-clear"
            onClick={clearCanvas}
            className="p-2 text-slate-400 hover:text-red-400 rounded-lg transition-all"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Actual Drawing Canvas stage */}
      <div className="flex-1 bg-slate-950/80 border border-white/5 rounded-2xl relative overflow-hidden h-72">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          width={700}
          height={320}
          className="absolute inset-0 w-full h-full cursor-crosshair"
        />
        
        {elements.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-500 text-xs">
            <Palette className="w-8 h-8 mb-2 opacity-30 text-blue-400 animate-pulse" />
            <p className="font-medium">Shared EXOS Interactive Canvas</p>
            <p className="opacity-60 text-[10px] mt-1">Draw architectures, flows, or trigger AI layouts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
