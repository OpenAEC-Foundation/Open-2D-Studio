/**
 * WallDialog - Dialog for drawing structural walls
 *
 * Wall hatching is now defined at the material level (via the Materials dialog),
 * not per-wall. The wall type references a material, and the renderer looks up
 * hatch settings from the wall type definition.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { WallJustification, WallEndCap, WallType } from '../../../types/geometry';
import { useAppStore } from '../../../state/appStore';

interface WallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: (
    thickness: number,
    options: {
      wallTypeId?: string;
      justification: WallJustification;
      showCenterline: boolean;
      startCap: WallEndCap;
      endCap: WallEndCap;
    }
  ) => void;
}

export function WallDialog({ isOpen, onClose, onDraw }: WallDialogProps) {
  const { wallTypes, addWallType, deleteWallType, lastUsedWallTypeId } = useAppStore();

  const [selectedWallTypeId, setSelectedWallTypeId] = useState<string>(lastUsedWallTypeId ?? 'beton-200');
  const [customThickness, setCustomThickness] = useState(200);
  const [justification, setJustification] = useState<WallJustification>('center');
  const [showCenterline, setShowCenterline] = useState(false);
  const [endCap, setEndCap] = useState<WallEndCap>('butt');
  const [showTypeManager, setShowTypeManager] = useState(false);

  // New type form
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeMaterial, setNewTypeMaterial] = useState<WallType['material']>('concrete');

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

  // Auto-fill thickness from selected wall type
  const selectedType = wallTypes.find(t => t.id === selectedWallTypeId);

  const handleDraw = () => {
    onDraw(customThickness, {
      wallTypeId: selectedWallTypeId,
      justification,
      showCenterline,
      startCap: endCap,
      endCap: endCap,
    });
  };

  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    const id = `custom-${Date.now()}`;
    addWallType({
      id,
      name: newTypeName.trim(),
      thickness: 200, // Default thickness (set per-wall when drawing)
      material: newTypeMaterial,
    });
    setNewTypeName('');
    setSelectedWallTypeId(id);
  };

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setShowTypeManager(false);
      // Restore last-used wall type when dialog opens
      setSelectedWallTypeId(lastUsedWallTypeId ?? 'beton-200');
    }
  }, [isOpen, lastUsedWallTypeId]);

  // When wall type changes, update thickness to match
  useEffect(() => {
    if (selectedType) {
      setCustomThickness(selectedType.thickness);
    }
  }, [selectedWallTypeId, selectedType]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="bg-cad-surface border border-cad-border shadow-xl w-[420px] flex flex-col"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-cad-border cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-sm font-semibold text-cad-text">
            {showTypeManager ? 'Materials' : 'Wall'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary">
            <X size={14} />
          </button>
        </div>

        {showTypeManager ? (
          /* Wall Type Manager */
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {/* Existing types */}
            {wallTypes.map(wt => (
              <div key={wt.id} className="flex items-center gap-2 p-2 bg-cad-bg rounded border border-cad-border">
                <div className="flex-1">
                  <div className="text-xs text-cad-text font-medium">{wt.name} {wt.thickness}mm</div>
                  <div className="text-[10px] text-cad-text-secondary">
                    {wt.material}
                  </div>
                </div>
                <button
                  onClick={() => deleteWallType(wt.id)}
                  className="p-1 hover:bg-red-500/20 rounded text-cad-text-secondary hover:text-red-400"
                  title="Delete type"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Add new type */}
            <div className="border-t border-cad-border pt-3 space-y-2">
              <div className="text-xs text-cad-text-secondary font-medium">Add New Material</div>
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Material name..."
                className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              />
              <select
                value={newTypeMaterial}
                onChange={(e) => setNewTypeMaterial(e.target.value as WallType['material'])}
                className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
              >
                <option value="concrete">Beton</option>
                <option value="masonry">Metselwerk</option>
                <option value="calcium-silicate">Kalkzandsteen</option>
                <option value="timber">Hout</option>
                <option value="steel">Staal</option>
                <option value="generic">Overig</option>
              </select>
              <button
                onClick={handleAddType}
                disabled={!newTypeName.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={12} /> Add Material
              </button>
            </div>

            <p className="text-[10px] text-cad-text-dim">
              Hatch patterns are defined per material in the Materials dialog.
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTypeManager(false)}
                className="px-3 py-1.5 text-xs bg-cad-bg border border-cad-border text-cad-text rounded hover:bg-cad-hover"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          /* Wall Drawing Settings */
          <>
            <div className="p-4 space-y-3">
              {/* Material */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-cad-text-secondary w-24">Material</label>
                <select
                  value={selectedWallTypeId}
                  onChange={(e) => {
                    setSelectedWallTypeId(e.target.value);
                  }}
                  className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                >
                  {wallTypes.map(wt => (
                    <option key={wt.id} value={wt.id}>
                      {wt.name} {wt.thickness}mm
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowTypeManager(true)}
                  className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary"
                  title="Manage materials"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Material info */}
              {selectedType && (
                <div className="px-2 py-1.5 bg-cad-bg rounded border border-cad-border">
                  <div className="text-[10px] text-cad-text-dim">
                    Material: {selectedType.material}
                  </div>
                </div>
              )}

              {/* Thickness */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-cad-text-secondary w-24">Thickness (mm)</label>
                <input
                  type="number"
                  value={customThickness}
                  onChange={(e) => setCustomThickness(Math.max(1, Number(e.target.value)))}
                  className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                  min={1}
                  step={1}
                />
              </div>

              {/* Justification */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-cad-text-secondary w-24">Justification</label>
                <select
                  value={justification}
                  onChange={(e) => setJustification(e.target.value as WallJustification)}
                  className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {/* Show Centerline */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-cad-text-secondary w-24">Centerline</label>
                <input
                  type="checkbox"
                  checked={showCenterline}
                  onChange={(e) => setShowCenterline(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-xs text-cad-text-secondary">Show centerline</span>
              </div>

              {/* End Cap */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-cad-text-secondary w-24">End Cap</label>
                <select
                  value={endCap}
                  onChange={(e) => setEndCap(e.target.value as WallEndCap)}
                  className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                >
                  <option value="butt">Butt</option>
                  <option value="miter">Miter</option>
                </select>
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
          </>
        )}
      </div>
    </div>
  );
}

export default WallDialog;
