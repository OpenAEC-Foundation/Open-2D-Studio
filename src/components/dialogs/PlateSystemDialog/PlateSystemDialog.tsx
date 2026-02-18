/**
 * PlateSystemDialog - Dialog for configuring and placing plate system assemblies.
 *
 * Supports timber floor (houten balklaag), HSB wall, ceiling, and custom system types.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { PROFILE_PRESETS, getPresetById } from '../../../services/parametric/profileLibrary';
import { SectionDialog } from '../SectionDialog/SectionDialog';
import type { ProfilePreset, ProfileType, ParameterValues } from '../../../types/parametric';

interface PlateSystemLayer {
  name: string;
  thickness: number;
  material: string;
  position: 'top' | 'bottom';
}

interface PlateSystemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: (settings: {
    systemType: string;
    mainWidth: number;
    mainHeight: number;
    mainSpacing: number;
    mainDirection: number;
    mainMaterial: string;
    mainProfileId?: string;
    edgeWidth?: number;
    edgeHeight?: number;
    edgeMaterial?: string;
    edgeProfileId?: string;
    layers?: PlateSystemLayer[];
    name?: string;
  }) => void;
  /** Default name for the plate system (auto-incremented) */
  defaultName?: string;
}

const SYSTEM_PRESETS: Record<string, {
  label: string;
  mainWidth: number;
  mainHeight: number;
  mainSpacing: number;
  mainMaterial: string;
  edgeWidth?: number;
  edgeHeight?: number;
  layers?: PlateSystemLayer[];
}> = {
  'timber-floor': {
    label: 'Timber Floor (Houten Balklaag)',
    mainWidth: 75,
    mainHeight: 200,
    mainSpacing: 600,
    mainMaterial: 'timber',
    edgeWidth: 75,
    edgeHeight: 200,
    layers: [
      { name: 'Multiplex 18mm', thickness: 18, material: 'timber', position: 'top' },
    ],
  },
  'hsb-wall': {
    label: 'HSB Wall (Houtskeletbouw)',
    mainWidth: 45,
    mainHeight: 145,
    mainSpacing: 600,
    mainMaterial: 'timber',
    edgeWidth: 45,
    edgeHeight: 145,
    layers: [
      { name: 'Gips 12.5mm', thickness: 12.5, material: 'gypsum', position: 'top' },
      { name: 'OSB 12mm', thickness: 12, material: 'timber', position: 'bottom' },
    ],
  },
  'ceiling': {
    label: 'Suspended Ceiling',
    mainWidth: 50,
    mainHeight: 50,
    mainSpacing: 400,
    mainMaterial: 'steel',
    layers: [
      { name: 'Gips 12.5mm', thickness: 12.5, material: 'gypsum', position: 'bottom' },
    ],
  },
  'custom': {
    label: 'Custom',
    mainWidth: 75,
    mainHeight: 200,
    mainSpacing: 600,
    mainMaterial: 'timber',
  },
};

const inputClass = 'flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text rounded';
const labelClass = 'text-xs text-cad-text-secondary w-32';

