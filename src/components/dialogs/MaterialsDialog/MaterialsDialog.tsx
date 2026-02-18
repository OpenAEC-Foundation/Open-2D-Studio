/**
 * MaterialsDialog - Manage IFC Materials
 *
 * Shows the canonical material categories (IfcMaterial standard).
 * Materials are pure categories -- no thicknesses.
 * Hatch patterns are managed in Drawing Standards per material category.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../../state/appStore';
import { MATERIAL_CATEGORIES, type MaterialCategoryInfo } from '../../../types/geometry';

interface MaterialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MaterialsDialog({ isOpen, onClose }: MaterialsDialogProps) {
  const { materialHatchSettings, openDrawingStandardsDialog } = useAppStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Drag state for movable modal
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

  useEffect(() => {
    if (isOpen) setPosition({ x: 0, y: 0 });
  }, [isOpen]);

  const selectedCategory: MaterialCategoryInfo | undefined = selectedCategoryId
    ? MATERIAL_CATEGORIES.find(c => c.id === selectedCategoryId)
    : undefined;

  const selectedHatch = selectedCategoryId ? materialHatchSettings[selectedCategoryId] : undefined;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="bg-cad-surface border border-cad-border shadow-xl w-[460px] max-h-[80vh] flex flex-col"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-cad-border cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div>
            <h2 className="text-sm font-semibold text-cad-text">Materials</h2>
            <span className="text-[10px] text-cad-text-dim">IfcMaterial (ISO 16739)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Material list */}
          <div className="w-[200px] border-r border-cad-border overflow-y-auto">
            {MATERIAL_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`w-full text-left px-4 py-2 text-xs ${
                  selectedCategoryId === cat.id
                    ? 'bg-cad-accent/20 text-cad-accent'
                    : 'text-cad-text-secondary hover:bg-cad-hover'
                }`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                {cat.label}
                <span className="text-cad-text-dim ml-1">({cat.labelEn})</span>
              </button>
            ))}
          </div>

          {/* Right: Selected material properties */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedCategory ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-cad-text">{selectedCategory.label}</h3>
                  <div className="text-[10px] text-cad-text-dim mt-0.5">
                    IFC Class: IfcMaterial &middot; Category: {selectedCategory.labelEn}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-cad-text-dim mb-0.5">Material ID</label>
                  <input
                    type="text"
                    value={selectedCategory.id}
                    readOnly
                    disabled
                    className="w-full h-7 px-2 text-xs bg-cad-bg/50 border border-cad-border text-cad-text-dim rounded cursor-not-allowed"
                  />
                </div>

                {selectedHatch && (
                  <div>
                    <label className="block text-[10px] text-cad-text-dim mb-0.5">Hatch Pattern</label>
                    <input
                      type="text"
                      value={selectedHatch.hatchPatternId || selectedHatch.hatchType}
                      readOnly
                      disabled
                      className="w-full h-7 px-2 text-xs bg-cad-bg/50 border border-cad-border text-cad-text-dim rounded cursor-not-allowed"
                    />
                  </div>
                )}

                <button
                  className="px-3 py-1.5 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded"
                  onClick={() => {
                    onClose();
                    openDrawingStandardsDialog();
                  }}
                >
                  Edit Hatch in Drawing Standards...
                </button>

                <p className="text-[10px] text-cad-text-dim mt-2">
                  Hatch patterns are defined per material category in Drawing Standards.
                  Wall types, slab types, columns, and beams reference these material categories.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
                Select a material to view properties
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-2 border-t border-cad-border">
          <button
            onClick={onClose}
            className="px-4 h-7 text-xs bg-cad-bg border border-cad-border text-cad-text hover:bg-cad-hover rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
