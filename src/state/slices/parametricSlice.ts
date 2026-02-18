/**
 * Parametric Slice - Manages parametric shapes
 *
 * Parametric shapes are defined by parameters and templates rather than
 * fixed geometry. They are stored separately from regular shapes but
 * rendered alongside them.
 */

import { produceWithPatches, current } from 'immer';
import type { Point, ShapeStyle, Shape, WallShape, Drawing, PilePlanSettings } from '../../types/geometry';
import type {
  ParametricShape,
  ProfileType,
  ParameterValues,
} from '../../types/parametric';
import type { BeamMaterial, BeamJustification, GridlineBubblePosition, WallJustification, WallEndCap, WallType, SlabType, ColumnType, BeamType } from '../../types/geometry';
import type { MaterialHatchSettings, MaterialHatchSetting, DrawingStandardsPreset } from '../../types/hatch';
import { DEFAULT_MATERIAL_HATCH_SETTINGS } from '../../types/hatch';
import {
  createProfileShape,
  updateParametricParameters,
  updateParametricPosition,
  updateParametricRotation,
  updateParametricScale,
  explodeParametricShape,
  cloneParametricShape,
} from '../../services/parametric/parametricService';

import type { HistoryEntry } from './historySlice';

// ============================================================================
// Project Structure Types (IFC spatial hierarchy)
// ============================================================================

export interface ProjectStorey {
  id: string;
  name: string;
  elevation: number; // in mm
}

export interface ProjectBuilding {
  id: string;
  name: string;
  storeys: ProjectStorey[];
}

export interface ProjectStructure {
  siteName: string;
  buildings: ProjectBuilding[];
  /** Sea level datum: elevation of peil=0 relative to NAP (Normaal Amsterdams Peil) in meters.
   *  e.g., -0.5 means peil=0 is at -0.5m NAP. Default 0. */
  seaLevelDatum: number;
}

// ============================================================================
// State Interface
// ============================================================================

export interface ParametricState {
  /** All parametric shapes in the document */
  parametricShapes: ParametricShape[];

  /** Project structure (IFC spatial hierarchy) */
  projectStructure: ProjectStructure;

  /** Project Structure dialog state */
  projectStructureDialogOpen: boolean;

  /** Section dialog state */
  sectionDialogOpen: boolean;
  pendingSection: {
    profileType: ProfileType;
    parameters: ParameterValues;
    presetId?: string;
    rotation: number;
  } | null;

  /** Preview position for section placement (mouse following) */
  sectionPlacementPreview: Point | null;

  /** Beam dialog state */
  beamDialogOpen: boolean;
  beamDialogInitialViewMode?: 'plan' | 'section' | 'elevation' | 'side';
  pendingBeam: {
    profileType: ProfileType;
    parameters: ParameterValues;
    presetId?: string;
    presetName?: string;
    flangeWidth: number;
    material: BeamMaterial;
    justification: BeamJustification;
    showCenterline: boolean;
    showLabel: boolean;
    continueDrawing: boolean;
    viewMode?: 'plan' | 'section' | 'elevation' | 'side';
    shapeMode: 'line' | 'arc' | 'rectangle' | 'circle';
  } | null;

  /** Gridline dialog state */
  gridlineDialogOpen: boolean;
  pendingGridline: {
    label: string;
    bubblePosition: GridlineBubblePosition;
    bubbleRadius: number;
    fontSize: number;
  } | null;

  /** Level pending state */
  pendingLevel: {
    label: string;
    labelPosition: 'start' | 'end' | 'both';
    bubbleRadius: number;
    fontSize: number;
    elevation: number;
    peil: number;
    description?: string;
  } | null;

  /** Pile dialog state */
  pileDialogOpen: boolean;
  pendingPile: {
    label: string;
    diameter: number;
    fontSize: number;
    showCross: boolean;
  } | null;

  /** CPT dialog state */
  cptDialogOpen: boolean;
  pendingCPT: {
    name: string;
    fontSize: number;
    markerSize: number;
  } | null;

  /** Pile plan settings */
  pilePlanSettings: PilePlanSettings;

  /** Wall dialog state */
  wallDialogOpen: boolean;
  pendingWall: {
    thickness: number;
    wallTypeId?: string;
    justification: WallJustification;
    showCenterline: boolean;
    startCap: WallEndCap;
    endCap: WallEndCap;
    continueDrawing: boolean;
    shapeMode: 'line' | 'arc' | 'rectangle' | 'circle';
    spaceBounding: boolean;
  } | null;

  /** Slab pending state */
  pendingSlab: {
    thickness: number;
    level: string;
    elevation: number;
    material: 'concrete' | 'timber' | 'steel' | 'generic';
    slabTypeId?: string;
    shapeMode: 'line' | 'arc' | 'rectangle' | 'circle';
  } | null;

  /** Section callout pending state */
  pendingSectionCallout: {
    label: string;
    bubbleRadius: number;
    fontSize: number;
    flipDirection: boolean;
    hideStartHead?: boolean;
    hideEndHead?: boolean;
    viewDepth: number;
  } | null;

  /** Space (IfcSpace) pending state */
  pendingSpace: {
    name: string;
    number?: string;
    level?: string;
    fillColor?: string;
    fillOpacity?: number;
  } | null;

  /** Plate System pending state */
  pendingPlateSystem: {
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
    layers?: { name: string; thickness: number; material: string; position: 'top' | 'bottom' }[];
    name?: string;
    shapeMode: 'line' | 'arc' | 'rectangle' | 'circle';
  } | null;