export function PlateSystemDialog({ isOpen, onClose, onDraw, defaultName }: PlateSystemDialogProps) {
  const [systemType, setSystemType] = useState('timber-floor');
  const [mainWidth, setMainWidth] = useState(75);
  const [mainHeight, setMainHeight] = useState(200);
  const [mainSpacing, setMainSpacing] = useState(600);
  const [mainDirection, setMainDirection] = useState(0);
  const [mainMaterial, setMainMaterial] = useState('timber');
  const [edgeEnabled, setEdgeEnabled] = useState(true);
  const [edgeWidth, setEdgeWidth] = useState(75);
  const [edgeHeight, setEdgeHeight] = useState(200);
  const [edgeMaterial, setEdgeMaterial] = useState('timber');
  const [layers, setLayers] = useState<PlateSystemLayer[]>([
    { name: 'Multiplex 18mm', thickness: 18, material: 'timber', position: 'top' },
  ]);
  const [systemName, setSystemName] = useState('');
  const [mainProfileId, setMainProfileId] = useState<string>('');
  const [edgeProfileId, setEdgeProfileId] = useState<string>('');

  // Profile picker (SectionDialog) state: which target is currently being browsed
  const [profilePickerTarget, setProfilePickerTarget] = useState<'main' | 'edge' | null>(null);

  // Set the default name when the dialog opens
  useEffect(() => {
    if (isOpen && defaultName) {
      setSystemName(defaultName);
    }
  }, [isOpen, defaultName]);

  // Helper: build grouped profile options for a given material filter
  const buildProfileOptions = useCallback((material: string) => {
    const materialToProfileMaterials: Record<string, string[]> = {
      'timber': ['timber'],
      'steel': ['steel', 'cold-formed-steel'],
      'concrete': ['concrete'],
      'aluminum': ['aluminum'],
      'generic': ['steel', 'cold-formed-steel', 'concrete', 'timber', 'aluminum', 'other'],
    };
    const allowedMaterials = materialToProfileMaterials[material] ?? ['steel', 'timber'];
    const filtered = PROFILE_PRESETS.filter(p => p.material && allowedMaterials.includes(p.material));

    const grouped: Record<string, Record<string, ProfilePreset[]>> = {};
    for (const preset of filtered) {
      if (!grouped[preset.standard]) grouped[preset.standard] = {};
      if (!grouped[preset.standard][preset.category]) grouped[preset.standard][preset.category] = [];
      grouped[preset.standard][preset.category].push(preset);
    }
    return grouped;
  }, []);

  // Build grouped profile options based on the selected material.
  const profileOptions = useMemo(() => buildProfileOptions(mainMaterial), [buildProfileOptions, mainMaterial]);

  // Build grouped profile options for edge profile based on edge material.
  const edgeProfileOptions = useMemo(() => buildProfileOptions(edgeMaterial), [buildProfileOptions, edgeMaterial]);

  // Helper: extract width and height from a profile preset
  const extractProfileDimensions = useCallback((preset: ProfilePreset) => {
    const params = preset.parameters;
    const height = typeof params.height === 'number' ? params.height : undefined;
    let width: number | undefined;
    if (typeof params.width === 'number') {
      width = params.width;
    } else if (typeof params.flangeWidth === 'number') {
      width = params.flangeWidth as number;
    }
    return { width, height };
  }, []);

  // When a main profile is selected, auto-fill width and height from the profile dimensions
  const handleProfileSelect = useCallback((profileId: string) => {
    setMainProfileId(profileId);
    if (!profileId) return;

    const preset = getPresetById(profileId);
    if (!preset) return;

    const { width, height } = extractProfileDimensions(preset);
    if (height !== undefined) setMainHeight(height);
    if (width !== undefined) setMainWidth(width);
  }, [extractProfileDimensions]);

  // When an edge profile is selected, auto-fill edge width and height
  const handleEdgeProfileSelect = useCallback((profileId: string) => {
    setEdgeProfileId(profileId);
    if (!profileId) return;

    const preset = getPresetById(profileId);
    if (!preset) return;

    const { width, height } = extractProfileDimensions(preset);
    if (height !== undefined) setEdgeHeight(height);
    if (width !== undefined) setEdgeWidth(width);
  }, [extractProfileDimensions]);

  // Handle profile selection from the SectionDialog picker
  const handleProfilePickerInsert = useCallback((_profileType: ProfileType, _parameters: ParameterValues, presetId?: string) => {
    if (!presetId) {
      setProfilePickerTarget(null);
      return;
    }
    if (profilePickerTarget === 'main') {
      handleProfileSelect(presetId);
    } else if (profilePickerTarget === 'edge') {
      handleEdgeProfileSelect(presetId);
    }
    setProfilePickerTarget(null);
  }, [profilePickerTarget, handleProfileSelect, handleEdgeProfileSelect]);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, label, textarea')) return;
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

  // Apply preset when system type changes
  const applyPreset = useCallback((type: string) => {
    const preset = SYSTEM_PRESETS[type];
    if (!preset) return;
    setSystemType(type);
    setMainWidth(preset.mainWidth);
    setMainHeight(preset.mainHeight);
    setMainSpacing(preset.mainSpacing);
    setMainMaterial(preset.mainMaterial);
    setMainProfileId('');
    setEdgeProfileId('');
    if (preset.edgeWidth) {
      setEdgeEnabled(true);
      setEdgeWidth(preset.edgeWidth);
      setEdgeHeight(preset.edgeHeight ?? preset.mainHeight);
      setEdgeMaterial(preset.mainMaterial);
    } else {
      setEdgeEnabled(false);
    }
    setLayers(preset.layers ? [...preset.layers] : []);
  }, []);

  const handleDraw = () => {
    onDraw({
      systemType,
      mainWidth,
      mainHeight,
      mainSpacing,
      mainDirection: mainDirection * (Math.PI / 180),
      mainMaterial,
      mainProfileId: mainProfileId || undefined,
      edgeWidth: edgeEnabled ? edgeWidth : undefined,
      edgeHeight: edgeEnabled ? edgeHeight : undefined,
      edgeMaterial: edgeEnabled ? edgeMaterial : undefined,
      edgeProfileId: edgeEnabled && edgeProfileId ? edgeProfileId : undefined,
      layers: layers.length > 0 ? layers : undefined,
      name: systemName || undefined,
    });
  };

  const addLayer = () => {
    setLayers([...layers, { name: 'New Layer', thickness: 12, material: 'generic', position: 'top' }]);
  };

  const removeLayer = (index: number) => {
    setLayers(layers.filter((_, i) => i !== index));
  };

  const updateLayer = (index: number, updates: Partial<PlateSystemLayer>) => {
    setLayers(layers.map((l, i) => i === index ? { ...l, ...updates } : l));
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
        className="bg-cad-surface border border-cad-border shadow-xl w-[480px] max-h-[85vh] flex flex-col"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-cad-border cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-sm font-semibold text-cad-text">Plate System</h2>
          <button onClick={onClose} className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary">
            <X size={14} />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* System Type */}
          <div>
            <div className="text-xs font-semibold text-cad-accent mb-2 uppercase tracking-wide">System Type</div>
            <div className="flex items-center gap-3">
              <label className={labelClass}>Type</label>
              <select
                value={systemType}
                onChange={(e) => applyPreset(e.target.value)}
                className={inputClass}
              >
                {Object.entries(SYSTEM_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className={labelClass}>Name (optional)</label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className={inputClass}
                placeholder="e.g., Floor Level 1"
              />
            </div>
          </div>

          {/* Main Profile */}
          <div>
            <div className="text-xs font-semibold text-cad-accent mb-2 uppercase tracking-wide">
              Main Profile (Joists/Studs)
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <label className={labelClass}>Material</label>
                <select
                  value={mainMaterial}
                  onChange={(e) => {
                    setMainMaterial(e.target.value);
                    setMainProfileId('');
                  }}
                  className={inputClass}
                >
                  <option value="timber">Timber</option>
                  <option value="steel">Steel</option>
                  <option value="concrete">Concrete</option>
                  <option value="aluminum">Aluminum</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className={labelClass}>Profile</label>
                <select
                  value={mainProfileId}
                  onChange={(e) => handleProfileSelect(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select profile --</option>
                  {Object.entries(profileOptions).map(([standard, categories]) => (
                    <optgroup key={standard} label={standard}>
                      {Object.entries(categories).map(([category, presets]) =>
                        presets.map(preset => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name} ({category})
                          </option>
                        ))
                      )}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={() => setProfilePickerTarget('main')}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-cad-accent/10 hover:bg-cad-accent/20 border border-cad-accent/30 rounded text-cad-accent"
                  title="Browse profiles"
                >
                  <Plus size={14} />
                </button>
              </div>
              {mainProfileId && (
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Dimensions</label>
                  <span className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text-secondary rounded flex items-center">
                    {mainWidth} x {mainHeight} mm
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className={labelClass}>Spacing h.o.h. (mm)</label>
                <input
                  type="number"
                  value={mainSpacing}
                  onChange={(e) => setMainSpacing(Math.max(50, Number(e.target.value)))}
                  className={inputClass}
                  min={50}
                  step={50}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className={labelClass}>Direction (deg)</label>
                <input
                  type="number"
                  value={mainDirection}
                  onChange={(e) => setMainDirection(Number(e.target.value))}
                  className={inputClass}
                  step={15}
                />
              </div>
            </div>
          </div>

          {/* Edge Profile */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-semibold text-cad-accent uppercase tracking-wide">
                Edge Profile (Rim Joists)
              </div>
              <label className="flex items-center gap-1 text-xs text-cad-text-secondary ml-auto cursor-pointer">
                <input
                  type="checkbox"
                  checked={edgeEnabled}
                  onChange={(e) => setEdgeEnabled(e.target.checked)}
                  className="accent-cad-accent"
                />
                Enabled
              </label>
            </div>
            {edgeEnabled && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Material</label>
                  <select
                    value={edgeMaterial}
                    onChange={(e) => {
                      setEdgeMaterial(e.target.value);
                      setEdgeProfileId('');
                    }}
                    className={inputClass}
                  >
                    <option value="timber">Timber</option>
                    <option value="steel">Steel</option>
                    <option value="concrete">Concrete</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Profile</label>
                  <select
                    value={edgeProfileId}
                    onChange={(e) => handleEdgeProfileSelect(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Select profile --</option>
                    {Object.entries(edgeProfileOptions).map(([standard, categories]) => (
                      <optgroup key={standard} label={standard}>
                        {Object.entries(categories).map(([category, presets]) =>
                          presets.map(preset => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} ({category})
                            </option>
                          ))
                        )}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={() => setProfilePickerTarget('edge')}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-cad-accent/10 hover:bg-cad-accent/20 border border-cad-accent/30 rounded text-cad-accent"
                    title="Browse profiles"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {edgeProfileId && (
                  <div className="flex items-center gap-3">
                    <label className={labelClass}>Dimensions</label>
                    <span className="flex-1 h-7 px-2 text-xs bg-cad-bg border border-cad-border text-cad-text-secondary rounded flex items-center">
                      {edgeWidth} x {edgeHeight} mm
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Layers */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-semibold text-cad-accent uppercase tracking-wide">
                Layers (Sub-Systems)
              </div>
              <button
                onClick={addLayer}
                className="ml-auto p-1 hover:bg-cad-hover rounded text-cad-accent"
                title="Add layer"
              >
                <Plus size={14} />
              </button>
            </div>
            {layers.length === 0 ? (
              <div className="text-xs text-cad-text-dim p-2">No layers defined.</div>
            ) : (
              <div className="space-y-2">
                {layers.map((layer, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-cad-bg rounded border border-cad-border">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={layer.name}
                          onChange={(e) => updateLayer(index, { name: e.target.value })}
                          className="flex-1 h-6 px-1 text-xs bg-cad-surface border border-cad-border text-cad-text rounded"
                          placeholder="Layer name"
                        />
                        <input
                          type="number"
                          value={layer.thickness}
                          onChange={(e) => updateLayer(index, { thickness: Math.max(0.1, Number(e.target.value)) })}
                          className="w-16 h-6 px-1 text-xs bg-cad-surface border border-cad-border text-cad-text rounded"
                          min={0.1}
                          step={0.5}
                          title="Thickness (mm)"
                        />
                        <span className="text-[10px] text-cad-text-dim">mm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={layer.material}
                          onChange={(e) => updateLayer(index, { material: e.target.value })}
                          className="flex-1 h-6 px-1 text-xs bg-cad-surface border border-cad-border text-cad-text rounded"
                        >
                          <option value="timber">Timber</option>
                          <option value="gypsum">Gypsum</option>
                          <option value="steel">Steel</option>
                          <option value="insulation">Insulation</option>
                          <option value="generic">Generic</option>
                        </select>
                        <select
                          value={layer.position}
                          onChange={(e) => updateLayer(index, { position: e.target.value as 'top' | 'bottom' })}
                          className="w-20 h-6 px-1 text-xs bg-cad-surface border border-cad-border text-cad-text rounded"
                        >
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => removeLayer(index)}
                      className="p-1 hover:bg-cad-hover rounded text-cad-text-secondary"
                      title="Remove layer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-cad-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs border border-cad-border text-cad-text rounded hover:bg-cad-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleDraw}
            className="px-4 py-1.5 text-xs bg-cad-accent text-white rounded hover:bg-cad-accent/90"
          >
            Draw
          </button>
        </div>
      </div>

      {/* Profile picker dialog (SectionDialog) for browsing profiles */}
      <SectionDialog
        isOpen={profilePickerTarget !== null}
        onClose={() => setProfilePickerTarget(null)}
        onInsert={handleProfilePickerInsert}
      />
    </div>
  );
}
