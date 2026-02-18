/**
 * PileDialog - Dialog for placing foundation piles
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

interface PileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: (label: string, diameter: number, fontSize: number, showCross: boolean) => void;
}

export function PileDialog({ isOpen, onClose, onDraw }: PileDialogProps) {
  const [label, setLabel] = useState('P1');
  const [diameter, setDiameter] = useState(600);
  const [fontSize, setFontSize] = useState(200);
  const [showCross, setShowCross] = useState(true);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, label')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDraw = () => {
    onDraw(label, diameter, fontSize, showCross);
  };

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="bg-cad-surface border border-cad-border shadow-xl w-[360px] flex flex-col"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-cad-border cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-sm font-semibold text-cad-text">Pile</h2>
          <button onClick={onClose} className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              placeholder="P1, P2..."
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Diameter</label>
            <input
              type="number"
              value={diameter}
              onChange={(e) => setDiameter(Math.max(100, Number(e.target.value)))}
              className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              min={100}
              step={50}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Font Size</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Math.max(50, Number(e.target.value)))}
              className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              min={50}
              step={50}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Show Cross</label>
            <input
              type="checkbox"
              checked={showCross}
              onChange={(e) => setShowCross(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cad-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-cad-bg border border-cad-border text-cad-text rounded hover:bg-cad-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleDraw}
            className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Place
          </button>
        </div>
      </div>
    </div>
  );
}

export default PileDialog;