  /** Plate System dialog open state */
  plateSystemDialogOpen: boolean;

  /** Drawing Standards dialog state */
  drawingStandardsDialogOpen: boolean;

  /** Gridline extension distance in mm (how far the line extends beyond start/end before the bubble) */
  gridlineExtension: number;

  /** Offset between dimension line rows for grid dimensioning (mm). Default 200. */
  gridDimensionLineOffset: number;

  /** Whether to auto-regenerate grid dimensions when gridlines change */
  autoGridDimension: boolean;

  /** Whether to show dimension text between gridlines in section views */
  sectionGridlineDimensioning: boolean;

  /** Materials dialog state */
  materialsDialogOpen: boolean;

  /** Wall Types dialog state */
  wallTypesDialogOpen: boolean;

  /** Last-used wall type ID — persists across tool switches so the wall tool
   *  defaults to the previously chosen wall type instead of resetting. */
  lastUsedWallTypeId: string | null;

  /** Wall types */
  wallTypes: WallType[];

  /** Slab types */
  slabTypes: SlabType[];

  /** Column types */
  columnTypes: ColumnType[];

  /** Beam types */
  beamTypes: BeamType[];

  /** Material hatch settings (Drawing Standards) - maps material category to hatch settings */
  materialHatchSettings: MaterialHatchSettings;

  /** Drawing Standards presets — named configurations of all Drawing Standards settings */
  drawingStandardsPresets: DrawingStandardsPreset[];

