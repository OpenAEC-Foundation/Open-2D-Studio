/**
 * PileDialog - Dialog for placing foundation piles
 */

import { useState } from 'react';
import { DraggableModal, ModalButton } from '../../shared/DraggableModal';

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

  const handleDraw = () => {
    onDraw(label, diameter, fontSize, showCross);
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Pile"
      width={360}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={handleDraw} variant="primary">Place</ModalButton>
        </>
      }
    >
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
    </DraggableModal>
  );
}

export default PileDialog;
