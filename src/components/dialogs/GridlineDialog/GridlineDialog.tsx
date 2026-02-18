/**
 * GridlineDialog - Dialog for drawing structural grid lines (stramien)
 *
 * Allows users to:
 * - Set grid line label (number or letter)
 * - Choose bubble position (start, end, both)
 * - Set bubble radius
 * - Set font size
 * - Enter drawing mode to place gridline start and end points
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { GridlineBubblePosition } from '../../../types/geometry';

interface GridlineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: (
    label: string,
    bubblePosition: GridlineBubblePosition,
    bubbleRadius: number,
    fontSize: number,
  ) => void;
}

export function GridlineDialog({ isOpen, onClose, onDraw }: GridlineDialogProps) {
  const [label, setLabel] = useState('1');
  const [bubblePosition, setBubblePosition] = useState<GridlineBubblePosition>('start');
  const [bubbleRadius, setBubbleRadius] = useState(300);
  const [fontSize, setFontSize] = useState(315);

  // Drag state for movable modal
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Drag handlers
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

  // Draw handler
  const handleDraw = () => {
    onDraw(label, bubblePosition, bubbleRadius, fontSize);
  };

  // Reset position on open
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
          <h2 className="text-sm font-semibold text-cad-text">Grid Line</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Label */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              placeholder="1, A, B..."
            />
          </div>

          {/* Bubble Position */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Bubble Position</label>
            <select
              value={bubblePosition}
              onChange={(e) => setBubblePosition(e.target.value as GridlineBubblePosition)}
              className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
            >
              <option value="start">Start</option>
              <option value="end">End</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Bubble Radius */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-cad-text-secondary w-24">Bubble Radius</label>
            <input
              type="number"
              value={bubbleRadius}
              onChange={(e) => setBubbleRadius(Math.max(50, Number(e.target.value)))}
              className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              min={50}
              step={50}
            />
          </div>

          {/* Font Size */}
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
            Draw
          </button>
        </div>
      </div>
    </div>
  );
}

export default GridlineDialog;