  /** ID of the currently active Drawing Standards preset */
  activeDrawingStandardsId: string;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface ParametricActions {
  // Parametric shape CRUD
  addParametricShape: (shape: ParametricShape) => void;
  updateParametricShape: (id: string, updates: Partial<ParametricShape>) => void;
  deleteParametricShape: (id: string) => void;
  deleteParametricShapes: (ids: string[]) => void;

  // Profile-specific actions
  insertProfile: (
    profileType: ProfileType,
    position: Point,
    layerId: string,
    drawingId: string,
    options?: {
      parameters?: Partial<ParameterValues>;
      presetId?: string;
      rotation?: number;
      scale?: number;
      style?: Partial<ShapeStyle>;
    }
  ) => string;

  // Parameter updates
  updateProfileParameters: (id: string, parameters: Partial<ParameterValues>) => void;
  updateProfilePosition: (id: string, position: Point) => void;
  updateProfileRotation: (id: string, rotation: number) => void;
  updateProfileScale: (id: string, scale: number) => void;

  // Explode (convert to regular shapes)
  explodeParametricShapes: (ids: string[]) => Shape[];

  // Clone
  cloneParametricShapes: (ids: string[], offset: Point) => ParametricShape[];

  // Selection helpers
  getParametricShapesForDrawing: (drawingId: string) => ParametricShape[];
  getParametricShapeById: (id: string) => ParametricShape | undefined;

  // Section dialog
  openSectionDialog: () => void;
  closeSectionDialog: () => void;
  setPendingSection: (pending: ParametricState['pendingSection']) => void;
  clearPendingSection: () => void;
  setSectionPlacementPreview: (position: Point | null) => void;

  // Beam dialog
  openBeamDialog: (initialViewMode?: 'plan' | 'section' | 'elevation' | 'side') => void;
  closeBeamDialog: () => void;
  setPendingBeam: (pending: ParametricState['pendingBeam']) => void;
  clearPendingBeam: () => void;

  // Gridline dialog
  openGridlineDialog: () => void;
  closeGridlineDialog: () => void;
  setPendingGridline: (pending: ParametricState['pendingGridline']) => void;
  clearPendingGridline: () => void;

  // Level
  setPendingLevel: (pending: ParametricState['pendingLevel']) => void;
  clearPendingLevel: () => void;

  // Pile dialog
  openPileDialog: () => void;
  closePileDialog: () => void;
  setPendingPile: (pending: ParametricState['pendingPile']) => void;
  clearPendingPile: () => void;

  // CPT dialog
  openCPTDialog: () => void;
  closeCPTDialog: () => void;
  setPendingCPT: (pending: ParametricState['pendingCPT']) => void;
  clearPendingCPT: () => void;

  // Pile plan settings
  setPilePlanSettings: (settings: Partial<PilePlanSettings>) => void;

  // Wall dialog
  openWallDialog: () => void;
  closeWallDialog: () => void;
  setPendingWall: (pending: ParametricState['pendingWall']) => void;
  clearPendingWall: () => void;

  // Slab
  setPendingSlab: (pending: ParametricState['pendingSlab']) => void;
  clearPendingSlab: () => void;

  // Section Callout
  setPendingSectionCallout: (pending: ParametricState['pendingSectionCallout']) => void;
  clearPendingSectionCallout: () => void;

  // Space (IfcSpace)
  setPendingSpace: (pending: ParametricState['pendingSpace']) => void;
  clearPendingSpace: () => void;

  // Plate System
  openPlateSystemDialog: () => void;
  closePlateSystemDialog: () => void;
  setPendingPlateSystem: (pending: ParametricState['pendingPlateSystem']) => void;
  clearPendingPlateSystem: () => void;

  // Wall types
  addWallType: (wallType: WallType) => void;
  updateWallType: (id: string, updates: Partial<WallType>) => void;
  deleteWallType: (id: string) => void;
  setWallTypes: (wallTypes: WallType[]) => void;
  setLastUsedWallTypeId: (id: string | null) => void;

  // Slab types
  addSlabType: (slabType: SlabType) => void;
  updateSlabType: (id: string, updates: Partial<SlabType>) => void;
  deleteSlabType: (id: string) => void;

  // Column types
  addColumnType: (columnType: ColumnType) => void;
  updateColumnType: (id: string, updates: Partial<ColumnType>) => void;
  deleteColumnType: (id: string) => void;

  // Beam types
  addBeamType: (beamType: BeamType) => void;
  updateBeamType: (id: string, updates: Partial<BeamType>) => void;
  deleteBeamType: (id: string) => void;

  // Drawing Standards
  openDrawingStandardsDialog: () => void;
  closeDrawingStandardsDialog: () => void;
  setGridlineExtension: (value: number) => void;
  setGridDimensionLineOffset: (value: number) => void;
  setAutoGridDimension: (value: boolean) => void;
  setSectionGridlineDimensioning: (value: boolean) => void;

  // Material Hatch Settings (Drawing Standards)
  updateMaterialHatchSetting: (material: string, setting: Partial<MaterialHatchSetting>) => void;
  setMaterialHatchSettings: (settings: MaterialHatchSettings) => void;

  // Drawing Standards Presets
  saveDrawingStandards: (name: string) => string;
  loadDrawingStandards: (id: string) => void;
  deleteDrawingStandards: (id: string) => void;
  renameDrawingStandards: (id: string, name: string) => void;

  // Materials dialog
  openMaterialsDialog: () => void;
  closeMaterialsDialog: () => void;

  // Wall Types dialog
  openWallTypesDialog: () => void;
  closeWallTypesDialog: () => void;

  // Project Structure dialog
  openProjectStructureDialog: () => void;
  closeProjectStructureDialog: () => void;

  // Project Structure actions
  setProjectStructure: (structure: ProjectStructure) => void;
  updateSiteName: (name: string) => void;
  setSeaLevelDatum: (value: number) => void;
  addBuilding: (building: ProjectBuilding) => void;
  removeBuilding: (id: string) => void;
  updateBuilding: (id: string, updates: Partial<Omit<ProjectBuilding, 'storeys'>>) => void;
  addStorey: (buildingId: string, storey: ProjectStorey) => void;
  removeStorey: (buildingId: string, storeyId: string) => void;
  updateStorey: (buildingId: string, storeyId: string, updates: Partial<ProjectStorey>) => void;
}

export type ParametricSlice = ParametricState & ParametricActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialParametricState: ParametricState = {
  parametricShapes: [],
  projectStructure: {
    siteName: 'My Site',
    buildings: [{
      id: 'building-1',
      name: 'My Building',
      storeys: [
        { id: 'storey-tf', name: 'Top Foundation', elevation: -400 },
        { id: 'storey-gf', name: 'Ground Floor', elevation: 0 },
        { id: 'storey-ff', name: 'First Floor', elevation: 3100 },
      ],
    }],
    seaLevelDatum: 0,
  },
  projectStructureDialogOpen: false,
  sectionDialogOpen: false,
  pendingSection: null,
  sectionPlacementPreview: null,
  beamDialogOpen: false,
  beamDialogInitialViewMode: undefined,
  pendingBeam: null,
  gridlineDialogOpen: false,
  pendingGridline: null,
  pendingLevel: null,
  pileDialogOpen: false,
  pendingPile: null,
  cptDialogOpen: false,
  pendingCPT: null,
  pilePlanSettings: {
    symbolMode: 'cutoff-tip-diameter',
    numberingBandwidth: 500,
  },
  wallDialogOpen: false,
  pendingWall: null,
  pendingSlab: null,
  pendingSectionCallout: null,
  pendingSpace: null,
  pendingPlateSystem: null,
  plateSystemDialogOpen: false,
  drawingStandardsDialogOpen: false,
  gridlineExtension: 1000,
  gridDimensionLineOffset: 300,
  autoGridDimension: true,
  sectionGridlineDimensioning: true,
  materialsDialogOpen: false,
  wallTypesDialogOpen: false,
  lastUsedWallTypeId: null,
  wallTypes: [
    // Beton (Concrete) -- INB-Template standard structural wall types
    { id: 'beton-150', name: 'Beton', thickness: 150, material: 'concrete' },
    { id: 'beton-200', name: 'Beton', thickness: 200, material: 'concrete' },
    { id: 'beton-250', name: 'Beton', thickness: 250, material: 'concrete' },
    { id: 'beton-300', name: 'Beton', thickness: 300, material: 'concrete' },
    // Kalkzandsteen (Calcium Silicate)
    { id: 'kzst-100', name: 'Kalkzandsteen', thickness: 100, material: 'calcium-silicate' },
    { id: 'kzst-150', name: 'Kalkzandsteen', thickness: 150, material: 'calcium-silicate' },
    { id: 'kzst-214', name: 'Kalkzandsteen', thickness: 214, material: 'calcium-silicate' },
    // Metselwerk (Masonry)
    { id: 'metselwerk-100', name: 'Metselwerk', thickness: 100, material: 'masonry' },
    { id: 'metselwerk-210', name: 'Metselwerk', thickness: 210, material: 'masonry' },
    // HSB -- Houtskeletbouw (Timber frame)
    { id: 'hsb-120', name: 'Hout', thickness: 120, material: 'timber' },
    { id: 'hsb-170', name: 'Hout', thickness: 170, material: 'timber' },
    // Staal (Steel)
    { id: 'staal-10', name: 'Staal', thickness: 10, material: 'steel' },
    // Isolatie (Insulation)
    { id: 'isolatie-184', name: 'Isolatie', thickness: 184, material: 'insulation' },
  ],
  slabTypes: [
    // Beton (Concrete) slabs — INB-Template standard structural slab types
    { id: 'vloer-beton-150', name: 'Beton', thickness: 150, material: 'concrete' },
    { id: 'vloer-beton-200', name: 'Beton', thickness: 200, material: 'concrete' },
    { id: 'vloer-beton-250', name: 'Beton', thickness: 250, material: 'concrete' },
    { id: 'vloer-beton-300', name: 'Beton', thickness: 300, material: 'concrete' },
    // Kanaalplaat (Hollow core slab)
    { id: 'vloer-kanaalplaat-200', name: 'Kanaalplaat', thickness: 200, material: 'concrete' },
    { id: 'vloer-kanaalplaat-260', name: 'Kanaalplaat', thickness: 260, material: 'concrete' },
    { id: 'vloer-kanaalplaat-320', name: 'Kanaalplaat', thickness: 320, material: 'concrete' },
    // Hout (Timber) slabs
    { id: 'vloer-hout-200', name: 'Hout', thickness: 200, material: 'timber' },
  ],
  columnTypes: [
    // Beton (Concrete) columns
    { id: 'col-k300x300-c28', name: 'K300x300 C28/35', material: 'concrete', profileType: 'rectangular', width: 300, depth: 300, shape: 'rectangular' },
    { id: 'col-k400x400-c28', name: 'K400x400 C28/35', material: 'concrete', profileType: 'rectangular', width: 400, depth: 400, shape: 'rectangular' },
    { id: 'col-k500x500-c35', name: 'K500x500 C35/45', material: 'concrete', profileType: 'rectangular', width: 500, depth: 500, shape: 'rectangular' },
    // Staal (Steel) columns
    { id: 'col-hea200', name: 'HEA200', material: 'steel', profileType: 'HEA', width: 200, depth: 190, shape: 'rectangular' },
    { id: 'col-heb300', name: 'HEB300', material: 'steel', profileType: 'HEB', width: 300, depth: 300, shape: 'rectangular' },
  ],
  beamTypes: [
    // Staal (Steel) I-beams
    { id: 'beam-ipe200', name: 'IPE200', material: 'steel', profileType: 'i-beam', width: 100, height: 200, flangeWidth: 100, flangeThickness: 8.5, webThickness: 5.6 },
    { id: 'beam-ipe300', name: 'IPE300', material: 'steel', profileType: 'i-beam', width: 150, height: 300, flangeWidth: 150, flangeThickness: 10.7, webThickness: 7.1 },
    { id: 'beam-hea200', name: 'HEA200', material: 'steel', profileType: 'i-beam', width: 200, height: 190, flangeWidth: 200, flangeThickness: 10, webThickness: 6.5 },
    { id: 'beam-heb300', name: 'HEB300', material: 'steel', profileType: 'i-beam', width: 300, height: 300, flangeWidth: 300, flangeThickness: 19, webThickness: 11 },
    // Beton (Concrete) rectangular beams
    { id: 'beam-balk-200x400', name: 'Balk 200x400 C28/35', material: 'concrete', profileType: 'rectangular', width: 200, height: 400 },
    { id: 'beam-balk-300x500', name: 'Balk 300x500 C35/45', material: 'concrete', profileType: 'rectangular', width: 300, height: 500 },
  ],
  materialHatchSettings: { ...DEFAULT_MATERIAL_HATCH_SETTINGS },
  drawingStandardsPresets: [
    {
      id: 'default-nen-en',
      name: 'NEN-EN (Default)',
      isDefault: true,
      gridlineExtension: 1000,
      gridDimensionLineOffset: 300,
      materialHatchSettings: { ...DEFAULT_MATERIAL_HATCH_SETTINGS },
      sectionGridlineDimensioning: true,
    },
    {
      id: 'inb-template',
      name: 'INB-template',
      gridlineExtension: 1000,
      gridDimensionLineOffset: 300,
      sectionGridlineDimensioning: true,
      materialHatchSettings: {
        // NEN47-5: Gewapend beton TPG - solid gray fill
        concrete: { hatchType: 'solid', hatchAngle: 0, hatchSpacing: 50, hatchColor: '#C0C0C0', hatchPatternId: 'nen47-gewapend-beton' },
        // NEN47-1: Metselwerk baksteen - two close diagonal lines at 45deg, light brick red background
        masonry: { hatchType: 'diagonal', hatchAngle: 45, hatchSpacing: 800, hatchColor: '#000000', hatchPatternId: 'nen47-metselwerk-baksteen', backgroundColor: '#D4908F' },
        // NEN47-3: Metselwerk kunststeen (kalkzandsteen) - single diagonal at 45deg, grey/beige tones
        'calcium-silicate': { hatchType: 'diagonal', hatchAngle: 45, hatchSpacing: 800, hatchColor: '#A8A090', hatchPatternId: 'nen47-metselwerk-kunststeen', backgroundColor: '#C8C0B0' },
        // NEN47-12: Naaldhout - single diagonal at 45deg
        timber: { hatchType: 'diagonal', hatchAngle: 45, hatchSpacing: 30, hatchColor: '#000000', hatchPatternId: 'nen47-naaldhout' },
        // NEN47-18: Staal - solid black fill
        steel: { hatchType: 'solid', hatchAngle: 0, hatchSpacing: 20, hatchColor: '#000000', hatchPatternId: 'nen47-staal' },
        // NEN47-17: Isolatie - zigzag at 60deg, light yellow background
        insulation: { hatchType: 'crosshatch', hatchAngle: 60, hatchSpacing: 100, hatchColor: '#000000', hatchPatternId: 'nen47-isolatie', backgroundColor: '#FFFDE0' },
        // Generic fallback
        generic: { hatchType: 'diagonal', hatchAngle: 45, hatchSpacing: 60, hatchColor: '#808080' },
      },
    },
  ],
  activeDrawingStandardsId: 'default-nen-en',
};

// ============================================================================
// Slice Creator
// ============================================================================

interface StoreWithHistory {
  historyStack: HistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;
  isModified: boolean;
  shapes: Shape[];
  drawings: Drawing[];
  updateShapes: (updates: { id: string; updates: Partial<Shape> }[]) => void;
  syncAllSectionReferences?: () => void;
}

type FullStore = ParametricState & StoreWithHistory;

// Helper for history tracking (similar to modelSlice).
// Tags entries with target: 'parametricShapes' so undo/redo applies patches
// to the correct array.
function withParametricHistory(state: FullStore, mutate: (draft: ParametricShape[]) => void): void {
  const [nextShapes, patches, inversePatches] = produceWithPatches(
    current(state.parametricShapes),
    mutate
  );
  if (patches.length === 0) return;

  // Truncate future entries if we're not at the end.
  // When historyIndex is -1 (all undone), clear the entire stack.
  if (state.historyIndex < state.historyStack.length - 1) {
    state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
  }
  state.historyStack.push({ patches, inversePatches, target: 'parametricShapes' });
  if (state.historyStack.length > state.maxHistorySize) {
    state.historyStack.shift();
  }
  state.historyIndex = state.historyStack.length - 1;
  state.parametricShapes = nextShapes as ParametricShape[];
  state.isModified = true;
}

export const createParametricSlice = (
  set: (fn: (state: FullStore) => void) => void,
  get: () => FullStore
): ParametricActions => ({
  // ============================================================================
  // CRUD Operations
  // ============================================================================

  addParametricShape: (shape) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        draft.push(shape);
      });
    }),

  updateParametricShape: (id, updates) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        const index = draft.findIndex((s) => s.id === id);
        if (index !== -1) {
          Object.assign(draft[index], updates);
        }
      });
    }),

  deleteParametricShape: (id) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        const index = draft.findIndex((s) => s.id === id);
        if (index !== -1) {
          draft.splice(index, 1);
        }
      });
    }),

  deleteParametricShapes: (ids) =>
    set((state) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      withParametricHistory(state, (draft) => {
        for (let i = draft.length - 1; i >= 0; i--) {
          if (idSet.has(draft[i].id)) {
            draft.splice(i, 1);
          }
        }
      });
    }),

  // ============================================================================
  // Profile-Specific Actions
  // ============================================================================

  insertProfile: (profileType, position, layerId, drawingId, options) => {
    const shape = createProfileShape(profileType, position, layerId, drawingId, options);
    set((state) => {
      withParametricHistory(state, (draft) => {
        draft.push(shape);
      });
    });
    return shape.id;
  },

  updateProfileParameters: (id, parameters) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        const index = draft.findIndex((s) => s.id === id);
        if (index !== -1 && draft[index].parametricType === 'profile') {
          const updated = updateParametricParameters(draft[index], parameters);
          draft[index] = updated;
        }
      });
    }),

  updateProfilePosition: (id, position) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        const index = draft.findIndex((s) => s.id === id);
        if (index !== -1) {
          const updated = updateParametricPosition(draft[index], position);
          draft[index] = updated;
        }
      });
    }),

  updateProfileRotation: (id, rotation) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        const index = draft.findIndex((s) => s.id === id);
        if (index !== -1) {
          const updated = updateParametricRotation(draft[index], rotation);
          draft[index] = updated;
        }
      });
    }),

  updateProfileScale: (id, scale) =>
    set((state) => {
      withParametricHistory(state, (draft) => {
        const index = draft.findIndex((s) => s.id === id);
        if (index !== -1) {
          const updated = updateParametricScale(draft[index], scale);
          draft[index] = updated;
        }
      });
    }),

  // ============================================================================
  // Explode & Clone
  // ============================================================================

  explodeParametricShapes: (ids) => {
    const state = get();
    const allExploded: Shape[] = [];

    for (const id of ids) {
      const shape = state.parametricShapes.find((s) => s.id === id);
      if (shape) {
        const exploded = explodeParametricShape(shape);
        allExploded.push(...exploded);
      }
    }

    // Delete the parametric shapes and return the exploded geometry
    // The caller should add the exploded shapes to the regular shapes array
    if (ids.length > 0) {
      set((state) => {
        const idSet = new Set(ids);
        withParametricHistory(state, (draft) => {
          for (let i = draft.length - 1; i >= 0; i--) {
            if (idSet.has(draft[i].id)) {
              draft.splice(i, 1);
            }
          }
        });
      });
    }

    return allExploded;
  },

  cloneParametricShapes: (ids, offset) => {
    const state = get();
    const cloned: ParametricShape[] = [];

    for (const id of ids) {
      const shape = state.parametricShapes.find((s) => s.id === id);
      if (shape) {
        const clone = cloneParametricShape(shape, offset);
        cloned.push(clone);
      }
    }

    if (cloned.length > 0) {
      set((state) => {
        withParametricHistory(state, (draft) => {
          for (const shape of cloned) {
            draft.push(shape);
          }
        });
      });
    }

    return cloned;
  },

  // ============================================================================
  // Selection Helpers
  // ============================================================================

  getParametricShapesForDrawing: (drawingId) => {
    const state = get();
    return state.parametricShapes.filter((s) => s.drawingId === drawingId);
  },

  getParametricShapeById: (id) => {
    const state = get();
    return state.parametricShapes.find((s) => s.id === id);
  },

  // ============================================================================
  // Section Dialog
  // ============================================================================

  openSectionDialog: () =>
    set((state) => {
      state.sectionDialogOpen = true;
    }),

  closeSectionDialog: () =>
    set((state) => {
      state.sectionDialogOpen = false;
    }),

  setPendingSection: (pending) =>
    set((state) => {
      state.pendingSection = pending;
    }),

  clearPendingSection: () =>
    set((state) => {
      state.pendingSection = null;
    }),

  setSectionPlacementPreview: (position) =>
    set((state) => {
      state.sectionPlacementPreview = position;
    }),

  // ============================================================================
  // Beam Dialog
  // ============================================================================

  openBeamDialog: (initialViewMode) =>
    set((state) => {
      state.beamDialogOpen = true;
      state.beamDialogInitialViewMode = initialViewMode;
    }),

  closeBeamDialog: () =>
    set((state) => {
      state.beamDialogOpen = false;
    }),

  setPendingBeam: (pending) =>
    set((state) => {
      state.pendingBeam = pending;
    }),

  clearPendingBeam: () =>
    set((state) => {
      state.pendingBeam = null;
    }),

  // ============================================================================
  // Gridline Dialog
  // ============================================================================

  openGridlineDialog: () =>
    set((state) => {
      state.gridlineDialogOpen = true;
    }),

  closeGridlineDialog: () =>
    set((state) => {
      state.gridlineDialogOpen = false;
    }),

  setPendingGridline: (pending) =>
    set((state) => {
      state.pendingGridline = pending;
    }),

  clearPendingGridline: () =>
    set((state) => {
      state.pendingGridline = null;
    }),

  // ============================================================================
  // Level
  // ============================================================================

  setPendingLevel: (pending) =>
    set((state) => {
      state.pendingLevel = pending;
    }),

  clearPendingLevel: () =>
    set((state) => {
      state.pendingLevel = null;
    }),

  // ============================================================================
  // Pile Dialog
  // ============================================================================

  openPileDialog: () =>
    set((state) => {
      state.pileDialogOpen = true;
    }),

  closePileDialog: () =>
    set((state) => {
      state.pileDialogOpen = false;
    }),

  setPendingPile: (pending) =>
    set((state) => {
      state.pendingPile = pending;
    }),

  clearPendingPile: () =>
    set((state) => {
      state.pendingPile = null;
    }),

  // ============================================================================
  // CPT Dialog
  // ============================================================================

  openCPTDialog: () =>
    set((state) => {
      state.cptDialogOpen = true;
    }),

  closeCPTDialog: () =>
    set((state) => {
      state.cptDialogOpen = false;
    }),

  setPendingCPT: (pending) =>
    set((state) => {
      state.pendingCPT = pending;
    }),

  clearPendingCPT: () =>
    set((state) => {
      state.pendingCPT = null;
    }),

  // ============================================================================
  // Pile Plan Settings
  // ============================================================================

  setPilePlanSettings: (settings) =>
    set((state) => {
      Object.assign(state.pilePlanSettings, settings);
    }),

  // ============================================================================
  // Wall Dialog
  // ============================================================================

  openWallDialog: () =>
    set((state) => {
      state.wallDialogOpen = true;
    }),

  closeWallDialog: () =>
    set((state) => {
      state.wallDialogOpen = false;
    }),

  setPendingWall: (pending) =>
    set((state) => {
      state.pendingWall = pending;
    }),

  clearPendingWall: () =>
    set((state) => {
      state.pendingWall = null;
    }),

  // ============================================================================
  // Slab
  // ============================================================================

  setPendingSlab: (pending) =>
    set((state) => {
      state.pendingSlab = pending;
    }),

  clearPendingSlab: () =>
    set((state) => {
      state.pendingSlab = null;
    }),

  // ============================================================================
  // Section Callout
  // ============================================================================

  setPendingSectionCallout: (pending) =>
    set((state) => {
      state.pendingSectionCallout = pending;
    }),

  clearPendingSectionCallout: () =>
    set((state) => {
      state.pendingSectionCallout = null;
    }),

  // ============================================================================
  // Space (IfcSpace)
  // ============================================================================

  setPendingSpace: (pending) =>
    set((state) => {
      state.pendingSpace = pending;
    }),

  clearPendingSpace: () =>
    set((state) => {
      state.pendingSpace = null;
    }),

  // ============================================================================
  // Plate System
  // ============================================================================

  openPlateSystemDialog: () =>
    set((state) => {
      state.plateSystemDialogOpen = true;
    }),

  closePlateSystemDialog: () =>
    set((state) => {
      state.plateSystemDialogOpen = false;
    }),

  setPendingPlateSystem: (pending) =>
    set((state) => {
      state.pendingPlateSystem = pending;
    }),

  clearPendingPlateSystem: () =>
    set((state) => {
      state.pendingPlateSystem = null;
    }),

  // ============================================================================
  // Wall Types
  // ============================================================================

  addWallType: (wallType) =>
    set((state) => {
      state.wallTypes.push(wallType);
    }),

  updateWallType: (id, updates) => {
    set((state) => {
      const index = state.wallTypes.findIndex(w => w.id === id);
      if (index !== -1) {
        Object.assign(state.wallTypes[index], updates);
      }
    });

    // Propagate thickness changes to all wall shapes that reference this type.
    // Note: Hatch settings are no longer propagated to individual wall shapes because
    // the renderer now resolves hatching from the wall type at render time.
    if (updates.thickness !== undefined) {
      const store = get();
      const updatedType = store.wallTypes.find(w => w.id === id);
      if (!updatedType) return;

      const wallShapeUpdates: { id: string; updates: Partial<Shape> }[] = [];
      for (const shape of store.shapes) {
        if (shape.type === 'wall' && (shape as WallShape).wallTypeId === id) {
          wallShapeUpdates.push({
            id: shape.id,
            updates: {
              thickness: updatedType.thickness,
            } as Partial<WallShape>,
          });
        }
      }
      if (wallShapeUpdates.length > 0) {
        store.updateShapes(wallShapeUpdates);
      }
    }
  },

  deleteWallType: (id) =>
    set((state) => {
      state.wallTypes = state.wallTypes.filter(w => w.id !== id);
      // Clear last-used if the deleted type was the last-used one
      if (state.lastUsedWallTypeId === id) {
        state.lastUsedWallTypeId = null;
      }
    }),

  setWallTypes: (wallTypes) =>
    set((state) => {
      state.wallTypes = wallTypes;
    }),

  setLastUsedWallTypeId: (id) =>
    set((state) => {
      state.lastUsedWallTypeId = id;
    }),

  // ============================================================================
  // Slab Types
  // ============================================================================

  addSlabType: (slabType) =>
    set((state) => {
      state.slabTypes.push(slabType);
    }),

  updateSlabType: (id, updates) =>
    set((state) => {
      const index = state.slabTypes.findIndex(s => s.id === id);
      if (index !== -1) {
        Object.assign(state.slabTypes[index], updates);
      }
    }),

  deleteSlabType: (id) =>
    set((state) => {
      state.slabTypes = state.slabTypes.filter(s => s.id !== id);
    }),

  // ============================================================================
  // Column Types
  // ============================================================================

  addColumnType: (columnType) =>
    set((state) => {
      state.columnTypes.push(columnType);
    }),

  updateColumnType: (id, updates) =>
    set((state) => {
      const index = state.columnTypes.findIndex(c => c.id === id);
      if (index !== -1) {
        Object.assign(state.columnTypes[index], updates);
      }
    }),

  deleteColumnType: (id) =>
    set((state) => {
      state.columnTypes = state.columnTypes.filter(c => c.id !== id);
    }),

  // ============================================================================
  // Beam Types
  // ============================================================================

  addBeamType: (beamType) =>
    set((state) => {
      state.beamTypes.push(beamType);
    }),

  updateBeamType: (id, updates) =>
    set((state) => {
      const index = state.beamTypes.findIndex(b => b.id === id);
      if (index !== -1) {
        Object.assign(state.beamTypes[index], updates);
      }
    }),

  deleteBeamType: (id) =>
    set((state) => {
      state.beamTypes = state.beamTypes.filter(b => b.id !== id);
    }),

  // ============================================================================
  // Drawing Standards Dialog
  // ============================================================================

  openDrawingStandardsDialog: () =>
    set((state) => {
      state.drawingStandardsDialogOpen = true;
    }),

  closeDrawingStandardsDialog: () =>
    set((state) => {
      state.drawingStandardsDialogOpen = false;
    }),

  setGridlineExtension: (value) =>
    set((state) => {
      state.gridlineExtension = value;
      // Auto-save to active preset
      const preset = state.drawingStandardsPresets.find(p => p.id === state.activeDrawingStandardsId);
      if (preset) {
        preset.gridlineExtension = value;
      }
    }),

  setGridDimensionLineOffset: (value) =>
    set((state) => {
      state.gridDimensionLineOffset = value;
      // Auto-save to active preset
      const preset = state.drawingStandardsPresets.find(p => p.id === state.activeDrawingStandardsId);
      if (preset) {
        preset.gridDimensionLineOffset = value;
      }
    }),

  setAutoGridDimension: (value) =>
    set((state) => {
      state.autoGridDimension = value;
    }),

  setSectionGridlineDimensioning: (value) =>
    set((state) => {
      state.sectionGridlineDimensioning = value;
      // Auto-save to active preset
      const preset = state.drawingStandardsPresets.find(p => p.id === state.activeDrawingStandardsId);
      if (preset) {
        preset.sectionGridlineDimensioning = value;
      }
    }),

  // ============================================================================
  // Materials Dialog
  // ============================================================================

  openMaterialsDialog: () =>
    set((state) => {
      state.materialsDialogOpen = true;
    }),

  closeMaterialsDialog: () =>
    set((state) => {
      state.materialsDialogOpen = false;
    }),

  // ============================================================================
  // Wall Types Dialog
  // ============================================================================

  openWallTypesDialog: () =>
    set((state) => {
      state.wallTypesDialogOpen = true;
    }),

  closeWallTypesDialog: () =>
    set((state) => {
      state.wallTypesDialogOpen = false;
    }),

  // ============================================================================
  // Material Hatch Settings (Drawing Standards)
  // ============================================================================

  updateMaterialHatchSetting: (material, setting) =>
    set((state) => {
      const existing = state.materialHatchSettings[material] || DEFAULT_MATERIAL_HATCH_SETTINGS[material] || DEFAULT_MATERIAL_HATCH_SETTINGS.generic;
      state.materialHatchSettings = {
        ...state.materialHatchSettings,
        [material]: { ...existing, ...setting },
      };
      // Auto-save to active preset
      const preset = state.drawingStandardsPresets.find(p => p.id === state.activeDrawingStandardsId);
      if (preset) {
        preset.materialHatchSettings = { ...state.materialHatchSettings };
      }
    }),

  setMaterialHatchSettings: (settings) =>
    set((state) => {
      state.materialHatchSettings = settings;
      // Auto-save to active preset
      const preset = state.drawingStandardsPresets.find(p => p.id === state.activeDrawingStandardsId);
      if (preset) {
        preset.materialHatchSettings = { ...settings };
      }
    }),

  // ============================================================================
  // Drawing Standards Presets
  // ============================================================================

  saveDrawingStandards: (name) => {
    const id = crypto.randomUUID();
    set((state) => {
      state.drawingStandardsPresets.push({
        id,
        name,
        isDefault: false,
        gridlineExtension: state.gridlineExtension,
        gridDimensionLineOffset: state.gridDimensionLineOffset,
        materialHatchSettings: { ...state.materialHatchSettings },
        sectionGridlineDimensioning: state.sectionGridlineDimensioning,
      });
      state.activeDrawingStandardsId = id;
    });
    return id;
  },

  loadDrawingStandards: (id) =>
    set((state) => {
      const preset = state.drawingStandardsPresets.find(p => p.id === id);
      if (!preset) return;
      state.activeDrawingStandardsId = id;
      state.gridlineExtension = preset.gridlineExtension;
      state.gridDimensionLineOffset = preset.gridDimensionLineOffset ?? 300;
      state.materialHatchSettings = { ...preset.materialHatchSettings };
      state.sectionGridlineDimensioning = preset.sectionGridlineDimensioning ?? true;
    }),

  deleteDrawingStandards: (id) =>
    set((state) => {
      const preset = state.drawingStandardsPresets.find(p => p.id === id);
      if (!preset || preset.isDefault) return;
      state.drawingStandardsPresets = state.drawingStandardsPresets.filter(p => p.id !== id);
      // If deleting the active preset, switch to the default
      if (state.activeDrawingStandardsId === id) {
        const defaultPreset = state.drawingStandardsPresets.find(p => p.isDefault);
        if (defaultPreset) {
          state.activeDrawingStandardsId = defaultPreset.id;
          state.gridlineExtension = defaultPreset.gridlineExtension;
          state.gridDimensionLineOffset = defaultPreset.gridDimensionLineOffset ?? 300;
          state.materialHatchSettings = { ...defaultPreset.materialHatchSettings };
          state.sectionGridlineDimensioning = defaultPreset.sectionGridlineDimensioning ?? true;
        }
      }
    }),

  renameDrawingStandards: (id, name) =>
    set((state) => {
      const preset = state.drawingStandardsPresets.find(p => p.id === id);
      if (preset) {
        preset.name = name;
      }
    }),

  // ============================================================================
  // Project Structure Dialog
  // ============================================================================

  openProjectStructureDialog: () =>
    set((state) => {
      state.projectStructureDialogOpen = true;
    }),

  closeProjectStructureDialog: () =>
    set((state) => {
      state.projectStructureDialogOpen = false;
    }),

  // ============================================================================
  // Project Structure Actions
  // ============================================================================

  setProjectStructure: (structure) =>
    set((state) => {
      state.projectStructure = structure;
    }),

  updateSiteName: (name) =>
    set((state) => {
      state.projectStructure.siteName = name;
    }),

  setSeaLevelDatum: (value) =>
    set((state) => {
      state.projectStructure.seaLevelDatum = value;
    }),

  addBuilding: (building) =>
    set((state) => {
      state.projectStructure.buildings.push(building);
    }),

  removeBuilding: (id) =>
    set((state) => {
      // Collect all storey IDs from the building being removed
      const building = state.projectStructure.buildings.find(b => b.id === id);
      if (building) {
        const storeyIds = new Set(building.storeys.map(s => s.id));
        // Clear storeyId from any drawings that referenced storeys in this building
        for (const drawing of state.drawings) {
          if (drawing.storeyId && storeyIds.has(drawing.storeyId)) {
            drawing.storeyId = undefined;
          }
        }
      }
      state.projectStructure.buildings = state.projectStructure.buildings.filter(b => b.id !== id);
    }),

  updateBuilding: (id, updates) =>
    set((state) => {
      const building = state.projectStructure.buildings.find(b => b.id === id);
      if (building) {
        Object.assign(building, updates);
      }
    }),

  addStorey: (buildingId, storey) =>
    set((state) => {
      const building = state.projectStructure.buildings.find(b => b.id === buildingId);
      if (building) {
        building.storeys.push(storey);
      }
    }),

  removeStorey: (buildingId, storeyId) =>
    set((state) => {
      const building = state.projectStructure.buildings.find(b => b.id === buildingId);
      if (building) {
        building.storeys = building.storeys.filter(s => s.id !== storeyId);
      }
      // Clear storeyId from any drawings that referenced this storey
      for (const drawing of state.drawings) {
        if (drawing.storeyId === storeyId) {
          drawing.storeyId = undefined;
        }
      }
    }),

  updateStorey: (buildingId, storeyId, updates) => {
    set((state) => {
      const building = state.projectStructure.buildings.find(b => b.id === buildingId);
      if (building) {
        const storey = building.storeys.find(s => s.id === storeyId);
        if (storey) {
          Object.assign(storey, updates);
        }
      }
    });
    // Sync section references when storey elevation changes
    if (updates.elevation !== undefined || updates.name !== undefined) {
      const store = get();
      store.syncAllSectionReferences?.();
    }
  },
});
