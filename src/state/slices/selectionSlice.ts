/**
 * Selection Slice - Manages shape selection and selection box
 */

import type { SelectionBox, Shape, Layer } from './types';

// ============================================================================
// Types
// ============================================================================

/** Represents a single selected grip (endpoint) on a shape, set by box selection. */
export interface SelectedGrip {
  shapeId: string;
  gripIndex: number;  // 0 = start, 1 = end for line-like shapes
}

// ============================================================================
// State Interface
// ============================================================================

export interface SelectionState {
  selectedShapeIds: string[];
  selectionBox: SelectionBox | null;
  hoveredShapeId: string | null;
  selectionFilter: string | null;  // Active category filter (e.g. 'beam', 'wall'), null = show all
  /** When set, a specific grip point was box-selected (not the whole shape). */
  selectedGrip: SelectedGrip | null;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface SelectionActions {
  selectShape: (id: string, addToSelection?: boolean) => void;
  selectShapes: (ids: string[]) => void;
  deselectAll: () => void;
  selectAll: () => void;
  setSelectionBox: (box: SelectionBox | null) => void;
  setHoveredShapeId: (id: string | null) => void;
  setSelectionFilter: (filter: string | null) => void;
  setSelectedGrip: (grip: SelectedGrip | null) => void;
}

export type SelectionSlice = SelectionState & SelectionActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialSelectionState: SelectionState = {
  selectedShapeIds: [],
  selectionBox: null,
  hoveredShapeId: null,
  selectionFilter: null,
  selectedGrip: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

// Type for the full store that this slice needs access to
interface StoreWithModel {
  shapes: Shape[];
  layers: Layer[];
  activeDrawingId: string;
}

type FullStore = SelectionState & StoreWithModel;

export const createSelectionSlice = (
  set: (fn: (state: FullStore) => void) => void,
  _get: () => FullStore
): SelectionActions => ({
  selectShape: (id, addToSelection = false) =>
    set((state) => {
      if (addToSelection) {
        // Toggle selection: remove if already selected, add if not
        const index = state.selectedShapeIds.indexOf(id);
        if (index >= 0) {
          state.selectedShapeIds.splice(index, 1);
        } else {
          state.selectedShapeIds.push(id);
        }
      } else {
        state.selectedShapeIds = [id];
      }
      // Clear filter and grip selection when selection changes
      state.selectionFilter = null;
      state.selectedGrip = null;
    }),

  selectShapes: (ids) =>
    set((state) => {
      state.selectedShapeIds = ids;
      // Clear filter and grip selection when selection changes
      state.selectionFilter = null;
      state.selectedGrip = null;
    }),

  deselectAll: () =>
    set((state) => {
      state.selectedShapeIds = [];
      state.selectionFilter = null;
      state.selectedGrip = null;
    }),

  selectAll: () =>
    set((state) => {
      // Build layer lookup for O(1) access
      const layerMap = new Map(state.layers.map((l) => [l.id, l]));
      // Only select shapes in the current drawing
      state.selectedShapeIds = state.shapes
        .filter((s) => {
          if (s.drawingId !== state.activeDrawingId) return false;
          const layer = layerMap.get(s.layerId);
          return layer && layer.visible && !layer.locked && s.visible && !s.locked;
        })
        .map((s) => s.id);
      // Clear filter when selection changes
      state.selectionFilter = null;
    }),

  setSelectionBox: (box) =>
    set((state) => {
      state.selectionBox = box;
    }),

  setHoveredShapeId: (id) =>
    set((state) => {
      state.hoveredShapeId = id;
    }),

  setSelectionFilter: (filter) =>
    set((state) => {
      state.selectionFilter = filter;
    }),

  setSelectedGrip: (grip) =>
    set((state) => {
      state.selectedGrip = grip;
    }),
});
