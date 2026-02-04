/**
 * History Service - Business logic for undo/redo operations
 *
 * Provides functions for:
 * - Creating state snapshots
 * - Managing undo/redo stack
 * - State comparison and diffing
 */

import type { Shape, Draft, Sheet, Layer } from '../../types/geometry';

/**
 * State snapshot for history
 */
export interface HistorySnapshot {
  id: string;
  timestamp: number;
  description: string;
  shapes: Shape[];
  drafts: Draft[];
  sheets: Sheet[];
  layers: Layer[];
}

/**
 * History stack configuration
 */
export interface HistoryConfig {
  maxUndoLevels: number;
}

/**
 * Default history configuration
 */
export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  maxUndoLevels: 50,
};

/**
 * History state
 */
export interface HistoryState {
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  config: HistoryConfig;
}

/**
 * Create initial history state
 */
export function createHistoryState(config: Partial<HistoryConfig> = {}): HistoryState {
  return {
    undoStack: [],
    redoStack: [],
    config: { ...DEFAULT_HISTORY_CONFIG, ...config },
  };
}

/**
 * Generate snapshot ID
 */
function generateSnapshotId(): string {
  return `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a state snapshot
 */
export function createSnapshot(
  shapes: Shape[],
  drafts: Draft[],
  sheets: Sheet[],
  layers: Layer[],
  description: string
): HistorySnapshot {
  return {
    id: generateSnapshotId(),
    timestamp: Date.now(),
    description,
    // Deep clone to prevent reference issues
    shapes: JSON.parse(JSON.stringify(shapes)),
    drafts: JSON.parse(JSON.stringify(drafts)),
    sheets: JSON.parse(JSON.stringify(sheets)),
    layers: JSON.parse(JSON.stringify(layers)),
  };
}

/**
 * Push a snapshot to the undo stack
 */
export function pushSnapshot(
  history: HistoryState,
  snapshot: HistorySnapshot
): HistoryState {
  const newUndoStack = [...history.undoStack, snapshot];

  // Limit undo stack size
  while (newUndoStack.length > history.config.maxUndoLevels) {
    newUndoStack.shift();
  }

  return {
    ...history,
    undoStack: newUndoStack,
    redoStack: [], // Clear redo stack when new action is performed
  };
}

/**
 * Check if undo is available
 */
export function canUndo(history: HistoryState): boolean {
  return history.undoStack.length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo(history: HistoryState): boolean {
  return history.redoStack.length > 0;
}

/**
 * Get the most recent snapshot (for undo)
 */
export function getUndoSnapshot(history: HistoryState): HistorySnapshot | null {
  if (history.undoStack.length === 0) return null;
  return history.undoStack[history.undoStack.length - 1];
}

/**
 * Get the most recent redo snapshot
 */
export function getRedoSnapshot(history: HistoryState): HistorySnapshot | null {
  if (history.redoStack.length === 0) return null;
  return history.redoStack[history.redoStack.length - 1];
}

/**
 * Perform undo operation
 * Returns the new history state and the snapshot to restore
 */
export function performUndo(
  history: HistoryState,
  currentState: { shapes: Shape[]; drafts: Draft[]; sheets: Sheet[]; layers: Layer[] }
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  if (!canUndo(history)) return null;

  const undoSnapshot = history.undoStack[history.undoStack.length - 1];

  // Create snapshot of current state for redo
  const redoSnapshot = createSnapshot(
    currentState.shapes,
    currentState.drafts,
    currentState.sheets,
    currentState.layers,
    'Redo: ' + undoSnapshot.description
  );

  return {
    history: {
      ...history,
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, redoSnapshot],
    },
    snapshot: undoSnapshot,
  };
}

/**
 * Perform redo operation
 * Returns the new history state and the snapshot to restore
 */
export function performRedo(
  history: HistoryState,
  currentState: { shapes: Shape[]; drafts: Draft[]; sheets: Sheet[]; layers: Layer[] }
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  if (!canRedo(history)) return null;

  const redoSnapshot = history.redoStack[history.redoStack.length - 1];

  // Create snapshot of current state for undo
  const undoSnapshot = createSnapshot(
    currentState.shapes,
    currentState.drafts,
    currentState.sheets,
    currentState.layers,
    redoSnapshot.description.replace('Redo: ', '')
  );

  return {
    history: {
      ...history,
      undoStack: [...history.undoStack, undoSnapshot],
      redoStack: history.redoStack.slice(0, -1),
    },
    snapshot: redoSnapshot,
  };
}

/**
 * Clear all history
 */
export function clearHistory(history: HistoryState): HistoryState {
  return {
    ...history,
    undoStack: [],
    redoStack: [],
  };
}

/**
 * Get undo stack descriptions (for display in UI)
 */
export function getUndoDescriptions(history: HistoryState): string[] {
  return history.undoStack.map(s => s.description).reverse();
}

/**
 * Get redo stack descriptions (for display in UI)
 */
export function getRedoDescriptions(history: HistoryState): string[] {
  return history.redoStack.map(s => s.description).reverse();
}

/**
 * Get history statistics
 */
export function getHistoryStats(history: HistoryState): {
  undoLevels: number;
  redoLevels: number;
  maxLevels: number;
  oldestUndo: number | null;
  newestUndo: number | null;
} {
  return {
    undoLevels: history.undoStack.length,
    redoLevels: history.redoStack.length,
    maxLevels: history.config.maxUndoLevels,
    oldestUndo: history.undoStack.length > 0 ? history.undoStack[0].timestamp : null,
    newestUndo: history.undoStack.length > 0 ? history.undoStack[history.undoStack.length - 1].timestamp : null,
  };
}

/**
 * Undo to a specific snapshot by ID
 */
export function undoToSnapshot(
  history: HistoryState,
  snapshotId: string,
  currentState: { shapes: Shape[]; drafts: Draft[]; sheets: Sheet[]; layers: Layer[] }
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  const index = history.undoStack.findIndex(s => s.id === snapshotId);
  if (index === -1) return null;

  const targetSnapshot = history.undoStack[index];

  // Move all snapshots after the target to redo stack
  const snapshotsToRedo = history.undoStack.slice(index + 1);

  // Create snapshot of current state for redo
  const currentSnapshot = createSnapshot(
    currentState.shapes,
    currentState.drafts,
    currentState.sheets,
    currentState.layers,
    'Current state'
  );

  return {
    history: {
      ...history,
      undoStack: history.undoStack.slice(0, index),
      redoStack: [...history.redoStack, currentSnapshot, ...snapshotsToRedo.reverse()],
    },
    snapshot: targetSnapshot,
  };
}

/**
 * Check if state has changed from last snapshot
 */
export function hasChangedSinceLastSnapshot(
  history: HistoryState,
  currentShapes: Shape[]
): boolean {
  if (history.undoStack.length === 0) return currentShapes.length > 0;

  const lastSnapshot = history.undoStack[history.undoStack.length - 1];

  // Simple comparison - could be made more sophisticated
  if (currentShapes.length !== lastSnapshot.shapes.length) return true;

  // Compare shape IDs and basic properties
  const currentIds = new Set(currentShapes.map(s => s.id));
  const snapshotIds = new Set(lastSnapshot.shapes.map(s => s.id));

  if (currentIds.size !== snapshotIds.size) return true;

  for (const id of currentIds) {
    if (!snapshotIds.has(id)) return true;
  }

  return false;
}

/**
 * Batch multiple operations into a single undo step
 */
export function beginBatch(history: HistoryState): HistoryState {
  // Mark that we're in a batch operation
  return {
    ...history,
    // Could add a batching flag if needed
  };
}

/**
 * End batch and create single snapshot for all changes
 */
export function endBatch(
  history: HistoryState,
  currentState: { shapes: Shape[]; drafts: Draft[]; sheets: Sheet[]; layers: Layer[] },
  description: string
): HistoryState {
  const snapshot = createSnapshot(
    currentState.shapes,
    currentState.drafts,
    currentState.sheets,
    currentState.layers,
    description
  );
  return pushSnapshot(history, snapshot);
}
