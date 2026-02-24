import { useState } from 'react';
import { DraggableModal, ModalButton } from '../../shared/DraggableModal';
import type { Sheet } from '../../../types/geometry';

interface SheetSelectionDialogProps {
  sheets: Sheet[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onCancel: () => void;
}

export function SheetSelectionDialog({ sheets, selectedIds, onConfirm, onCancel }: SheetSelectionDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <DraggableModal
      isOpen={true}
      onClose={onCancel}
      title="Select Sheets"
      width={360}
      height={400}
      zIndex={60}
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={() => onConfirm(Array.from(selected))}>OK</ModalButton>
        </>
      }
    >
      <div className="flex gap-2 px-3 pt-2">
        <button
          onClick={() => setSelected(new Set(sheets.map(s => s.id)))}
          className="text-xs text-cad-accent hover:underline"
        >
          Select All
        </button>
        <button
          onClick={() => setSelected(new Set())}
          className="text-xs text-cad-accent hover:underline"
        >
          Deselect All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sheets.length === 0 ? (
          <p className="text-xs text-cad-text-dim">No sheets available.</p>
        ) : (
          sheets.map(sheet => (
            <label key={sheet.id} className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={selected.has(sheet.id)}
                onChange={() => toggle(sheet.id)}
                className="accent-cad-accent"
              />
              <span className="text-xs text-cad-text">{sheet.name}</span>
              <span className="text-xs text-cad-text-dim ml-auto">
                {sheet.paperSize} {sheet.orientation}
              </span>
            </label>
          ))
        )}
      </div>
    </DraggableModal>
  );
}
