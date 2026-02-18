/**
 * BeamDialog - Dialog for drawing structural beams in plan view
 *
 * Allows users to:
 * - Select profile type (I-beam, channel, angle, etc.)
 * - Choose from standard library (AISC, EN) or enter custom dimensions
 * - Set beam material and justification
 * - Preview the beam cross-section
 * - Enter drawing mode to place beam start and end points
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { CAD_DEFAULT_FONT } from '../../../constants/cadDefaults';
import {
  PROFILE_TEMPLATES,
  getDefaultParameters,
  getAllProfileTemplates,
} from '../../../services/parametric/profileTemplates';
import {
  getAvailableStandards,
  getCategoriesForStandard,
  searchPresets,
  getPresetById,
  getPresetsForMaterial,
} from '../../../services/parametric/profileLibrary';
import { generateProfileGeometry } from '../../../services/parametric/geometryGenerators';
import type {
  ProfileType,
  ParameterValues,
  ParameterDefinition,
  ProfileMaterial,
} from '../../../types/parametric';
import type { BeamMaterial, BeamJustification } from '../../../types/geometry';

type PlacementMode = 'beam' | 'column' | 'sideview';

interface BeamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: (
    profileType: ProfileType,
    parameters: ParameterValues,
    flangeWidth: number,
    options: {
      presetId?: string;
      presetName?: string;
      material: BeamMaterial;
      justification: BeamJustification;
      showCenterline: boolean;
      showLabel: boolean;
      viewMode: 'plan' | 'section' | 'elevation' | 'side';
    }
  ) => void;
  onInsertSection?: (
    profileType: ProfileType,
    parameters: ParameterValues,
    presetId?: string,
    rotation?: number
  ) => void;
  initialMode?: PlacementMode;
  initialViewMode?: 'plan' | 'section' | 'elevation' | 'side';
}

export function BeamDialog({ isOpen, onClose, onDraw, onInsertSection, initialMode = 'beam', initialViewMode }: BeamDialogProps) {
  // Placement mode: beam (line) or column (point)
  const [mode, setMode] = useState<PlacementMode>(initialMode);

  // Profile selection state
  const [selectedProfileType, setSelectedProfileType] = useState<ProfileType>('i-beam');
  const [selectedStandard, setSelectedStandard] = useState<string>('AISC');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  // Parameter values (custom or from preset)
  const [parameters, setParameters] = useState<ParameterValues>({});

  // Beam options
  const [material, setMaterial] = useState<BeamMaterial>('steel');
  const [justification, setJustification] = useState<BeamJustification>('center');
  const [showCenterline, setShowCenterline] = useState(true);
  const [showLabel, setShowLabel] = useState(false);
  const [viewMode, setViewMode] = useState<'plan' | 'section' | 'elevation' | 'side'>(initialViewMode || 'plan');

  // Sync view mode when dialog opens with a preset
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
      if (initialViewMode === 'side') setMode('sideview');
    }
  }, [initialViewMode]);

  // Material tab state for preset filtering
  const [selectedMaterialTab, setSelectedMaterialTab] = useState<ProfileMaterial>('steel');

  // Concrete-specific state
  const [concreteSubTab, setConcreteSubTab] = useState<'dimensions' | 'reinforcement'>('dimensions');
  const [concreteShape, setConcreteShape] = useState<'rectangular' | 'circular'>('rectangular');
  const [concreteWidth, setConcreteWidth] = useState(300);
  const [concreteHeight, setConcreteHeight] = useState(500);
  const [concreteDiameter, setConcreteDiameter] = useState(400);
  const [concreteClass, setConcreteClass] = useState('C30/37');

  // Concrete reinforcement options
  const [rebarMainDiameter, setRebarMainDiameter] = useState(16);
  const [rebarMainCount, setRebarMainCount] = useState(4);
  const [rebarStirrupDiameter, setRebarStirrupDiameter] = useState(8);
  const [rebarStirrupSpacing, setRebarStirrupSpacing] = useState(200);
  const [rebarCover, setRebarCover] = useState(30);

  // Column options
  const [rotation, setRotation] = useState(0);

  // Drag state for movable modal
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Canvas ref for preview
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get current template
  const template = PROFILE_TEMPLATES[selectedProfileType];

  // Calculate flange width based on profile type and parameters
  const flangeWidth = useMemo(() => {
    switch (selectedProfileType) {
      case 'i-beam':
      case 'tee':
        return (parameters.flangeWidth as number) || 100;
      case 'channel':
        return (parameters.flangeWidth as number) || 80;
      case 'angle':
        return Math.max((parameters.legWidth1 as number) || 75, (parameters.legWidth2 as number) || 75);
      case 'hss-rect':
        return (parameters.width as number) || 100;
      case 'hss-round':
        return (parameters.outerDiameter as number) || 100;
      case 'plate':
        return (parameters.width as number) || 100;
      case 'round-bar':
        return (parameters.diameter as number) || 50;
      default:
        return 100;
    }
  }, [selectedProfileType, parameters]);

  // Derived concrete profile type and parameters
  const concreteProfileType: ProfileType = concreteShape === 'circular' ? 'concrete-round' : 'concrete-rect';
  const concreteParameters = useMemo((): ParameterValues => {
    if (concreteShape === 'circular') {
      return { diameter: concreteDiameter } as ParameterValues;
    }
    return { width: concreteWidth, height: concreteHeight } as ParameterValues;
  }, [concreteShape, concreteWidth, concreteHeight, concreteDiameter]);

  // Effective profile type and parameters (switches based on material tab)
  const effectiveProfileType = selectedMaterialTab === 'concrete' ? concreteProfileType : selectedProfileType;
  const effectiveParameters = selectedMaterialTab === 'concrete' ? concreteParameters : parameters;

  // Initialize parameters when profile type changes
  useEffect(() => {
    if (isOpen) {
      setParameters(getDefaultParameters(selectedProfileType));
      setSelectedPresetId('');
      setUseCustom(false);
    }
  }, [selectedProfileType, isOpen]);

  // Update parameters when preset is selected
  useEffect(() => {
    if (selectedPresetId) {
      const preset = getPresetById(selectedPresetId);
      if (preset) {
        setParameters(preset.parameters);
        setUseCustom(false);
      }
    }
  }, [selectedPresetId]);

  // Get presets for the selected material tab
  const materialPresets = useMemo(() => {
    return getPresetsForMaterial(selectedMaterialTab);
  }, [selectedMaterialTab]);

  // Get available presets for current profile type within material
  const allPresets = useMemo(() => {
    return materialPresets.filter(p => p.profileType === selectedProfileType);
  }, [materialPresets, selectedProfileType]);

  // Get profile types that exist for this material
  const materialProfileTypes = useMemo(() => {
    const types = new Set(materialPresets.map(p => p.profileType));
    return getAllProfileTemplates().filter(t => types.has(t.id));
  }, [materialPresets]);

  // Filter presets by standard and category (or global search)
  const filteredPresets = useMemo(() => {
    if (searchQuery) {
      // Global search across ALL profile types, standards, and categories
      return searchPresets(searchQuery);
    }

    let presets = allPresets;
    if (selectedStandard) {
      presets = presets.filter(p => p.standard === selectedStandard);
    }
    if (selectedCategory) {
      presets = presets.filter(p => p.category === selectedCategory);
    }
    return presets;
  }, [allPresets, selectedStandard, selectedCategory, searchQuery]);

  // Group search results by profile type for display
  const groupedSearchResults = useMemo(() => {
    if (!searchQuery) return null;
    const groups: Record<string, typeof filteredPresets> = {};
    for (const preset of filteredPresets) {
      const key = preset.profileType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(preset);
    }
    return groups;
  }, [searchQuery, filteredPresets]);

  // Get available standards for current material tab + profile type
  const materialStandards = useMemo(() => {
    const standards = new Set(allPresets.map(p => p.standard));
    return Array.from(standards);
  }, [allPresets]);

  // Get available categories for current standard
  const categories = useMemo(() => {
    return getCategoriesForStandard(selectedStandard).filter(cat =>
      allPresets.some(p => p.standard === selectedStandard && p.category === cat)
    );
  }, [selectedStandard, allPresets]);

  // Draw preview (cross-section)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate geometry for preview
    try {
      const geometry = generateProfileGeometry(
        effectiveProfileType,
        effectiveParameters,
        { x: 0, y: 0 },
        mode === 'column' ? rotation * (Math.PI / 180) : 0,
        1
      );

      if (geometry.outlines.length === 0) return;

      // Calculate scale to fit in canvas
      const bounds = geometry.bounds;
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const padding = 20;
      const scaleX = (canvas.width - padding * 2) / width;
      const scaleY = (canvas.height - padding * 2) / height;
      const scale = Math.min(scaleX, scaleY, 2);

      // Center in canvas
      const offsetX = canvas.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
      const offsetY = canvas.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;

      // Draw outlines
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';

      for (let i = 0; i < geometry.outlines.length; i++) {
        const outline = geometry.outlines[i];
        const closed = geometry.closed[i];

        if (outline.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(
          outline[0].x * scale + offsetX,
          outline[0].y * scale + offsetY
        );

        for (let j = 1; j < outline.length; j++) {
          ctx.lineTo(
            outline[j].x * scale + offsetX,
            outline[j].y * scale + offsetY
          );
        }

        if (closed) {
          ctx.closePath();
          if (i === 0) {
            ctx.fill();
          }
        }
        ctx.stroke();
      }

      // Draw center crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

    } catch {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = `12px ${CAD_DEFAULT_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Preview error', canvas.width / 2, canvas.height / 2);
    }
  }, [isOpen, effectiveProfileType, effectiveParameters, mode, rotation]);

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

  // Parameter change handler
  const handleParameterChange = (paramId: string, value: number | string | boolean) => {
    setParameters(prev => ({ ...prev, [paramId]: value }));
    setSelectedPresetId('');
    setUseCustom(true);
  };

  // Draw/Place handler
  const handleDraw = () => {
    const drawProfileType = effectiveProfileType;
    const drawParameters = effectiveParameters;
    const drawFlangeWidth = selectedMaterialTab === 'concrete'
      ? (concreteShape === 'circular' ? concreteDiameter : concreteWidth)
      : flangeWidth;

    if (mode === 'column' && onInsertSection) {
      onInsertSection(
        drawProfileType,
        drawParameters,
        selectedMaterialTab === 'concrete' ? undefined : (useCustom ? undefined : selectedPresetId),
        rotation
      );
    } else {
      const preset = selectedPresetId ? getPresetById(selectedPresetId) : null;
      const effectiveViewMode = mode === 'sideview' ? 'side' as const : viewMode;
      onDraw(drawProfileType, drawParameters, drawFlangeWidth, {
        presetId: selectedMaterialTab === 'concrete' ? undefined : (useCustom ? undefined : selectedPresetId),
        presetName: selectedMaterialTab === 'concrete'
          ? `${concreteClass} ${concreteShape === 'circular' ? `\u00D8${concreteDiameter}` : `${concreteWidth}x${concreteHeight}`}`
          : preset?.name,
        material: selectedMaterialTab === 'concrete' ? 'concrete' : material,
        justification,
        showCenterline,
        showLabel,
        viewMode: effectiveViewMode,
      });
    }
    onClose();
  };

  // Reset dialog state when opening
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setSearchQuery('');
      setMode(initialMode);
      setRotation(0);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="bg-cad-surface border border-cad-border shadow-xl w-[850px] h-[580px] flex flex-col"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b border-cad-border select-none"
          style={{ background: 'linear-gradient(to bottom, #ffffff, #f5f5f5)', borderColor: '#d4d4d4' }}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold text-gray-800">Column / Beam</h2>
            <div className="flex border border-cad-border rounded overflow-hidden">
              <button
                onClick={() => { setMode('column'); }}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  mode === 'column'
                    ? 'bg-cad-accent text-white'
                    : 'bg-cad-input text-gray-600 hover:bg-cad-hover'
                }`}
              >
                Column
              </button>
              <button
                onClick={() => { setMode('beam'); setViewMode('plan'); }}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  mode === 'beam'
                    ? 'bg-cad-accent text-white'
                    : 'bg-cad-input text-gray-600 hover:bg-cad-hover'
                }`}
              >
                Beam
              </button>
              <button
                onClick={() => { setMode('sideview'); setViewMode('side'); }}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  mode === 'sideview'
                    ? 'bg-cad-accent text-white'
                    : 'bg-cad-input text-gray-600 hover:bg-cad-hover'
                }`}
              >
                Sideview Beam
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-cad-hover rounded transition-colors text-gray-600 hover:text-gray-800 cursor-default -mr-1"
          >
            <X size={14} />
          </button>
        </div>

        {/* Global Search Bar - hidden for concrete tab */}
        {selectedMaterialTab !== 'concrete' && (
          <div className="px-3 py-2 border-b border-cad-border bg-cad-surface">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cad-text-dim" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all profiles (e.g. W8x31, IPE200, L6x6)..."
                className="w-full pl-8 pr-8 py-1.5 text-sm bg-cad-input border border-cad-border text-cad-text rounded"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-cad-text-dim hover:text-cad-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Material Tabs */}
        <div className="px-3 py-1 border-b border-cad-border bg-cad-surface flex gap-1 overflow-x-auto">
          {([
            { key: 'steel' as ProfileMaterial, label: 'Steel' },
            { key: 'cold-formed-steel' as ProfileMaterial, label: 'Cold-Formed' },
            { key: 'concrete' as ProfileMaterial, label: 'Concrete' },
            { key: 'timber' as ProfileMaterial, label: 'Timber' },
            { key: 'aluminum' as ProfileMaterial, label: 'Aluminum' },
            { key: 'other' as ProfileMaterial, label: 'Other' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedMaterialTab(tab.key);
                setSelectedPresetId('');
                setSelectedCategory('');
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-colors border-b-2 ${
                selectedMaterialTab === tab.key
                  ? 'border-cad-accent text-cad-accent'
                  : 'border-transparent text-cad-text-dim hover:text-cad-text hover:border-cad-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">

          {/* ================================================================ */}
          {/* CONCRETE TAB: completely different layout                         */}
          {/* ================================================================ */}
          {selectedMaterialTab === 'concrete' ? (
            <>
              {/* Left: Concrete dimensions & class */}
              <div className="w-[280px] border-r border-cad-border flex flex-col">
                {/* Sub-tabs: Dimensions | Reinforcement */}
                <div className="flex border-b border-cad-border">
                  <button
                    onClick={() => setConcreteSubTab('dimensions')}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors border-b-2 ${
                      concreteSubTab === 'dimensions'
                        ? 'border-cad-accent text-cad-accent'
                        : 'border-transparent text-cad-text-dim hover:text-cad-text'
                    }`}
                  >
                    Dimensions
                  </button>
                  <button
                    onClick={() => setConcreteSubTab('reinforcement')}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors border-b-2 ${
                      concreteSubTab === 'reinforcement'
                        ? 'border-cad-accent text-cad-accent'
                        : 'border-transparent text-cad-text-dim hover:text-cad-text'
                    }`}
                  >
                    Reinforcement
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {concreteSubTab === 'dimensions' ? (
                    <div className="space-y-3">
                      {/* Shape selector (only for column mode) */}
                      {mode === 'column' && (
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">Shape:</label>
                          <div className="flex border border-cad-border rounded overflow-hidden">
                            <button
                              onClick={() => setConcreteShape('rectangular')}
                              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                                concreteShape === 'rectangular'
                                  ? 'bg-cad-accent text-white'
                                  : 'bg-cad-input text-cad-text hover:bg-cad-hover'
                              }`}
                            >
                              Rectangular
                            </button>
                            <button
                              onClick={() => setConcreteShape('circular')}
                              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                                concreteShape === 'circular'
                                  ? 'bg-cad-accent text-white'
                                  : 'bg-cad-input text-cad-text hover:bg-cad-hover'
                              }`}
                            >
                              Circular
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Dimensions based on shape */}
                      {(mode !== 'column' || concreteShape === 'rectangular') ? (
                        <>
                          <div>
                            <label className="block text-xs text-cad-text-dim mb-1">
                              Width <span className="text-[10px]">(mm)</span>
                            </label>
                            <input
                              type="number"
                              value={concreteWidth}
                              onChange={(e) => setConcreteWidth(Math.max(50, parseFloat(e.target.value) || 300))}
                              min={50}
                              max={3000}
                              step={10}
                              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-cad-text-dim mb-1">
                              Height <span className="text-[10px]">(mm)</span>
                            </label>
                            <input
                              type="number"
                              value={concreteHeight}
                              onChange={(e) => setConcreteHeight(Math.max(50, parseFloat(e.target.value) || 500))}
                              min={50}
                              max={3000}
                              step={10}
                              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">
                            Diameter <span className="text-[10px]">(mm)</span>
                          </label>
                          <input
                            type="number"
                            value={concreteDiameter}
                            onChange={(e) => setConcreteDiameter(Math.max(100, parseFloat(e.target.value) || 400))}
                            min={100}
                            max={3000}
                            step={10}
                            className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                          />
                        </div>
                      )}

                      {/* Concrete class */}
                      <div>
                        <label className="block text-xs text-cad-text-dim mb-1">Concrete Class:</label>
                        <select
                          value={concreteClass}
                          onChange={(e) => setConcreteClass(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                        >
                          <option value="C20/25">C20/25</option>
                          <option value="C25/30">C25/30</option>
                          <option value="C30/37">C30/37</option>
                          <option value="C35/45">C35/45</option>
                          <option value="C45/55">C45/55</option>
                        </select>
                      </div>

                      {/* Section summary info */}
                      <div className="mt-2 p-2 bg-cad-bg rounded text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Section:</span>
                          <span className="text-cad-text font-medium">
                            {(mode !== 'column' || concreteShape === 'rectangular')
                              ? `${concreteWidth} x ${concreteHeight} mm`
                              : `\u00D8${concreteDiameter} mm`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Area:</span>
                          <span className="text-cad-text font-medium">
                            {(mode !== 'column' || concreteShape === 'rectangular')
                              ? `${(concreteWidth * concreteHeight).toLocaleString()} mm\u00B2`
                              : `${Math.round(Math.PI * (concreteDiameter / 2) ** 2).toLocaleString()} mm\u00B2`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Class:</span>
                          <span className="text-cad-text font-medium">{concreteClass}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Reinforcement sub-tab */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-cad-text-dim mb-1">Main Rebar Diameter (mm)</label>
                        <select
                          value={rebarMainDiameter}
                          onChange={(e) => setRebarMainDiameter(Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                        >
                          {[8, 10, 12, 16, 20, 25, 32].map(d => (
                            <option key={d} value={d}>{d} mm</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-cad-text-dim mb-1">Number of Main Bars</label>
                        <input
                          type="number"
                          value={rebarMainCount}
                          onChange={(e) => setRebarMainCount(Math.max(2, parseInt(e.target.value) || 2))}
                          min={2}
                          max={32}
                          className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-cad-text-dim mb-1">Stirrup Diameter (mm)</label>
                        <select
                          value={rebarStirrupDiameter}
                          onChange={(e) => setRebarStirrupDiameter(Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                        >
                          {[6, 8, 10].map(d => (
                            <option key={d} value={d}>{d} mm</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-cad-text-dim mb-1">Stirrup Spacing (mm)</label>
                        <input
                          type="number"
                          value={rebarStirrupSpacing}
                          onChange={(e) => setRebarStirrupSpacing(Math.max(50, parseFloat(e.target.value) || 200))}
                          min={50}
                          step={25}
                          className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-cad-text-dim mb-1">Cover (mm)</label>
                        <input
                          type="number"
                          value={rebarCover}
                          onChange={(e) => setRebarCover(Math.max(15, parseFloat(e.target.value) || 30))}
                          min={15}
                          step={5}
                          className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                        />
                      </div>
                      <div className="mt-2 p-2 bg-cad-bg rounded text-[10px] text-cad-text-dim">
                        Reinforcement is shown in the cross-section preview. Main bars are placed around the perimeter with the specified cover distance.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle: Options for concrete */}
              <div className="w-[260px] border-r border-cad-border flex flex-col">
                <div className="p-3 border-b border-cad-border">
                  <h3 className="text-xs font-medium text-cad-text">
                    {mode === 'column' ? 'Column Options' : mode === 'sideview' ? 'Sideview Options' : 'Beam Options'}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    {(mode === 'beam' || mode === 'sideview') ? (
                      <>
                        {/* Justification */}
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">Justification:</label>
                          <select
                            value={justification}
                            onChange={(e) => setJustification(e.target.value as BeamJustification)}
                            className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>

                        {/* View Mode (hidden in sideview mode) */}
                        {mode !== 'sideview' && (
                          <div>
                            <label className="block text-xs text-cad-text-dim mb-1">View:</label>
                            <select
                              value={viewMode}
                              onChange={(e) => setViewMode(e.target.value as 'plan' | 'section' | 'elevation' | 'side')}
                              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                            >
                              <option value="plan">Plan</option>
                              <option value="section">Section</option>
                              <option value="elevation">Elevation</option>
                              <option value="side">Side</option>
                            </select>
                          </div>
                        )}

                        {/* Display Options */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showCenterline}
                              onChange={(e) => setShowCenterline(e.target.checked)}
                              className="form-checkbox w-3 h-3"
                            />
                            <span className="text-xs text-cad-text">Show centerline</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showLabel}
                              onChange={(e) => setShowLabel(e.target.checked)}
                              className="form-checkbox w-3 h-3"
                            />
                            <span className="text-xs text-cad-text">Show label</span>
                          </label>
                        </div>

                        {/* Beam width info */}
                        <div className="mt-2 p-2 bg-cad-bg rounded text-[10px]">
                          <span className="text-cad-text-dim">Beam width in plan: </span>
                          <span className="text-cad-text font-medium">
                            {`${concreteWidth.toFixed(0)} mm`}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Rotation for column */}
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">Rotation (degrees):</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={rotation}
                              onChange={(e) => setRotation(parseFloat(e.target.value) || 0)}
                              className="flex-1 px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                              step={15}
                            />
                            <button
                              onClick={() => setRotation(r => (r + 90) % 360)}
                              className="px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text hover:bg-cad-hover"
                              title="Rotate 90 degrees"
                            >
                              +90
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 p-2 bg-cad-bg rounded text-[10px] text-cad-text-dim">
                          Click Place, then click on canvas to insert the column
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ================================================================ */}
              {/* NON-CONCRETE TABS: original layout                               */}
              {/* ================================================================ */}

              {/* Left: Profile Type & Presets */}
              <div className="w-[280px] border-r border-cad-border flex flex-col">
                {/* Filters (hidden during search) */}
                {!searchQuery && (
                  <>
                    {/* Profile Type Selection (filtered by material) */}
                    <div className="p-3 border-b border-cad-border">
                      <label className="block text-xs text-cad-text-dim mb-1">Profile Type:</label>
                      <select
                        value={selectedProfileType}
                        onChange={(e) => {
                          setSelectedProfileType(e.target.value as ProfileType);
                          setSelectedPresetId('');
                          setSelectedCategory('');
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-cad-input border border-cad-border text-cad-text"
                      >
                        {(materialProfileTypes.length > 0 ? materialProfileTypes : getAllProfileTemplates()).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Standard & Category */}
                    <div className="p-3 border-b border-cad-border">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-cad-text-dim mb-1">Standard:</label>
                          <select
                            value={selectedStandard}
                            onChange={(e) => {
                              setSelectedStandard(e.target.value);
                              setSelectedCategory('');
                              setSelectedPresetId('');
                            }}
                            className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                          >
                            {(materialStandards.length > 0 ? materialStandards : getAvailableStandards()).map(std => (
                              <option key={std} value={std}>{std}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-cad-text-dim mb-1">Category:</label>
                          <select
                            value={selectedCategory}
                            onChange={(e) => {
                              setSelectedCategory(e.target.value);
                              setSelectedPresetId('');
                            }}
                            className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                          >
                            <option value="">All</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Preset List */}
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {/* Custom option (hidden during search) */}
                    {!searchQuery && (
                      <button
                        onClick={() => {
                          setUseCustom(true);
                          setSelectedPresetId('');
                          setParameters(getDefaultParameters(selectedProfileType));
                        }}
                        className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                          useCustom && !selectedPresetId
                            ? 'bg-cad-accent text-white'
                            : 'hover:bg-cad-hover text-cad-text'
                        }`}
                      >
                        [Custom Dimensions]
                      </button>
                    )}

                    {/* Grouped search results */}
                    {groupedSearchResults ? (
                      Object.entries(groupedSearchResults).map(([profileType, presets]) => {
                        const typeName = PROFILE_TEMPLATES[profileType as ProfileType]?.name || profileType;
                        return (
                          <div key={profileType}>
                            <div className="px-2 py-1 text-[10px] font-semibold text-cad-text-muted uppercase tracking-wider bg-cad-surface sticky top-0 border-b border-cad-border">
                              {typeName}
                            </div>
                            {presets.map(preset => (
                              <button
                                key={preset.id}
                                onClick={() => {
                                  setSelectedProfileType(preset.profileType);
                                  setSelectedStandard(preset.standard);
                                  setSelectedCategory(preset.category);
                                  setSelectedPresetId(preset.id);
                                  setUseCustom(false);
                                  setSearchQuery('');
                                }}
                                className="w-full text-left px-2 py-1.5 text-xs transition-colors hover:bg-cad-hover text-cad-text"
                              >
                                <span className="font-medium">{preset.name}</span>
                                <span className="ml-2 text-cad-text-dim text-[10px]">
                                  {preset.standard} · {preset.category}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })
                    ) : (
                      filteredPresets.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setSelectedPresetId(preset.id);
                            setUseCustom(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                            selectedPresetId === preset.id
                              ? 'bg-cad-accent text-white'
                              : 'hover:bg-cad-hover text-cad-text'
                          }`}
                        >
                          <span className="font-medium">{preset.name}</span>
                          {preset.properties?.weight && (
                            <span className="ml-2 text-cad-text-dim text-[10px]">
                              {preset.properties.weight.toFixed(1)} kg/m
                            </span>
                          )}
                        </button>
                      ))
                    )}

                    {filteredPresets.length === 0 && !searchQuery && (
                      <div className="text-center text-cad-text-dim py-4 text-xs">
                        No presets for this profile type
                      </div>
                    )}

                    {filteredPresets.length === 0 && searchQuery && (
                      <div className="text-center text-cad-text-dim py-4 text-xs">
                        No results for &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Parameters & Options */}
              <div className="w-[260px] border-r border-cad-border flex flex-col">
                <div className="p-3 border-b border-cad-border">
                  <h3 className="text-xs font-medium text-cad-text">
                    {useCustom ? 'Custom Dimensions' : (selectedPresetId ? `Preset: ${selectedPresetId}` : 'Dimensions')}
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {/* Profile Parameters */}
                  <div className="space-y-3">
                    {template?.parameters.map(param => (
                      <ParameterInput
                        key={param.id}
                        definition={param}
                        value={parameters[param.id]}
                        onChange={(value) => handleParameterChange(param.id, value)}
                        disabled={!useCustom && !!selectedPresetId}
                      />
                    ))}
                  </div>

                  {/* Mode-specific Options */}
                  <div className="mt-4 pt-4 border-t border-cad-border space-y-3">
                    <h4 className="text-[10px] font-medium text-cad-text-dim uppercase tracking-wider">
                      {mode === 'column' ? 'Column Options' : mode === 'sideview' ? 'Sideview Options' : 'Beam Options'}
                    </h4>

                    {(mode === 'beam' || mode === 'sideview') ? (
                      <>
                        {/* Material */}
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">Material:</label>
                          <select
                            value={material}
                            onChange={(e) => setMaterial(e.target.value as BeamMaterial)}
                            className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                          >
                            <option value="steel">Steel</option>
                            <option value="cold-formed-steel">Cold-Formed Steel</option>
                            <option value="concrete">Concrete</option>
                            <option value="timber">Timber</option>
                            <option value="aluminum">Aluminum</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        {/* Justification */}
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">Justification:</label>
                          <select
                            value={justification}
                            onChange={(e) => setJustification(e.target.value as BeamJustification)}
                            className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>

                        {/* View Mode (hidden in sideview mode) */}
                        {mode !== 'sideview' && (
                          <div>
                            <label className="block text-xs text-cad-text-dim mb-1">View:</label>
                            <select
                              value={viewMode}
                              onChange={(e) => setViewMode(e.target.value as 'plan' | 'section' | 'elevation' | 'side')}
                              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                            >
                              <option value="plan">Plan</option>
                              <option value="section">Section</option>
                              <option value="elevation">Elevation</option>
                              <option value="side">Side</option>
                            </select>
                          </div>
                        )}

                        {/* Display Options */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showCenterline}
                              onChange={(e) => setShowCenterline(e.target.checked)}
                              className="form-checkbox w-3 h-3"
                            />
                            <span className="text-xs text-cad-text">Show centerline</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showLabel}
                              onChange={(e) => setShowLabel(e.target.checked)}
                              className="form-checkbox w-3 h-3"
                            />
                            <span className="text-xs text-cad-text">Show label</span>
                          </label>
                        </div>

                        {/* Flange Width Info */}
                        <div className="mt-2 p-2 bg-cad-bg rounded text-[10px]">
                          <span className="text-cad-text-dim">Beam width in plan: </span>
                          <span className="text-cad-text font-medium">{flangeWidth.toFixed(1)} mm</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Rotation for column */}
                        <div>
                          <label className="block text-xs text-cad-text-dim mb-1">Rotation (degrees):</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={rotation}
                              onChange={(e) => setRotation(parseFloat(e.target.value) || 0)}
                              className="flex-1 px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
                              step={15}
                            />
                            <button
                              onClick={() => setRotation(r => (r + 90) % 360)}
                              className="px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text hover:bg-cad-hover"
                              title="Rotate 90°"
                            >
                              +90°
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 p-2 bg-cad-bg rounded text-[10px] text-cad-text-dim">
                          Click Place, then click on canvas to insert the column section
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Right: Preview (shared between all tabs) */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-cad-border">
              <h3 className="text-xs font-medium text-cad-text">Cross-Section Preview</h3>
            </div>

            <div className="flex-1 p-3 flex items-center justify-center bg-[#1a1a2e]">
              <canvas
                ref={canvasRef}
                width={220}
                height={220}
                className="border border-cad-border"
              />
            </div>

            {/* Section Properties (if available, for non-concrete tabs) */}
            {selectedMaterialTab !== 'concrete' && selectedPresetId && (() => {
              const preset = getPresetById(selectedPresetId);
              if (preset?.properties) {
                return (
                  <div className="p-3 border-t border-cad-border">
                    <h4 className="text-[10px] font-medium text-cad-text-dim uppercase tracking-wider mb-2">
                      Section Properties
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                      {preset.properties.area && (
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Area:</span>
                          <span className="text-cad-text">{preset.properties.area.toFixed(0)} mm2</span>
                        </div>
                      )}
                      {preset.properties.weight && (
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Weight:</span>
                          <span className="text-cad-text">{preset.properties.weight.toFixed(1)} kg/m</span>
                        </div>
                      )}
                      {preset.properties.Ix && (
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Ix:</span>
                          <span className="text-cad-text">{(preset.properties.Ix / 1e6).toFixed(2)}x10^6 mm4</span>
                        </div>
                      )}
                      {preset.properties.Iy && (
                        <div className="flex justify-between">
                          <span className="text-cad-text-dim">Iy:</span>
                          <span className="text-cad-text">{(preset.properties.Iy / 1e6).toFixed(2)}x10^6 mm4</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Concrete section properties summary */}
            {selectedMaterialTab === 'concrete' && (
              <div className="p-3 border-t border-cad-border">
                <h4 className="text-[10px] font-medium text-cad-text-dim uppercase tracking-wider mb-2">
                  Concrete Section
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-cad-text-dim">Shape:</span>
                    <span className="text-cad-text">
                      {(mode !== 'column' || concreteShape === 'rectangular') ? 'Rectangular' : 'Circular'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cad-text-dim">Class:</span>
                    <span className="text-cad-text">{concreteClass}</span>
                  </div>
                  {(mode !== 'column' || concreteShape === 'rectangular') ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-cad-text-dim">Width:</span>
                        <span className="text-cad-text">{concreteWidth} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cad-text-dim">Height:</span>
                        <span className="text-cad-text">{concreteHeight} mm</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-cad-text-dim">Diameter:</span>
                      <span className="text-cad-text">{concreteDiameter} mm</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-cad-border flex justify-between items-center">
          <div className="text-xs text-cad-text-dim">
            {mode === 'column'
              ? 'Click Place, then click on canvas to insert the column'
              : 'Click Draw, then click start and end points on canvas'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs bg-cad-input border border-cad-border text-cad-text hover:bg-cad-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleDraw}
              className="px-3 py-1 text-xs bg-cad-accent text-white hover:bg-cad-accent/80"
            >
              {mode === 'column' ? 'Place Column' : mode === 'sideview' ? 'Draw Sideview' : 'Draw Beam'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Parameter Input Component
// ============================================================================

interface ParameterInputProps {
  definition: ParameterDefinition;
  value: number | string | boolean | undefined;
  onChange: (value: number | string | boolean) => void;
  disabled?: boolean;
}

function ParameterInput({ definition, value, onChange, disabled }: ParameterInputProps) {
  const displayValue = value ?? definition.defaultValue;

  return (
    <div>
      <label className="block text-xs text-cad-text-dim mb-1" title={definition.description}>
        {definition.label}
        {definition.unit && <span className="ml-1 text-[10px]">({definition.unit})</span>}
      </label>

      {definition.type === 'number' && (
        <input
          type="number"
          value={displayValue as number}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={definition.min}
          max={definition.max}
          step={definition.step || 1}
          disabled={disabled}
          className={`w-full px-2 py-1 text-xs border border-cad-border text-cad-text ${
            disabled ? 'bg-cad-surface text-cad-text-dim cursor-not-allowed' : 'bg-cad-input'
          }`}
        />
      )}

      {definition.type === 'select' && definition.options && (
        <select
          value={displayValue as string}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-2 py-1 text-xs border border-cad-border text-cad-text ${
            disabled ? 'bg-cad-surface text-cad-text-dim cursor-not-allowed' : 'bg-cad-input'
          }`}
        >
          {definition.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {definition.type === 'boolean' && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={displayValue as boolean}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="form-checkbox"
          />
          <span className="text-xs text-cad-text">{definition.label}</span>
        </label>
      )}
    </div>
  );
}

export default BeamDialog;
