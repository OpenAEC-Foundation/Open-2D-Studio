/**
 * Boundary Slice - Manages drawing boundary editing state
 * (crop region manipulation)
 */

import type { BoundaryEditState, BoundaryHandleType, Point, Drawing, DrawingBoundary } from './types';

// ============================================================================
// State Interface
// ============================================================================

export interface BoundaryState {
  boundaryEditState: BoundaryEditState;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface BoundaryActions {
  selectBoundary: () => void;
  deselectBoundary: () => void;
  startBoundaryDrag: (handle: BoundaryHandleType, worldPos: Point) => void;
  updateBoundaryDrag: (worldPos: Point) => void;
  endBoundaryDrag: () => void;
  cancelBoundaryDrag: () => void;
}

export type BoundarySlice = BoundaryState & BoundaryActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialBoundaryState: BoundaryState = {
  boundaryEditState: {
    isEditing: false,
    isSelected: false,
    activeHandle: null,
    dragStart: null,
    originalBoundary: null,
  },
};

// ============================================================================
// Slice Creator
// ============================================================================

// Type for the full store that this slice needs access to
interface FullStore extends BoundaryState {
  drawings: Drawing[];
  activeDrawingId: string;
  selectedShapeIds: string[];
  isModified: boolean;
  sheets: { id: string; viewports: { id: string; drawingId: string; scale: number; width: number; height: number; centerX: number; centerY: number }[] }[];
}

export const createBoundarySlice = (
  set: (fn: (state: FullStore) => void) => void,
  _get: () => FullStore
): BoundaryActions => ({
  selectBoundary: () =>
    set((state) => {
      state.boundaryEditState.isSelected = true;
      state.selectedShapeIds = []; // Deselect shapes when selecting boundary
    }),

  deselectBoundary: () =>
    set((state) => {
      state.boundaryEditState.isSelected = false;
      state.boundaryEditState.activeHandle = null;
      state.boundaryEditState.dragStart = null;
      state.boundaryEditState.originalBoundary = null;
    }),

  startBoundaryDrag: (handle, worldPos) =>
    set((state) => {
      const draft = state.drawings.find((d) => d.id === state.activeDrawingId);
      if (!draft) return;

      state.boundaryEditState.activeHandle = handle;
      state.boundaryEditState.dragStart = worldPos;
      state.boundaryEditState.originalBoundary = { ...draft.boundary };
    }),

  updateBoundaryDrag: (worldPos) =>
    set((state) => {
      const { activeHandle, dragStart, originalBoundary } = state.boundaryEditState;
      if (!activeHandle || !dragStart || !originalBoundary) return;

      const draft = state.drawings.find((d) => d.id === state.activeDrawingId);
      if (!draft) return;

      const dx = worldPos.x - dragStart.x;
      const dy = worldPos.y - dragStart.y;

      // Calculate new boundary based on which handle is being dragged
      let newBoundary: DrawingBoundary = { ...originalBoundary };

      switch (activeHandle) {
        case 'center':
          // Move entire boundary
          newBoundary.x = originalBoundary.x + dx;
          newBoundary.y = originalBoundary.y + dy;
          break;

        case 'top-left':
          newBoundary.x = originalBoundary.x + dx;
          newBoundary.y = originalBoundary.y + dy;
          newBoundary.width = Math.max(10, originalBoundary.width - dx);
          newBoundary.height = Math.max(10, originalBoundary.height - dy);
          break;

        case 'top':
          newBoundary.y = originalBoundary.y + dy;
          newBoundary.height = Math.max(10, originalBoundary.height - dy);
          break;

        case 'top-right':
          newBoundary.y = originalBoundary.y + dy;
          newBoundary.width = Math.max(10, originalBoundary.width + dx);
          newBoundary.height = Math.max(10, originalBoundary.height - dy);
          break;

        case 'left':
          newBoundary.x = originalBoundary.x + dx;
          newBoundary.width = Math.max(10, originalBoundary.width - dx);
          break;

        case 'right':
          newBoundary.width = Math.max(10, originalBoundary.width + dx);
          break;

        case 'bottom-left':
          newBoundary.x = originalBoundary.x + dx;
          newBoundary.width = Math.max(10, originalBoundary.width - dx);
          newBoundary.height = Math.max(10, originalBoundary.height + dy);
          break;

        case 'bottom':
          newBoundary.height = Math.max(10, originalBoundary.height + dy);
          break;

        case 'bottom-right':
          newBoundary.width = Math.max(10, originalBoundary.width + dx);
          newBoundary.height = Math.max(10, originalBoundary.height + dy);
          break;
      }

      draft.boundary = newBoundary;
    }),

  endBoundaryDrag: () =>
    set((state) => {
      if (state.boundaryEditState.activeHandle) {
        const draft = state.drawings.find((d) => d.id === state.activeDrawingId);
        if (draft) {
          draft.modifiedAt = new Date().toISOString();
          state.isModified = true;

          // Update all viewports showing this drawing (Revit-style: viewport resizes with boundary)
          for (const sheet of state.sheets) {
            for (const viewport of sheet.viewports) {
              if (viewport.drawingId === state.activeDrawingId) {
                // Calculate new viewport size from updated boundary × viewport scale
                const newWidth = draft.boundary.width * viewport.scale;
                const newHeight = draft.boundary.height * viewport.scale;

                // Update viewport dimensions
                viewport.width = newWidth;
                viewport.height = newHeight;

                // Update center to match new boundary center
                viewport.centerX = draft.boundary.x + draft.boundary.width / 2;
                viewport.centerY = draft.boundary.y + draft.boundary.height / 2;
              }
            }
          }
        }
      }
      state.boundaryEditState.activeHandle = null;
      state.boundaryEditState.dragStart = null;
      state.boundaryEditState.originalBoundary = null;
    }),

  cancelBoundaryDrag: () =>
    set((state) => {
      const { originalBoundary } = state.boundaryEditState;
      if (originalBoundary) {
        const draft = state.drawings.find((d) => d.id === state.activeDrawingId);
        if (draft) {
          draft.boundary = originalBoundary;
        }
      }
      state.boundaryEditState.activeHandle = null;
      state.boundaryEditState.dragStart = null;
      state.boundaryEditState.originalBoundary = null;
    }),
});
