import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Shape,
  Layer,
  Viewport,
  ToolType,
  Point,
  SnapType,
  ShapeStyle,
} from '../types/geometry';

// Preview shape while drawing (before mouse up)
export type DrawingPreview =
  | { type: 'line'; start: Point; end: Point }
  | { type: 'rectangle'; start: Point; end: Point }
  | { type: 'circle'; center: Point; radius: number }
  | { type: 'polyline'; points: Point[]; currentPoint: Point }
  | null;

// Selection box for box selection (window/crossing)
export type SelectionBoxMode = 'window' | 'crossing';
export interface SelectionBox {
  start: Point;      // Start point in screen coordinates
  end: Point;        // Current end point in screen coordinates
  mode: SelectionBoxMode;  // 'window' (left-to-right) or 'crossing' (right-to-left)
}

// Generate unique IDs
let idCounter = 0;
export const generateId = (): string => {
  return `${Date.now()}-${++idCounter}`;
};

// Default style
const defaultStyle: ShapeStyle = {
  strokeColor: '#ffffff',
  strokeWidth: 1,
  lineStyle: 'solid',
};

// Default layer
const defaultLayer: Layer = {
  id: 'layer-0',
  name: 'Layer 0',
  visible: true,
  locked: false,
  color: '#ffffff',
  lineStyle: 'solid',
  lineWidth: 1,
};

interface AppState {
  // Shapes
  shapes: Shape[];
  selectedShapeIds: string[];

  // Layers
  layers: Layer[];
  activeLayerId: string;

  // Viewport
  viewport: Viewport;

  // Tools
  activeTool: ToolType;
  currentStyle: ShapeStyle;

  // Grid & Snap
  gridSize: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  activeSnaps: SnapType[];

  // UI State
  canvasSize: { width: number; height: number };
  mousePosition: Point;
  isDrawing: boolean;
  drawingPreview: DrawingPreview;

  // Drawing state (for continuous drawing like AutoCAD)
  drawingPoints: Point[];  // Points clicked so far in current drawing session

  // Selection box state
  selectionBox: SelectionBox | null;

  // Command line
  commandHistory: string[];
  currentCommand: string;
  pendingCommand: string | null;  // Command to be executed (set by ToolPalette, consumed by CommandLine)
  pendingCommandPoint: Point | null;  // Point to send to active command (set by Canvas, consumed by CommandLine)
  pendingCommandSelection: string[] | null;  // Shape IDs to add to command selection (set by Canvas, consumed by CommandLine)
  hasActiveModifyCommand: boolean;  // True when a modify command is active and waiting for input
  commandIsSelecting: boolean;  // True when a command is in 'selecting' phase (waiting for object selection)
  commandPreviewShapes: Shape[];  // Preview shapes for active modify commands (move/copy preview)

  // Undo/Redo history
  historyStack: Shape[][];  // Stack of shape snapshots
  historyIndex: number;     // Current position in history (-1 means at latest)
  maxHistorySize: number;   // Maximum number of history entries

  // Dialogs
  printDialogOpen: boolean;
  aboutDialogOpen: boolean;

  // Actions - Shapes
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  deleteSelectedShapes: () => void;

  // Actions - Selection
  selectShape: (id: string, addToSelection?: boolean) => void;
  selectShapes: (ids: string[]) => void;
  deselectAll: () => void;
  selectAll: () => void;

