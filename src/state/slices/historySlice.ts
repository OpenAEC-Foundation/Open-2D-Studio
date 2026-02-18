/**
 * History Slice - Manages undo/redo functionality using Immer patches
 *
 * Each history entry specifies a `target` indicating which array the patches
 * apply to: 'shapes' (regular geometry) or 'parametricShapes'.
 */

import { type Patch, applyPatches, current } from 'immer';
import type { Shape } from './types';
import type { ParametricShape } from '../../types/parametric';

// ============================================================================
// Types
// ============================================================================

export type HistoryTarget = 'shapes' | 'parametricShapes';

export interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
  /** Which array the patches apply to. Defaults to 'shapes' for backward compat. */
  target?: HistoryTarget;
}

// ============================================================================
// State Interface
// ============================================================================

export interface HistoryState {
  historyStack: HistoryEntry[];
  historyIndex: number;     // Points to last applied entry (-1 means none)
  maxHistorySize: number;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface HistoryActions {
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  collapseEntries: (fromIndex: number) => void;
}

export type HistorySlice = HistoryState & HistoryActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialHistoryState: HistoryState = {
  historyStack: [],
  historyIndex: -1,
  maxHistorySize: 50,
};

// ============================================================================
// Slice Creator
// ============================================================================

interface StoreWithShapes {
  shapes: Shape[];
  parametricShapes: ParametricShape[];
  selectedShapeIds: string[];
}

type FullStore = HistoryState & StoreWithShapes;

export const createHistorySlice = (
  set: (fn: (state: FullStore) => void) => void,
  get: () => FullStore
): HistoryActions => ({
  undo: () => {
    let success = false;

    set((state) => {
      if (state.historyIndex < 0) return;

      const entry = state.historyStack[state.historyIndex];
      if (!entry) return;

      const target = entry.target || 'shapes';
      if (target === 'parametricShapes') {
        state.parametricShapes = applyPatches(
          current(state.parametricShapes),
          entry.inversePatches
        ) as any;
      } else {
        state.shapes = applyPatches(
          current(state.shapes),
          entry.inversePatches
        ) as any;
      }
      state.historyIndex--;
      state.selectedShapeIds = [];
      success = true;
    });

    return success;
  },

  redo: () => {
    let success = false;

    set((state) => {
      const nextIndex = state.historyIndex + 1;
      if (nextIndex >= state.historyStack.length) return;

      const entry = state.historyStack[nextIndex];
      if (!entry) return;

      const target = entry.target || 'shapes';
      if (target === 'parametricShapes') {
        state.parametricShapes = applyPatches(
          current(state.parametricShapes),
          entry.patches
        ) as any;
      } else {
        state.shapes = applyPatches(
          current(state.shapes),
          entry.patches
        ) as any;
      }
      state.historyIndex = nextIndex;
      state.selectedShapeIds = [];
      success = true;
    });

    return success;
  },

  canUndo: () => {
    const state = get();
    return state.historyIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.historyStack.length - 1;
  },

  collapseEntries: (fromIndex: number) =>
    set((state) => {
      if (fromIndex > state.historyIndex || fromIndex < 0) return;
      if (fromIndex === state.historyIndex) return; // Only one entry, nothing to collapse

      // Only collapse entries that share the same target
      const baseTarget = state.historyStack[fromIndex].target || 'shapes';
      const allSameTarget = state.historyStack
        .slice(fromIndex, state.historyIndex + 1)
        .every(e => (e.target || 'shapes') === baseTarget);

      if (!allSameTarget) return; // Cannot collapse mixed-target entries

      // Merge entries [fromIndex..historyIndex] into one
      const mergedPatches: Patch[] = [];
      const mergedInversePatches: Patch[] = [];

      for (let i = fromIndex; i <= state.historyIndex; i++) {
        mergedPatches.push(...state.historyStack[i].patches);
        // Inverse patches need to be in reverse order for correct undo
        mergedInversePatches.unshift(...state.historyStack[i].inversePatches);
      }

      const collapsed: HistoryEntry = {
        patches: mergedPatches,
        inversePatches: mergedInversePatches,
        target: baseTarget,
      };

      // Replace the range with the single collapsed entry
      state.historyStack.splice(fromIndex, state.historyIndex - fromIndex + 1, collapsed);
      state.historyIndex = fromIndex;
    }),
});
