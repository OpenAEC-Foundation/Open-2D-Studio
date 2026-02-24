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

import { useState } from 'react';
import { DraggableModal, ModalButton } from '../../shared/DraggableModal';
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

  // Draw handler
  const handleDraw = () => {
    onDraw(label, bubblePosition, bubbleRadius, fontSize);
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Grid Line"
      width={360}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={handleDraw} variant="primary">Draw</ModalButton>
        </>
      }
    >
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
    </DraggableModal>
  );
}
