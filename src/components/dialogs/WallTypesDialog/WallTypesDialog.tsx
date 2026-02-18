/**
 * WallTypesDialog - Manage IFC Types (IfcWallType, IfcSlabType, IfcColumnType, IfcBeamType)
 *
 * Tabbed dialog showing IFC element types grouped by material category.
 * - "Wall Types" tab: wall type definitions (IfcWallType)
 * - "Slab Types" tab: slab type definitions (IfcSlabType)
 * - "Column Types" tab: column type definitions (IfcColumnType)
 * - "Beam Types" tab: beam type definitions (IfcBeamType)
 *
 * Allows adding, editing, and deleting type definitions with
 * name, material category, and type-specific dimensions.
 * Hatch patterns are managed in Drawing Standards per material category.
 *
 * UI pattern matches MaterialsDialog for consistency.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAppStore } from '../../../state/appStore';
import type { ColumnShapeType, BeamTypeProfileType, MaterialCategory } from '../../../types/geometry';
import { MATERIAL_CATEGORIES, getMaterialCategoryInfo } from '../../../types/geometry';
import { PROFILE_PRESETS, getAvailableStandards, getCategoriesForStandard } from '../../../services/parametric/profileLibrary';
import type { ProfilePreset } from '../../../types/parametric';

interface WallTypesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type IfcTypesTab = 'wall' | 'slab' | 'column' | 'beam' | 'profiles';

/**
 * NumericInput - Local-state numeric input that only commits on blur or Enter.
 * Allows the user to clear and retype values without the input fighting back.
 */