  // Actions - Layers
  addLayer: (name?: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;

  // Actions - Viewport
  setViewport: (viewport: Partial<Viewport>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetView: () => void;

  // Actions - Tools
  setActiveTool: (tool: ToolType) => void;
  setCurrentStyle: (style: Partial<ShapeStyle>) => void;

  // Actions - Grid & Snap
  setGridSize: (size: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setActiveSnaps: (snaps: SnapType[]) => void;

  // Actions - UI
  setCanvasSize: (size: { width: number; height: number }) => void;
  setMousePosition: (point: Point) => void;
  setIsDrawing: (isDrawing: boolean) => void;
  setDrawingPreview: (preview: DrawingPreview) => void;

  // Actions - Drawing (AutoCAD-style)
  addDrawingPoint: (point: Point) => void;
  undoDrawingPoint: () => void;
  clearDrawingPoints: () => void;
  closeDrawing: () => void;  // Connect last point to first point

  // Actions - Selection box
  setSelectionBox: (box: SelectionBox | null) => void;

  // Actions - Command line
  executeCommand: (command: string) => void;
  setCurrentCommand: (command: string) => void;
  setPendingCommand: (command: string | null) => void;
  setPendingCommandPoint: (point: Point | null) => void;
  setPendingCommandSelection: (ids: string[] | null) => void;
  setHasActiveModifyCommand: (active: boolean) => void;
  setCommandIsSelecting: (isSelecting: boolean) => void;
  setCommandPreviewShapes: (shapes: Shape[]) => void;

  // Actions - Undo/Redo
  undo: () => boolean;  // Returns true if undo was performed
  redo: () => boolean;  // Returns true if redo was performed
  pushHistory: () => void;  // Save current state to history
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - Dialogs
  setPrintDialogOpen: (open: boolean) => void;
  setAboutDialogOpen: (open: boolean) => void;
}

// Deep clone helper for shapes
const cloneShapes = (shapes: Shape[]): Shape[] => {
  return JSON.parse(JSON.stringify(shapes));
};

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    // Initial state
    shapes: [],
    selectedShapeIds: [],
    layers: [defaultLayer],
    activeLayerId: defaultLayer.id,
    viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
    activeTool: 'select',
    currentStyle: defaultStyle,
    gridSize: 10,
    gridVisible: true,
    snapEnabled: true,
    activeSnaps: ['grid', 'endpoint', 'midpoint', 'center', 'intersection'],
    canvasSize: { width: 800, height: 600 },
    mousePosition: { x: 0, y: 0 },
    isDrawing: false,
    drawingPreview: null,
    drawingPoints: [],
    selectionBox: null,
    commandHistory: [],
    currentCommand: '',
    pendingCommand: null,
    pendingCommandPoint: null,
    pendingCommandSelection: null,
    hasActiveModifyCommand: false,
    commandIsSelecting: false,
    commandPreviewShapes: [],
    historyStack: [],
    historyIndex: -1,
    maxHistorySize: 50,
    printDialogOpen: false,
    aboutDialogOpen: false,

    // Shape actions (with history tracking)
    addShape: (shape) =>
      set((state) => {
        // Push history before change
        const snapshot = cloneShapes(state.shapes);
        if (state.historyIndex >= 0 && state.historyIndex < state.historyStack.length - 1) {
          state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
        }
        state.historyStack.push(snapshot);
        if (state.historyStack.length > state.maxHistorySize) {
          state.historyStack.shift();
        }
        state.historyIndex = state.historyStack.length - 1;

        // Make the change
        state.shapes.push(shape);
      }),

    updateShape: (id, updates) =>
      set((state) => {
        const index = state.shapes.findIndex((s) => s.id === id);
        if (index !== -1) {
          // Push history before change
          const snapshot = cloneShapes(state.shapes);
          if (state.historyIndex >= 0 && state.historyIndex < state.historyStack.length - 1) {
            state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
          }
          state.historyStack.push(snapshot);
          if (state.historyStack.length > state.maxHistorySize) {
            state.historyStack.shift();
          }
          state.historyIndex = state.historyStack.length - 1;

          // Make the change
          state.shapes[index] = { ...state.shapes[index], ...updates } as Shape;
        }
      }),

    deleteShape: (id) =>
      set((state) => {
        // Push history before change
        const snapshot = cloneShapes(state.shapes);
        if (state.historyIndex >= 0 && state.historyIndex < state.historyStack.length - 1) {
          state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
        }
        state.historyStack.push(snapshot);
        if (state.historyStack.length > state.maxHistorySize) {
          state.historyStack.shift();
        }
        state.historyIndex = state.historyStack.length - 1;

        // Make the change
        state.shapes = state.shapes.filter((s) => s.id !== id);
        state.selectedShapeIds = state.selectedShapeIds.filter((sid) => sid !== id);
      }),

    deleteSelectedShapes: () =>
      set((state) => {
        if (state.selectedShapeIds.length === 0) return;

        // Push history before change
        const snapshot = cloneShapes(state.shapes);
        if (state.historyIndex >= 0 && state.historyIndex < state.historyStack.length - 1) {
          state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
        }
        state.historyStack.push(snapshot);
        if (state.historyStack.length > state.maxHistorySize) {
          state.historyStack.shift();
        }
        state.historyIndex = state.historyStack.length - 1;

        // Make the change
        state.shapes = state.shapes.filter(
          (s) => !state.selectedShapeIds.includes(s.id)
        );
        state.selectedShapeIds = [];
      }),

    // Selection actions
    selectShape: (id, addToSelection = false) =>
      set((state) => {
        if (addToSelection) {
          if (!state.selectedShapeIds.includes(id)) {
            state.selectedShapeIds.push(id);
          }
        } else {
          state.selectedShapeIds = [id];
        }
      }),

    selectShapes: (ids) =>
      set((state) => {
        state.selectedShapeIds = ids;
      }),

    deselectAll: () =>
      set((state) => {
        state.selectedShapeIds = [];
      }),

    selectAll: () =>
      set((state) => {
        state.selectedShapeIds = state.shapes
          .filter((s) => {
            const layer = state.layers.find((l) => l.id === s.layerId);
            return layer && layer.visible && !layer.locked && s.visible && !s.locked;
          })
          .map((s) => s.id);
      }),

    // Layer actions
    addLayer: (name) =>
      set((state) => {
        const newLayer: Layer = {
          id: generateId(),
          name: name || `Layer ${state.layers.length}`,
          visible: true,
          locked: false,
          color: '#ffffff',
          lineStyle: 'solid',
          lineWidth: 1,
        };
        state.layers.push(newLayer);
        state.activeLayerId = newLayer.id;
      }),

    updateLayer: (id, updates) =>
      set((state) => {
        const index = state.layers.findIndex((l) => l.id === id);
        if (index !== -1) {
          state.layers[index] = { ...state.layers[index], ...updates };
        }
      }),

    deleteLayer: (id) =>
      set((state) => {
        if (state.layers.length > 1) {
          state.layers = state.layers.filter((l) => l.id !== id);
          if (state.activeLayerId === id) {
            state.activeLayerId = state.layers[0].id;
          }
          // Move shapes from deleted layer to active layer
          state.shapes.forEach((s) => {
            if (s.layerId === id) {
              s.layerId = state.activeLayerId;
            }
          });
        }
      }),

    setActiveLayer: (id) =>
      set((state) => {
        state.activeLayerId = id;
      }),

    // Viewport actions
    setViewport: (viewport) =>
      set((state) => {
        state.viewport = { ...state.viewport, ...viewport };
      }),

    zoomIn: () =>
      set((state) => {
        state.viewport.zoom = Math.min(state.viewport.zoom * 1.2, 100);
      }),

    zoomOut: () =>
      set((state) => {
        state.viewport.zoom = Math.max(state.viewport.zoom / 1.2, 0.01);
      }),

    zoomToFit: () =>
      set((state) => {
        // TODO: Calculate bounding box of all shapes and fit viewport
        state.viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
      }),

    resetView: () =>
      set((state) => {
        state.viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
      }),

    // Tool actions
    setActiveTool: (tool) =>
      set((state) => {
        state.activeTool = tool;
        state.isDrawing = false;
        state.drawingPreview = null;
        state.drawingPoints = [];
      }),

    setCurrentStyle: (style) =>
      set((state) => {
        state.currentStyle = { ...state.currentStyle, ...style };
      }),

    // Grid & Snap actions
    setGridSize: (size) =>
      set((state) => {
        state.gridSize = Math.max(1, size);
      }),

    toggleGrid: () =>
      set((state) => {
        state.gridVisible = !state.gridVisible;
      }),

    toggleSnap: () =>
      set((state) => {
        state.snapEnabled = !state.snapEnabled;
      }),

    setActiveSnaps: (snaps) =>
      set((state) => {
        state.activeSnaps = snaps;
      }),

    // UI actions
    setCanvasSize: (size) =>
      set((state) => {
        state.canvasSize = size;
      }),

    setMousePosition: (point) =>
      set((state) => {
        state.mousePosition = point;
      }),

    setIsDrawing: (isDrawing) =>
      set((state) => {
        state.isDrawing = isDrawing;
      }),

    setDrawingPreview: (preview) =>
      set((state) => {
        state.drawingPreview = preview;
      }),

    // Drawing actions (AutoCAD-style)
    addDrawingPoint: (point) =>
      set((state) => {
        state.drawingPoints.push(point);
        state.isDrawing = true;
      }),

    undoDrawingPoint: () =>
      set((state) => {
        if (state.drawingPoints.length > 0) {
          state.drawingPoints.pop();
          if (state.drawingPoints.length === 0) {
            state.isDrawing = false;
            state.drawingPreview = null;
          }
        }
      }),

    clearDrawingPoints: () =>
      set((state) => {
        state.drawingPoints = [];
        state.isDrawing = false;
        state.drawingPreview = null;
      }),

    closeDrawing: () =>
      set((state) => {
        // This will be handled in the canvas events to create a closing line
        // Just mark that we want to close
        state.drawingPoints = [];
        state.isDrawing = false;
        state.drawingPreview = null;
      }),

    // Selection box actions
    setSelectionBox: (box) =>
      set((state) => {
        state.selectionBox = box;
      }),

    // Command line actions
    executeCommand: (command) =>
      set((state) => {
        state.commandHistory.push(command);
        state.currentCommand = '';
        // TODO: Parse and execute command
      }),

    setCurrentCommand: (command) =>
      set((state) => {
        state.currentCommand = command;
      }),

    setPendingCommand: (command) =>
      set((state) => {
        state.pendingCommand = command;
      }),

    setPendingCommandPoint: (point) =>
      set((state) => {
        state.pendingCommandPoint = point;
      }),

    setPendingCommandSelection: (ids) =>
      set((state) => {
        state.pendingCommandSelection = ids;
      }),

    setHasActiveModifyCommand: (active) =>
      set((state) => {
        state.hasActiveModifyCommand = active;
      }),

    setCommandIsSelecting: (isSelecting) =>
      set((state) => {
        state.commandIsSelecting = isSelecting;
      }),

    setCommandPreviewShapes: (previewShapes) =>
      set((state) => {
        state.commandPreviewShapes = previewShapes;
      }),

    // Undo/Redo actions
    pushHistory: () =>
      set((state) => {
        // Clone current shapes
        const snapshot = cloneShapes(state.shapes);

        // If we're not at the end of history, truncate future states
        if (state.historyIndex >= 0 && state.historyIndex < state.historyStack.length - 1) {
          state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
        }

        // Add new snapshot
        state.historyStack.push(snapshot);

        // Trim history if it exceeds max size
        if (state.historyStack.length > state.maxHistorySize) {
          state.historyStack.shift();
        }

        // Update index to point to latest
        state.historyIndex = state.historyStack.length - 1;
      }),

    undo: () => {
      let success = false;

      set((state) => {
        // If no history, can't undo
        if (state.historyStack.length === 0) return;

        // If this is the first undo (we're at the latest state), save current state first
        if (state.historyIndex === state.historyStack.length - 1) {
          // Save current state so we can redo back to it
          const currentSnapshot = cloneShapes(state.shapes);
          state.historyStack.push(currentSnapshot);
          // historyIndex now points to the saved "current" state
          state.historyIndex = state.historyStack.length - 1;
        }

        // Calculate new index
        const newIndex = state.historyIndex - 1;
        if (newIndex < 0) return;

        // Restore the previous state
        state.shapes = cloneShapes(state.historyStack[newIndex]);
        state.historyIndex = newIndex;
        state.selectedShapeIds = []; // Clear selection on undo
        success = true;
      });

      return success;
    },

    redo: () => {
      let success = false;

      set((state) => {
        // If no history or at the end, can't redo
        if (state.historyStack.length === 0) return;

        const newIndex = state.historyIndex + 1;
        if (newIndex >= state.historyStack.length) return;

        // Restore the next state
        state.shapes = cloneShapes(state.historyStack[newIndex]);
        state.historyIndex = newIndex;
        state.selectedShapeIds = []; // Clear selection on redo
        success = true;
      });

      return success;
    },

    canUndo: () => {
      const state = get();
      return state.historyStack.length > 0 && state.historyIndex > 0;
    },

    canRedo: () => {
      const state = get();
      return state.historyStack.length > 0 && state.historyIndex < state.historyStack.length - 1;
    },

    // Dialog actions
    setPrintDialogOpen: (open) =>
      set((state) => {
        state.printDialogOpen = open;
      }),
    setAboutDialogOpen: (open) =>
      set((state) => {
        state.aboutDialogOpen = open;
      }),
  }))
);
