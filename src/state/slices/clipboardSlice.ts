/**
 * Clipboard Slice - Manages copy, cut, paste operations
 */

import type { Shape, Point } from './types';
import { cloneShapes, generateId } from './types';

// ============================================================================
// State Interface
// ============================================================================

export interface ClipboardState {
  /** Shapes in the clipboard (deep cloned) */
  clipboardShapes: Shape[];
  /** Whether the shapes were cut (should be deleted on paste) */
  clipboardCutMode: boolean;
  /** Original center point of copied shapes (for relative paste) */
  clipboardOrigin: Point | null;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface ClipboardActions {
  /** Copy selected shapes to clipboard */
  copySelectedShapes: () => void;
  /** Cut selected shapes to clipboard */
  cutSelectedShapes: () => void;
  /** Paste shapes from clipboard at mouse position */
  pasteShapes: (mousePosition?: Point) => void;
  /** Check if clipboard has content */
  hasClipboardContent: () => boolean;
  /** Clear clipboard */
  clearClipboard: () => void;
}

export type ClipboardSlice = ClipboardState & ClipboardActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialClipboardState: ClipboardState = {
  clipboardShapes: [],
  clipboardCutMode: false,
  clipboardOrigin: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

interface StoreWithModel {
  shapes: Shape[];
  selectedShapeIds: string[];
  activeDrawingId: string;
  activeLayerId: string;
  mousePosition: Point;
  isModified: boolean;
}

interface StoreWithHistory {
  historyStack: any[];
  historyIndex: number;
  maxHistorySize: number;
}

type FullStore = ClipboardState & StoreWithModel & StoreWithHistory;

export const createClipboardSlice = (
  set: (fn: (state: FullStore) => void) => void,
  get: () => FullStore
): ClipboardActions => ({
  copySelectedShapes: () => {
    const state = get();
    if (state.selectedShapeIds.length === 0) return;

    // Get selected shapes
    const selectedShapes = state.shapes.filter(s =>
      state.selectedShapeIds.includes(s.id)
    );

    if (selectedShapes.length === 0) return;

    // Calculate center point of selected shapes
    const origin = calculateShapesCenter(selectedShapes);

    // Clone shapes for clipboard
    const cloned = cloneShapes(selectedShapes);

    set((s) => {
      s.clipboardShapes = cloned;
      s.clipboardCutMode = false;
      s.clipboardOrigin = origin;
    });
  },

  cutSelectedShapes: () => {
    const state = get();
    if (state.selectedShapeIds.length === 0) return;

    // Get selected shapes
    const selectedShapes = state.shapes.filter(s =>
      state.selectedShapeIds.includes(s.id)
    );

    if (selectedShapes.length === 0) return;

    // Calculate center point of selected shapes
    const origin = calculateShapesCenter(selectedShapes);

    // Clone shapes for clipboard
    const cloned = cloneShapes(selectedShapes);

    set((s) => {
      s.clipboardShapes = cloned;
      s.clipboardCutMode = true;
      s.clipboardOrigin = origin;

      // Remove cut shapes from the model
      const cutIds = new Set(state.selectedShapeIds);
      for (let i = s.shapes.length - 1; i >= 0; i--) {
        if (cutIds.has(s.shapes[i].id)) {
          s.shapes.splice(i, 1);
        }
      }
      s.selectedShapeIds = [];
      s.isModified = true;
    });
  },

  pasteShapes: (mousePosition?: Point) => {
    const state = get();
    if (state.clipboardShapes.length === 0) return;

    // Use provided position or mouse position
    const pastePosition = mousePosition || state.mousePosition;

    // Calculate offset from original position
    const offset: Point = state.clipboardOrigin
      ? {
          x: pastePosition.x - state.clipboardOrigin.x,
          y: pastePosition.y - state.clipboardOrigin.y,
        }
      : { x: 20, y: 20 }; // Default offset if no origin

    // Clone and offset shapes
    const newShapes = cloneShapes(state.clipboardShapes).map(shape => {
      // Generate new ID
      const newId = generateId();

      // Offset shape position
      const offsetShape = offsetShapePosition(shape, offset);

      return {
        ...offsetShape,
        id: newId,
        drawingId: state.activeDrawingId,
        layerId: state.activeLayerId,
      };
    });

    set((s) => {
      // Add new shapes
      for (const shape of newShapes) {
        s.shapes.push(shape);
      }

      // Select the pasted shapes
      s.selectedShapeIds = newShapes.map(shape => shape.id);

      // If cut mode, clear clipboard after first paste
      if (s.clipboardCutMode) {
        s.clipboardShapes = [];
        s.clipboardCutMode = false;
        s.clipboardOrigin = null;
      }

      s.isModified = true;
    });
  },

  hasClipboardContent: () => {
    return get().clipboardShapes.length > 0;
  },

  clearClipboard: () => {
    set((s) => {
      s.clipboardShapes = [];
      s.clipboardCutMode = false;
      s.clipboardOrigin = null;
    });
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the center point of a collection of shapes
 */
function calculateShapesCenter(shapes: Shape[]): Point {
  if (shapes.length === 0) return { x: 0, y: 0 };

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const shape of shapes) {
    const bounds = getShapeBoundsSimple(shape);
    if (bounds) {
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }
  }

  if (minX === Infinity) return { x: 0, y: 0 };

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

/**
 * Get simple bounding box for a shape
 */
function getShapeBoundsSimple(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } | null {
  switch (shape.type) {
    case 'line':
      return {
        minX: Math.min(shape.start.x, shape.end.x),
        minY: Math.min(shape.start.y, shape.end.y),
        maxX: Math.max(shape.start.x, shape.end.x),
        maxY: Math.max(shape.start.y, shape.end.y),
      };
    case 'rectangle':
      return {
        minX: shape.topLeft.x,
        minY: shape.topLeft.y,
        maxX: shape.topLeft.x + shape.width,
        maxY: shape.topLeft.y + shape.height,
      };
    case 'circle':
      return {
        minX: shape.center.x - shape.radius,
        minY: shape.center.y - shape.radius,
        maxX: shape.center.x + shape.radius,
        maxY: shape.center.y + shape.radius,
      };
    case 'ellipse':
      return {
        minX: shape.center.x - shape.radiusX,
        minY: shape.center.y - shape.radiusY,
        maxX: shape.center.x + shape.radiusX,
        maxY: shape.center.y + shape.radiusY,
      };
    case 'arc':
      return {
        minX: shape.center.x - shape.radius,
        minY: shape.center.y - shape.radius,
        maxX: shape.center.x + shape.radius,
        maxY: shape.center.y + shape.radius,
      };
    case 'polyline':
    case 'spline':
      if (shape.points.length === 0) return null;
      return {
        minX: Math.min(...shape.points.map(p => p.x)),
        minY: Math.min(...shape.points.map(p => p.y)),
        maxX: Math.max(...shape.points.map(p => p.x)),
        maxY: Math.max(...shape.points.map(p => p.y)),
      };
    case 'text':
      return {
        minX: shape.position.x,
        minY: shape.position.y - shape.fontSize,
        maxX: shape.position.x + shape.text.length * shape.fontSize * 0.6,
        maxY: shape.position.y,
      };
    case 'point':
      return {
        minX: shape.position.x,
        minY: shape.position.y,
        maxX: shape.position.x,
        maxY: shape.position.y,
      };
    case 'hatch':
      if (shape.points.length === 0) return null;
      return {
        minX: Math.min(...shape.points.map(p => p.x)),
        minY: Math.min(...shape.points.map(p => p.y)),
        maxX: Math.max(...shape.points.map(p => p.x)),
        maxY: Math.max(...shape.points.map(p => p.y)),
      };
    case 'dimension':
      if (shape.points.length === 0) return null;
      return {
        minX: Math.min(...shape.points.map(p => p.x)),
        minY: Math.min(...shape.points.map(p => p.y)),
        maxX: Math.max(...shape.points.map(p => p.x)),
        maxY: Math.max(...shape.points.map(p => p.y)),
      };
    case 'beam':
      return {
        minX: Math.min(shape.start.x, shape.end.x),
        minY: Math.min(shape.start.y, shape.end.y),
        maxX: Math.max(shape.start.x, shape.end.x),
        maxY: Math.max(shape.start.y, shape.end.y),
      };
    case 'image':
      return {
        minX: shape.position.x,
        minY: shape.position.y,
        maxX: shape.position.x + shape.width,
        maxY: shape.position.y + shape.height,
      };
    default:
      return null;
  }
}

/**
 * Offset a shape's position by a given delta
 */
function offsetShapePosition(shape: Shape, offset: Point): Shape {
  switch (shape.type) {
    case 'line':
      return {
        ...shape,
        start: { x: shape.start.x + offset.x, y: shape.start.y + offset.y },
        end: { x: shape.end.x + offset.x, y: shape.end.y + offset.y },
      };
    case 'rectangle':
      return {
        ...shape,
        topLeft: { x: shape.topLeft.x + offset.x, y: shape.topLeft.y + offset.y },
      };
    case 'circle':
      return {
        ...shape,
        center: { x: shape.center.x + offset.x, y: shape.center.y + offset.y },
      };
    case 'ellipse':
      return {
        ...shape,
        center: { x: shape.center.x + offset.x, y: shape.center.y + offset.y },
      };
    case 'arc':
      return {
        ...shape,
        center: { x: shape.center.x + offset.x, y: shape.center.y + offset.y },
      };
    case 'polyline':
      return {
        ...shape,
        points: shape.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
      };
    case 'spline':
      return {
        ...shape,
        points: shape.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
      };
    case 'text':
      return {
        ...shape,
        position: { x: shape.position.x + offset.x, y: shape.position.y + offset.y },
        leaderPoints: shape.leaderPoints?.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
      };
    case 'point':
      return {
        ...shape,
        position: { x: shape.position.x + offset.x, y: shape.position.y + offset.y },
      };
    case 'hatch':
      return {
        ...shape,
        points: shape.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
      };
    case 'dimension':
      return {
        ...shape,
        points: shape.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
      };
    case 'beam':
      return {
        ...shape,
        start: { x: shape.start.x + offset.x, y: shape.start.y + offset.y },
        end: { x: shape.end.x + offset.x, y: shape.end.y + offset.y },
      };
    case 'image':
      return {
        ...shape,
        position: { x: shape.position.x + offset.x, y: shape.position.y + offset.y },
      };
    default:
      return shape;
  }
}