function NumericInput({ value, onCommit, min, placeholder, className }: {
  value: number | undefined;
  onCommit: (val: number) => void;
  min?: number;
  placeholder?: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value !== undefined ? String(value) : '');

  useEffect(() => {
    setLocalValue(value !== undefined ? String(value) : '');
  }, [value]);

  const commit = () => {
    const parsed = Number(localValue);
    if (!isNaN(parsed) && localValue.trim() !== '') {
      const clamped = min !== undefined ? Math.max(min, parsed) : parsed;
      onCommit(clamped);
      setLocalValue(String(clamped));
    } else {
      // Revert to original value on invalid input
      setLocalValue(value !== undefined ? String(value) : '');
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function WallTypesDialog({ isOpen, onClose }: WallTypesDialogProps) {
  const {
    wallTypes, addWallType, updateWallType, deleteWallType,
    slabTypes, addSlabType, updateSlabType, deleteSlabType,
    columnTypes, addColumnType, updateColumnType, deleteColumnType,
    beamTypes, addBeamType, updateBeamType, deleteBeamType,
  } = useAppStore();

  // Active tab
  const [activeTab, setActiveTab] = useState<IfcTypesTab>('wall');

  // Wall tab state
  const [wallExpandedCategories, setWallExpandedCategories] = useState<Set<string>>(
    new Set(MATERIAL_CATEGORIES.map(c => c.id))
  );
  const [selectedWallTypeId, setSelectedWallTypeId] = useState<string | null>(null);
  const [showWallAddForm, setShowWallAddForm] = useState(false);
  const [newWallThickness, setNewWallThickness] = useState(200);
  const [newWallMaterial, setNewWallMaterial] = useState<MaterialCategory>('concrete');

  // Slab tab state
  const [slabExpandedCategories, setSlabExpandedCategories] = useState<Set<string>>(
    new Set(MATERIAL_CATEGORIES.map(c => c.id))
  );
  const [selectedSlabTypeId, setSelectedSlabTypeId] = useState<string | null>(null);
  const [showSlabAddForm, setShowSlabAddForm] = useState(false);
  const [newSlabThickness, setNewSlabThickness] = useState(200);
  const [newSlabMaterial, setNewSlabMaterial] = useState<MaterialCategory>('concrete');

  // Column tab state
  const [columnExpandedCategories, setColumnExpandedCategories] = useState<Set<string>>(
    new Set(MATERIAL_CATEGORIES.map(c => c.id))
  );
  const [selectedColumnTypeId, setSelectedColumnTypeId] = useState<string | null>(null);
  const [showColumnAddForm, setShowColumnAddForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnMaterial, setNewColumnMaterial] = useState<MaterialCategory>('concrete');
  const [newColumnShape, setNewColumnShape] = useState<ColumnShapeType>('rectangular');
  const [newColumnWidth, setNewColumnWidth] = useState(300);
  const [newColumnDepth, setNewColumnDepth] = useState(300);

  // Beam tab state
  const [beamExpandedCategories, setBeamExpandedCategories] = useState<Set<string>>(
    new Set(MATERIAL_CATEGORIES.map(c => c.id))
  );
  const [selectedBeamTypeId, setSelectedBeamTypeId] = useState<string | null>(null);
  const [showBeamAddForm, setShowBeamAddForm] = useState(false);
  const [newBeamName, setNewBeamName] = useState('');
  const [newBeamMaterial, setNewBeamMaterial] = useState<MaterialCategory>('steel');
  const [newBeamProfileType, setNewBeamProfileType] = useState<BeamTypeProfileType>('i-beam');
  const [newBeamWidth, setNewBeamWidth] = useState(200);
  const [newBeamHeight, setNewBeamHeight] = useState(200);

  // Profiles tab state
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileExpandedCategories, setProfileExpandedCategories] = useState<Set<string>>(new Set<string>());
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Group profiles by standard -> category, with search filtering
  const profileGroups = useMemo(() => {
    const standards = getAvailableStandards();
    const groups: { standard: string; categories: { category: string; presets: ProfilePreset[] }[] }[] = [];
    const lowerQuery = profileSearchQuery.toLowerCase().trim();

    for (const standard of standards) {
      const categories = getCategoriesForStandard(standard);
      const catGroups: { category: string; presets: ProfilePreset[] }[] = [];

      for (const category of categories) {
        let presets = PROFILE_PRESETS.filter(
          p => p.standard === standard && p.category === category
        );
        if (lowerQuery) {
          presets = presets.filter(
            p => p.name.toLowerCase().includes(lowerQuery) ||
                 p.id.toLowerCase().includes(lowerQuery) ||
                 p.category.toLowerCase().includes(lowerQuery)
          );
        }
        if (presets.length > 0) {
          catGroups.push({ category, presets });
        }
      }
      if (catGroups.length > 0) {
        groups.push({ standard, categories: catGroups });
      }
    }
    return groups;
  }, [profileSearchQuery]);

  const selectedProfile = selectedProfileId
    ? PROFILE_PRESETS.find(p => p.id === selectedProfileId)
    : null;

  const toggleProfileCategory = (key: string) => {
    setProfileExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Format a parameter key to a readable label */
  const formatParamLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  };

  /** Format a parameter value with units */
  const formatParamValue = (_key: string, value: number | string | boolean): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') return value;
    // Most profile dimensions are in mm
    return `${value} mm`;
  };

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

  // ---- Wall type helpers ----
  const toggleWallCategory = (catId: string) => {
    setWallExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const selectedWallType = selectedWallTypeId ? wallTypes.find(t => t.id === selectedWallTypeId) : null;
  const selectedWallCategory = selectedWallType
    ? MATERIAL_CATEGORIES.find(c => c.id === selectedWallType.material)
    : null;

  // Helper: get the Dutch display label for a MaterialCategory.
  const getMaterialLabel = (catId: MaterialCategory): string => {
    return getMaterialCategoryInfo(catId).label;
  };

  // Helper: auto-generate type display name from material + thickness.
  const generateTypeName = (catId: MaterialCategory, thickness: number): string => {
    const label = getMaterialLabel(catId);
    return `${label} ${thickness}mm`;
  };

  const handleAddWallType = () => {
    const baseName = getMaterialLabel(newWallMaterial);
    const displayName = generateTypeName(newWallMaterial, newWallThickness);
    const id = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    addWallType({
      id,
      name: baseName,
      thickness: newWallThickness,
      material: newWallMaterial,
    });
    setNewWallThickness(200);
    setShowWallAddForm(false);
    setSelectedWallTypeId(id);
  };

  const handleDeleteWallType = () => {
    if (!selectedWallTypeId) return;
    deleteWallType(selectedWallTypeId);
    setSelectedWallTypeId(null);
  };

  // ---- Slab type helpers ----
  const toggleSlabCategory = (catId: string) => {
    setSlabExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const selectedSlabType = selectedSlabTypeId ? slabTypes.find(t => t.id === selectedSlabTypeId) : null;
  const selectedSlabCategory = selectedSlabType
    ? MATERIAL_CATEGORIES.find(c => c.id === selectedSlabType.material)
    : null;

  const handleAddSlabType = () => {
    const baseName = getMaterialLabel(newSlabMaterial);
    const displayName = generateTypeName(newSlabMaterial, newSlabThickness);
    const id = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
    addSlabType({
      id,
      name: baseName,
      thickness: newSlabThickness,
      material: newSlabMaterial,
    });
    setNewSlabThickness(200);
    setShowSlabAddForm(false);
    setSelectedSlabTypeId(id);
  };

  const handleDeleteSlabType = () => {
    if (!selectedSlabTypeId) return;
    deleteSlabType(selectedSlabTypeId);
    setSelectedSlabTypeId(null);
  };

  // ---- Column type helpers ----
  const toggleColumnCategory = (catId: string) => {
    setColumnExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const selectedColumnType = selectedColumnTypeId ? columnTypes.find(t => t.id === selectedColumnTypeId) : null;
  const selectedColumnCategory = selectedColumnType
    ? MATERIAL_CATEGORIES.find(c => c.id === selectedColumnType.material)
    : null;

  const handleAddColumnType = () => {
    if (!newColumnName.trim()) return;
    const id = newColumnName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    addColumnType({
      id,
      name: newColumnName.trim(),
      material: newColumnMaterial,
      profileType: newColumnShape === 'circular' ? 'circular' : 'rectangular',
      width: newColumnWidth,
      depth: newColumnShape === 'circular' ? newColumnWidth : newColumnDepth,
      shape: newColumnShape,
    });
    setNewColumnName('');
    setNewColumnWidth(300);
    setNewColumnDepth(300);
    setShowColumnAddForm(false);
    setSelectedColumnTypeId(id);
  };

  const handleDeleteColumnType = () => {
    if (!selectedColumnTypeId) return;
    deleteColumnType(selectedColumnTypeId);
    setSelectedColumnTypeId(null);
  };

  // ---- Beam type helpers ----
  const toggleBeamCategory = (catId: string) => {
    setBeamExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const selectedBeamType = selectedBeamTypeId ? beamTypes.find(t => t.id === selectedBeamTypeId) : null;
  const selectedBeamCategory = selectedBeamType
    ? MATERIAL_CATEGORIES.find(c => c.id === selectedBeamType.material)
    : null;

  const handleAddBeamType = () => {
    if (!newBeamName.trim()) return;
    const id = newBeamName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    addBeamType({
      id,
      name: newBeamName.trim(),
      material: newBeamMaterial,
      profileType: newBeamProfileType,
      width: newBeamWidth,
      height: newBeamHeight,
    });
    setNewBeamName('');
    setNewBeamWidth(200);
    setNewBeamHeight(200);
    setShowBeamAddForm(false);
    setSelectedBeamTypeId(id);
  };

  const handleDeleteBeamType = () => {
    if (!selectedBeamTypeId) return;
    deleteBeamType(selectedBeamTypeId);
    setSelectedBeamTypeId(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="bg-cad-surface border border-cad-border shadow-xl w-[560px] h-[600px] flex flex-col"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-cad-border cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div>
            <h2 className="text-sm font-semibold text-cad-text">IfcTypes</h2>
            <span className="text-[10px] text-cad-text-dim">IFC Type Definitions (ISO 16739)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-cad-border bg-cad-bg">
          <button
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'wall'
                ? 'text-cad-accent border-b-2 border-cad-accent bg-cad-surface'
                : 'text-cad-text-dim hover:text-cad-text hover:bg-cad-hover'
            }`}
            onClick={() => setActiveTab('wall')}
          >
            Wall Types
          </button>
          <button
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'slab'
                ? 'text-cad-accent border-b-2 border-cad-accent bg-cad-surface'
                : 'text-cad-text-dim hover:text-cad-text hover:bg-cad-hover'
            }`}
            onClick={() => setActiveTab('slab')}
          >
            Slab Types
          </button>
          <button
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'column'
                ? 'text-cad-accent border-b-2 border-cad-accent bg-cad-surface'
                : 'text-cad-text-dim hover:text-cad-text hover:bg-cad-hover'
            }`}
            onClick={() => setActiveTab('column')}
          >
            Column Types
          </button>
          <button
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'beam'
                ? 'text-cad-accent border-b-2 border-cad-accent bg-cad-surface'
                : 'text-cad-text-dim hover:text-cad-text hover:bg-cad-hover'
            }`}
            onClick={() => setActiveTab('beam')}
          >
            Beam Types
          </button>
          <button
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'profiles'
                ? 'text-cad-accent border-b-2 border-cad-accent bg-cad-surface'
                : 'text-cad-text-dim hover:text-cad-text hover:bg-cad-hover'
            }`}
            onClick={() => setActiveTab('profiles')}
          >
            Profiles
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ======== WALL TYPES TAB ======== */}
          {activeTab === 'wall' && (
            <>
              {/* Left: Wall type list */}
              <div className="w-[240px] border-r border-cad-border overflow-y-auto">
                <div className="p-2 border-b border-cad-border flex gap-1">
                  <button
                    onClick={() => setShowWallAddForm(!showWallAddForm)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded"
                  >
                    <Plus size={12} /> Add
                  </button>
                  <button
                    onClick={handleDeleteWallType}
                    disabled={!selectedWallTypeId}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-bg border border-cad-border text-cad-text hover:bg-cad-hover rounded disabled:opacity-30"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                {/* Add form */}
                {showWallAddForm && (
                  <div className="p-2 border-b border-cad-border space-y-2 bg-cad-bg/50">
                    <select
                      value={newWallMaterial}
                      onChange={(e) => setNewWallMaterial(e.target.value as MaterialCategory)}
                      className="w-full h-6 px-1 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      autoFocus
                    >
                      {MATERIAL_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <NumericInput
                      value={newWallThickness}
                      onCommit={(v) => setNewWallThickness(v)}
                      min={10}
                      placeholder="Thickness (mm)"
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    />
                    <input
                      type="text"
                      value={generateTypeName(newWallMaterial, newWallThickness)}
                      readOnly
                      disabled
                      className="w-full h-6 px-2 text-xs bg-cad-bg/50 border border-cad-border text-cad-text-dim rounded cursor-not-allowed"
                    />
                    <button
                      onClick={handleAddWallType}
                      className="w-full h-6 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded disabled:opacity-30"
                    >
                      Add Wall Type
                    </button>
                  </div>
                )}

                {/* Category tree */}
                {MATERIAL_CATEGORIES.map(cat => {
                  const types = wallTypes.filter(t => t.material === cat.id);
                  if (types.length === 0) return null;
                  const isExpanded = wallExpandedCategories.has(cat.id);
                  return (
                    <div key={cat.id}>
                      <button
                        className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-cad-text hover:bg-cad-hover"
                        onClick={() => toggleWallCategory(cat.id)}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {cat.label} ({types.length})
                      </button>
                      {isExpanded && types.map(t => (
                        <button
                          key={t.id}
                          className={`w-full text-left px-6 py-1 text-xs truncate ${
                            selectedWallTypeId === t.id
                              ? 'bg-cad-accent/20 text-cad-accent'
                              : 'text-cad-text-secondary hover:bg-cad-hover'
                          }`}
                          onClick={() => setSelectedWallTypeId(t.id)}
                        >
                          {t.name} {t.thickness}mm
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected wall type properties */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedWallType ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-cad-text">{selectedWallType.name} {selectedWallType.thickness}mm</h3>
                      <div className="text-[10px] text-cad-text-dim mt-0.5">
                        IFC Class: IfcWallType &middot; Category: {selectedWallCategory?.label || 'Overig'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Type Name (auto-generated)</label>
                      <input
                        type="text"
                        value={`${selectedWallType.name} ${selectedWallType.thickness}mm`}
                        readOnly
                        disabled
                        className="w-full h-7 px-2 text-xs bg-cad-bg/50 border border-cad-border text-cad-text-dim rounded cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Material</label>
                      <select
                        value={selectedWallType.material}
                        onChange={(e) => {
                          const matCategory = e.target.value as MaterialCategory;
                          const matName = getMaterialLabel(matCategory);
                          updateWallType(selectedWallType.id, {
                            material: matCategory,
                            name: matName,
                          });
                        }}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      >
                        {MATERIAL_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Thickness (mm)</label>
                      <NumericInput
                        value={selectedWallType.thickness}
                        onCommit={(v) => {
                          updateWallType(selectedWallType.id, { thickness: v });
                        }}
                        min={10}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      />
                    </div>

                    <p className="text-[10px] text-cad-text-dim mt-2">
                      Hatch patterns are defined per material category in Drawing Standards.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
                    Select a wall type to edit properties
                  </div>
                )}
              </div>
            </>
          )}

          {/* ======== SLAB TYPES TAB ======== */}
          {activeTab === 'slab' && (
            <>
              {/* Left: Slab type list */}
              <div className="w-[240px] border-r border-cad-border overflow-y-auto">
                <div className="p-2 border-b border-cad-border flex gap-1">
                  <button
                    onClick={() => setShowSlabAddForm(!showSlabAddForm)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded"
                  >
                    <Plus size={12} /> Add
                  </button>
                  <button
                    onClick={handleDeleteSlabType}
                    disabled={!selectedSlabTypeId}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-bg border border-cad-border text-cad-text hover:bg-cad-hover rounded disabled:opacity-30"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                {/* Add form */}
                {showSlabAddForm && (
                  <div className="p-2 border-b border-cad-border space-y-2 bg-cad-bg/50">
                    <select
                      value={newSlabMaterial}
                      onChange={(e) => setNewSlabMaterial(e.target.value as MaterialCategory)}
                      className="w-full h-6 px-1 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      autoFocus
                    >
                      {MATERIAL_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <NumericInput
                      value={newSlabThickness}
                      onCommit={(v) => setNewSlabThickness(v)}
                      min={10}
                      placeholder="Thickness (mm)"
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    />
                    <input
                      type="text"
                      value={generateTypeName(newSlabMaterial, newSlabThickness)}
                      readOnly
                      disabled
                      className="w-full h-6 px-2 text-xs bg-cad-bg/50 border border-cad-border text-cad-text-dim rounded cursor-not-allowed"
                    />
                    <button
                      onClick={handleAddSlabType}
                      className="w-full h-6 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded disabled:opacity-30"
                    >
                      Add Slab Type
                    </button>
                  </div>
                )}

                {/* Category tree */}
                {MATERIAL_CATEGORIES.map(cat => {
                  const types = slabTypes.filter(t => t.material === cat.id);
                  if (types.length === 0) return null;
                  const isExpanded = slabExpandedCategories.has(cat.id);
                  return (
                    <div key={cat.id}>
                      <button
                        className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-cad-text hover:bg-cad-hover"
                        onClick={() => toggleSlabCategory(cat.id)}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {cat.label} ({types.length})
                      </button>
                      {isExpanded && types.map(t => (
                        <button
                          key={t.id}
                          className={`w-full text-left px-6 py-1 text-xs truncate ${
                            selectedSlabTypeId === t.id
                              ? 'bg-cad-accent/20 text-cad-accent'
                              : 'text-cad-text-secondary hover:bg-cad-hover'
                          }`}
                          onClick={() => setSelectedSlabTypeId(t.id)}
                        >
                          {t.name} {t.thickness}mm
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected slab type properties */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedSlabType ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-cad-text">{selectedSlabType.name} {selectedSlabType.thickness}mm</h3>
                      <div className="text-[10px] text-cad-text-dim mt-0.5">
                        IFC Class: IfcSlabType &middot; Category: {selectedSlabCategory?.label || 'Overig'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Type Name (auto-generated)</label>
                      <input
                        type="text"
                        value={`${selectedSlabType.name} ${selectedSlabType.thickness}mm`}
                        readOnly
                        disabled
                        className="w-full h-7 px-2 text-xs bg-cad-bg/50 border border-cad-border text-cad-text-dim rounded cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Material</label>
                      <select
                        value={selectedSlabType.material}
                        onChange={(e) => {
                          const matCategory = e.target.value as MaterialCategory;
                          const matName = getMaterialLabel(matCategory);
                          updateSlabType(selectedSlabType.id, {
                            material: matCategory,
                            name: matName,
                          });
                        }}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      >
                        {MATERIAL_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Thickness (mm)</label>
                      <NumericInput
                        value={selectedSlabType.thickness}
                        onCommit={(v) => {
                          updateSlabType(selectedSlabType.id, { thickness: v });
                        }}
                        min={10}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      />
                    </div>

                    <p className="text-[10px] text-cad-text-dim mt-2">
                      Hatch patterns are defined per material category in Drawing Standards.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
                    Select a slab type to edit properties
                  </div>
                )}
              </div>
            </>
          )}

          {/* ======== COLUMN TYPES TAB ======== */}
          {activeTab === 'column' && (
            <>
              {/* Left: Column type list */}
              <div className="w-[240px] border-r border-cad-border overflow-y-auto">
                <div className="p-2 border-b border-cad-border flex gap-1">
                  <button
                    onClick={() => setShowColumnAddForm(!showColumnAddForm)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded"
                  >
                    <Plus size={12} /> Add
                  </button>
                  <button
                    onClick={handleDeleteColumnType}
                    disabled={!selectedColumnTypeId}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-bg border border-cad-border text-cad-text hover:bg-cad-hover rounded disabled:opacity-30"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                {/* Add form */}
                {showColumnAddForm && (
                  <div className="p-2 border-b border-cad-border space-y-2 bg-cad-bg/50">
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="Column type name..."
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumnType(); }}
                    />
                    <select
                      value={newColumnMaterial}
                      onChange={(e) => setNewColumnMaterial(e.target.value as MaterialCategory)}
                      className="w-full h-6 px-1 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    >
                      {MATERIAL_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={newColumnShape}
                      onChange={(e) => setNewColumnShape(e.target.value as ColumnShapeType)}
                      className="w-full h-6 px-1 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    >
                      <option value="rectangular">Rectangular</option>
                      <option value="circular">Circular</option>
                    </select>
                    <NumericInput
                      value={newColumnWidth}
                      onCommit={(v) => setNewColumnWidth(v)}
                      min={10}
                      placeholder={newColumnShape === 'circular' ? 'Diameter (mm)' : 'Width (mm)'}
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    />
                    {newColumnShape === 'rectangular' && (
                      <NumericInput
                        value={newColumnDepth}
                        onCommit={(v) => setNewColumnDepth(v)}
                        min={10}
                        placeholder="Depth (mm)"
                        className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      />
                    )}
                    <button
                      onClick={handleAddColumnType}
                      disabled={!newColumnName.trim()}
                      className="w-full h-6 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded disabled:opacity-30"
                    >
                      Add Column Type
                    </button>
                  </div>
                )}

                {/* Category tree */}
                {MATERIAL_CATEGORIES.map(cat => {
                  const types = columnTypes.filter(t => t.material === cat.id);
                  if (types.length === 0) return null;
                  const isExpanded = columnExpandedCategories.has(cat.id);
                  return (
                    <div key={cat.id}>
                      <button
                        className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-cad-text hover:bg-cad-hover"
                        onClick={() => toggleColumnCategory(cat.id)}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {cat.label} ({types.length})
                      </button>
                      {isExpanded && types.map(t => (
                        <button
                          key={t.id}
                          className={`w-full text-left px-6 py-1 text-xs truncate ${
                            selectedColumnTypeId === t.id
                              ? 'bg-cad-accent/20 text-cad-accent'
                              : 'text-cad-text-secondary hover:bg-cad-hover'
                          }`}
                          onClick={() => setSelectedColumnTypeId(t.id)}
                        >
                          {t.name} ({t.shape === 'circular' ? `\u00d8${t.width}` : `${t.width}x${t.depth}`}mm)
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected column type properties */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedColumnType ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-cad-text">{selectedColumnType.name}</h3>
                      <div className="text-[10px] text-cad-text-dim mt-0.5">
                        IFC Class: IfcColumnType &middot; Category: {selectedColumnCategory?.label || 'Overig'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Name</label>
                      <input
                        type="text"
                        value={selectedColumnType.name}
                        onChange={(e) => updateColumnType(selectedColumnType.id, { name: e.target.value })}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">Material Category</label>
                        <select
                          value={selectedColumnType.material}
                          onChange={(e) => updateColumnType(selectedColumnType.id, { material: e.target.value as MaterialCategory })}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        >
                          {MATERIAL_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">Shape</label>
                        <select
                          value={selectedColumnType.shape}
                          onChange={(e) => {
                            const newShape = e.target.value as ColumnShapeType;
                            updateColumnType(selectedColumnType.id, {
                              shape: newShape,
                              profileType: newShape === 'circular' ? 'circular' : 'rectangular',
                              depth: newShape === 'circular' ? selectedColumnType.width : selectedColumnType.depth,
                            });
                          }}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        >
                          <option value="rectangular">Rectangular</option>
                          <option value="circular">Circular</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">
                          {selectedColumnType.shape === 'circular' ? 'Diameter (mm)' : 'Width (mm)'}
                        </label>
                        <NumericInput
                          value={selectedColumnType.width}
                          onCommit={(val) => {
                            updateColumnType(selectedColumnType.id, {
                              width: val,
                              ...(selectedColumnType.shape === 'circular' ? { depth: val } : {}),
                            });
                          }}
                          min={10}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        />
                      </div>
                      {selectedColumnType.shape === 'rectangular' && (
                        <div>
                          <label className="block text-[10px] text-cad-text-dim mb-0.5">Depth (mm)</label>
                          <NumericInput
                            value={selectedColumnType.depth}
                            onCommit={(v) => updateColumnType(selectedColumnType.id, { depth: v })}
                            min={10}
                            className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Profile Type</label>
                      <input
                        type="text"
                        value={selectedColumnType.profileType}
                        onChange={(e) => updateColumnType(selectedColumnType.id, { profileType: e.target.value })}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      />
                    </div>

                    <p className="text-[10px] text-cad-text-dim mt-2">
                      Hatch patterns are defined per material category in Drawing Standards.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
                    Select a column type to edit properties
                  </div>
                )}
              </div>
            </>
          )}

          {/* ======== BEAM TYPES TAB ======== */}
          {activeTab === 'beam' && (
            <>
              {/* Left: Beam type list */}
              <div className="w-[240px] border-r border-cad-border overflow-y-auto">
                <div className="p-2 border-b border-cad-border flex gap-1">
                  <button
                    onClick={() => setShowBeamAddForm(!showBeamAddForm)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded"
                  >
                    <Plus size={12} /> Add
                  </button>
                  <button
                    onClick={handleDeleteBeamType}
                    disabled={!selectedBeamTypeId}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cad-bg border border-cad-border text-cad-text hover:bg-cad-hover rounded disabled:opacity-30"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>

                {/* Add form */}
                {showBeamAddForm && (
                  <div className="p-2 border-b border-cad-border space-y-2 bg-cad-bg/50">
                    <input
                      type="text"
                      value={newBeamName}
                      onChange={(e) => setNewBeamName(e.target.value)}
                      placeholder="Beam type name..."
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddBeamType(); }}
                    />
                    <select
                      value={newBeamMaterial}
                      onChange={(e) => setNewBeamMaterial(e.target.value as MaterialCategory)}
                      className="w-full h-6 px-1 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    >
                      {MATERIAL_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={newBeamProfileType}
                      onChange={(e) => setNewBeamProfileType(e.target.value as BeamTypeProfileType)}
                      className="w-full h-6 px-1 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    >
                      <option value="i-beam">I-Beam</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="circular">Circular</option>
                    </select>
                    <NumericInput
                      value={newBeamWidth}
                      onCommit={(v) => setNewBeamWidth(v)}
                      min={10}
                      placeholder="Width (mm)"
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    />
                    <NumericInput
                      value={newBeamHeight}
                      onCommit={(v) => setNewBeamHeight(v)}
                      min={10}
                      placeholder="Height (mm)"
                      className="w-full h-6 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    />
                    <button
                      onClick={handleAddBeamType}
                      disabled={!newBeamName.trim()}
                      className="w-full h-6 text-xs bg-cad-accent/20 border border-cad-accent/50 text-cad-accent hover:bg-cad-accent/30 rounded disabled:opacity-30"
                    >
                      Add Beam Type
                    </button>
                  </div>
                )}

                {/* Category tree */}
                {MATERIAL_CATEGORIES.map(cat => {
                  const types = beamTypes.filter(t => t.material === cat.id);
                  if (types.length === 0) return null;
                  const isExpanded = beamExpandedCategories.has(cat.id);
                  return (
                    <div key={cat.id}>
                      <button
                        className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-cad-text hover:bg-cad-hover"
                        onClick={() => toggleBeamCategory(cat.id)}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {cat.label} ({types.length})
                      </button>
                      {isExpanded && types.map(t => (
                        <button
                          key={t.id}
                          className={`w-full text-left px-6 py-1 text-xs truncate ${
                            selectedBeamTypeId === t.id
                              ? 'bg-cad-accent/20 text-cad-accent'
                              : 'text-cad-text-secondary hover:bg-cad-hover'
                          }`}
                          onClick={() => setSelectedBeamTypeId(t.id)}
                        >
                          {t.name} ({t.width}x{t.height}mm)
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Right: Selected beam type properties */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedBeamType ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-cad-text">{selectedBeamType.name}</h3>
                      <div className="text-[10px] text-cad-text-dim mt-0.5">
                        IFC Class: IfcBeamType &middot; Category: {selectedBeamCategory?.label || 'Overig'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-cad-text-dim mb-0.5">Name</label>
                      <input
                        type="text"
                        value={selectedBeamType.name}
                        onChange={(e) => updateBeamType(selectedBeamType.id, { name: e.target.value })}
                        className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">Material Category</label>
                        <select
                          value={selectedBeamType.material}
                          onChange={(e) => updateBeamType(selectedBeamType.id, { material: e.target.value as MaterialCategory })}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        >
                          {MATERIAL_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">Profile Type</label>
                        <select
                          value={selectedBeamType.profileType}
                          onChange={(e) => updateBeamType(selectedBeamType.id, { profileType: e.target.value as BeamTypeProfileType })}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        >
                          <option value="i-beam">I-Beam</option>
                          <option value="rectangular">Rectangular</option>
                          <option value="circular">Circular</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">Width (mm)</label>
                        <NumericInput
                          value={selectedBeamType.width}
                          onCommit={(v) => updateBeamType(selectedBeamType.id, { width: v })}
                          min={10}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-cad-text-dim mb-0.5">Height (mm)</label>
                        <NumericInput
                          value={selectedBeamType.height}
                          onCommit={(v) => updateBeamType(selectedBeamType.id, { height: v })}
                          min={10}
                          className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                        />
                      </div>
                    </div>

                    {/* I-beam specific fields */}
                    {selectedBeamType.profileType === 'i-beam' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-cad-text-dim mb-0.5">Flange Width (mm)</label>
                            <NumericInput
                              value={selectedBeamType.flangeWidth}
                              onCommit={(v) => updateBeamType(selectedBeamType.id, { flangeWidth: v })}
                              min={1}
                              className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-cad-text-dim mb-0.5">Flange Thickness (mm)</label>
                            <NumericInput
                              value={selectedBeamType.flangeThickness}
                              onCommit={(v) => updateBeamType(selectedBeamType.id, { flangeThickness: v })}
                              min={0.1}
                              className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-cad-text-dim mb-0.5">Web Thickness (mm)</label>
                            <NumericInput
                              value={selectedBeamType.webThickness}
                              onCommit={(v) => updateBeamType(selectedBeamType.id, { webThickness: v })}
                              min={0.1}
                              className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-cad-text-dim mb-0.5">Preset ID</label>
                            <input
                              type="text"
                              value={selectedBeamType.profilePresetId ?? ''}
                              onChange={(e) => updateBeamType(selectedBeamType.id, { profilePresetId: e.target.value || undefined })}
                              className="w-full h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                              placeholder="e.g. IPE200"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <p className="text-[10px] text-cad-text-dim mt-2">
                      Hatch patterns are defined per material category in Drawing Standards.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
                    Select a beam type to edit properties
                  </div>
                )}
              </div>
            </>
          )}

          {/* ======== PROFILES TAB ======== */}
          {activeTab === 'profiles' && (
            <>
              {/* Left: Profile list grouped by standard/category */}
              <div className="w-[240px] border-r border-cad-border overflow-y-auto">
                {/* Search bar */}
                <div className="p-2 border-b border-cad-border">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cad-text-dim" />
                    <input
                      type="text"
                      value={profileSearchQuery}
                      onChange={(e) => setProfileSearchQuery(e.target.value)}
                      placeholder="Search profiles..."
                      className="w-full h-6 pl-6 pr-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded"
                    />
                  </div>
                </div>

                {/* Grouped profile tree */}
                {profileGroups.map(group => (
                  <div key={group.standard}>
                    {/* Standard header */}
                    <button
                      className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-cad-text bg-cad-bg/50 hover:bg-cad-hover border-b border-cad-border"
                      onClick={() => toggleProfileCategory(`std:${group.standard}`)}
                    >
                      {profileExpandedCategories.has(`std:${group.standard}`)
                        ? <ChevronDown size={12} />
                        : <ChevronRight size={12} />}
                      {group.standard} ({group.categories.reduce((sum, c) => sum + c.presets.length, 0)})
                    </button>

                    {profileExpandedCategories.has(`std:${group.standard}`) && group.categories.map(cat => (
                      <div key={`${group.standard}:${cat.category}`}>
                        <button
                          className="w-full flex items-center gap-1 px-4 py-1 text-xs font-medium text-cad-text hover:bg-cad-hover"
                          onClick={() => toggleProfileCategory(`cat:${group.standard}:${cat.category}`)}
                        >
                          {profileExpandedCategories.has(`cat:${group.standard}:${cat.category}`)
                            ? <ChevronDown size={10} />
                            : <ChevronRight size={10} />}
                          {cat.category} ({cat.presets.length})
                        </button>

                        {profileExpandedCategories.has(`cat:${group.standard}:${cat.category}`) && cat.presets.map(p => (
                          <button
                            key={p.id}
                            className={`w-full text-left px-8 py-0.5 text-xs truncate ${
                              selectedProfileId === p.id
                                ? 'bg-cad-accent/20 text-cad-accent'
                                : 'text-cad-text-secondary hover:bg-cad-hover'
                            }`}
                            onClick={() => setSelectedProfileId(p.id)}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

                {profileGroups.length === 0 && (
                  <div className="p-4 text-xs text-cad-text-dim text-center">
                    No profiles match the search query.
                  </div>
                )}
              </div>

              {/* Right: Selected profile details */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedProfile ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-cad-text">{selectedProfile.name}</h3>
                      <div className="text-[10px] text-cad-text-dim mt-0.5">
                        Standard: {selectedProfile.standard} &middot; Category: {selectedProfile.category}
                        &middot; Profile Type: {selectedProfile.profileType}
                        {selectedProfile.material && <> &middot; Material: {selectedProfile.material}</>}
                      </div>
                    </div>

                    {/* Dimensions table */}
                    <div>
                      <h4 className="text-xs font-medium text-cad-text mb-1">Dimensions</h4>
                      <table className="w-full text-xs">
                        <tbody>
                          {Object.entries(selectedProfile.parameters).map(([key, val]) => (
                            <tr key={key} className="border-b border-cad-border/50">
                              <td className="py-1 pr-2 text-cad-text-dim">{formatParamLabel(key)}</td>
                              <td className="py-1 text-cad-text font-mono">{formatParamValue(key, val)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Section properties (if available) */}
                    {selectedProfile.properties && Object.keys(selectedProfile.properties).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-cad-text mb-1">Section Properties</h4>
                        <table className="w-full text-xs">
                          <tbody>
                            {selectedProfile.properties.area !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">Area</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.area} mm&sup2;</td>
                              </tr>
                            )}
                            {selectedProfile.properties.weight !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">Weight</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.weight} kg/m</td>
                              </tr>
                            )}
                            {selectedProfile.properties.Ix !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">Ix</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.Ix} mm&sup4;</td>
                              </tr>
                            )}
                            {selectedProfile.properties.Iy !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">Iy</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.Iy} mm&sup4;</td>
                              </tr>
                            )}
                            {selectedProfile.properties.Sx !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">Sx</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.Sx} mm&sup3;</td>
                              </tr>
                            )}
                            {selectedProfile.properties.Sy !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">Sy</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.Sy} mm&sup3;</td>
                              </tr>
                            )}
                            {selectedProfile.properties.rx !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">rx</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.rx} mm</td>
                              </tr>
                            )}
                            {selectedProfile.properties.ry !== undefined && (
                              <tr className="border-b border-cad-border/50">
                                <td className="py-1 pr-2 text-cad-text-dim">ry</td>
                                <td className="py-1 text-cad-text font-mono">{selectedProfile.properties.ry} mm</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <p className="text-[10px] text-cad-text-dim mt-2">
                      Standard profile from {selectedProfile.standard} library. Read-only.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-cad-text-dim">
                    Select a profile to view its dimensions and properties
                  </div>
                )}
              </div>
            </>
          )}

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
