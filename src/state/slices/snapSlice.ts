/**
 * Snap Slice - Manages snap settings, tracking, polar, and ortho modes
 */

import type { SnapType, SnapPoint, Point, TrackingLine } from './types';

// ============================================================================
// Theme Types
// ============================================================================

export type UITheme = 'dark' | 'light' | 'blue' | 'highContrast';

export const UI_THEMES: { id: UITheme; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'blue', label: 'Blue' },
  { id: 'highContrast', label: 'High Contrast' },
];

// ============================================================================
// State Interface
// ============================================================================

export interface SnapState {
  // Grid settings
  gridSize: number;
  gridVisible: boolean;

  // Snap settings
  snapEnabled: boolean;
  activeSnaps: SnapType[];
  snapTolerance: number;
  currentSnapPoint: SnapPoint | null;

  // Tracking settings
  trackingEnabled: boolean;
  polarTrackingEnabled: boolean;
  orthoMode: boolean;
  objectTrackingEnabled: boolean;
  polarAngleIncrement: number;  // degrees
  currentTrackingLines: TrackingLine[];
  trackingPoint: Point | null;

  // Direct distance entry - stores the current tracking angle for typed distance input
  directDistanceAngle: number | null;  // radians

  // Display settings
  whiteBackground: boolean;
  boundaryVisible: boolean;
  uiTheme: UITheme;

  // Rotation gizmo
  showRotationGizmo: boolean;

  // Axes visibility
  axesVisible: boolean;

  // 3D view settings
  show3DView: boolean;
  viewMode3D: 'wireframe' | 'shaded' | 'hidden-line';

  // IFC category visibility filter
  hiddenIfcCategories: string[];
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface SnapActions {
  setGridSize: (size: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setActiveSnaps: (snaps: SnapType[]) => void;
  toggleSnapType: (snapType: SnapType) => void;
  setSnapTolerance: (tolerance: number) => void;
  setCurrentSnapPoint: (snapPoint: SnapPoint | null) => void;
  toggleTracking: () => void;
  togglePolarTracking: () => void;
  toggleOrthoMode: () => void;
  toggleObjectTracking: () => void;
  setPolarAngleIncrement: (angle: number) => void;
  setCurrentTrackingLines: (lines: TrackingLine[]) => void;
  setTrackingPoint: (point: Point | null) => void;
  setDirectDistanceAngle: (angle: number | null) => void;
  toggleWhiteBackground: () => void;
  toggleBoundaryVisible: () => void;
  setUITheme: (theme: UITheme) => void;
  toggleRotationGizmo: () => void;
  toggleAxesVisible: () => void;
  setShow3DView: (show: boolean) => void;
  setViewMode3D: (mode: 'wireframe' | 'shaded' | 'hidden-line') => void;
  toggleIfcCategoryVisibility: (category: string) => void;
  setHiddenIfcCategories: (categories: string[]) => void;
}

export type SnapSlice = SnapState & SnapActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialSnapState: SnapState = {
  gridSize: 10,
  gridVisible: false,
  snapEnabled: true,
  activeSnaps: ['endpoint', 'midpoint', 'center', 'intersection', 'origin'],
  snapTolerance: 10,
  currentSnapPoint: null,
  trackingEnabled: true,
  polarTrackingEnabled: true,
  orthoMode: false,
  objectTrackingEnabled: true,
  polarAngleIncrement: 45,
  currentTrackingLines: [],
  trackingPoint: null,
  directDistanceAngle: null,
  whiteBackground: true,
  boundaryVisible: false,
  uiTheme: 'dark',
  showRotationGizmo: true,
  axesVisible: false,
  show3DView: false,
  viewMode3D: 'shaded',
  hiddenIfcCategories: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createSnapSlice = (
  set: (fn: (state: SnapState) => void) => void,
  _get: () => SnapState
): SnapActions => ({
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

  toggleSnapType: (snapType) =>
    set((state) => {
      const index = state.activeSnaps.indexOf(snapType);
      if (index >= 0) {
        state.activeSnaps.splice(index, 1);
      } else {
        state.activeSnaps.push(snapType);
      }
    }),

  setSnapTolerance: (tolerance) =>
    set((state) => {
      state.snapTolerance = Math.max(1, tolerance);
    }),

  setCurrentSnapPoint: (snapPoint) =>
    set((state) => {
      state.currentSnapPoint = snapPoint;
    }),

  toggleTracking: () =>
    set((state) => {
      state.trackingEnabled = !state.trackingEnabled;
    }),

  togglePolarTracking: () =>
    set((state) => {
      state.polarTrackingEnabled = !state.polarTrackingEnabled;
    }),

  toggleOrthoMode: () =>
    set((state) => {
      state.orthoMode = !state.orthoMode;
      // Ortho mode overrides polar tracking
      if (state.orthoMode) {
        state.polarTrackingEnabled = false;
      }
    }),

  toggleObjectTracking: () =>
    set((state) => {
      state.objectTrackingEnabled = !state.objectTrackingEnabled;
    }),

  setPolarAngleIncrement: (angle) =>
    set((state) => {
      state.polarAngleIncrement = angle;
    }),

  setCurrentTrackingLines: (lines) =>
    set((state) => {
      state.currentTrackingLines = lines;
    }),

  setTrackingPoint: (point) =>
    set((state) => {
      state.trackingPoint = point;
    }),

  setDirectDistanceAngle: (angle) =>
    set((state) => {
      state.directDistanceAngle = angle;
    }),

  toggleWhiteBackground: () =>
    set((state) => {
      state.whiteBackground = !state.whiteBackground;
    }),

  toggleBoundaryVisible: () =>
    set((state) => {
      state.boundaryVisible = !state.boundaryVisible;
    }),

  setUITheme: (theme) =>
    set((state) => {
      state.uiTheme = theme;
      // Apply theme to document root for CSS variables
      document.documentElement.setAttribute('data-theme', theme);
    }),

  toggleRotationGizmo: () =>
    set((state) => {
      state.showRotationGizmo = !state.showRotationGizmo;
    }),
  toggleAxesVisible: () =>
    set((state) => {
      state.axesVisible = !state.axesVisible;
    }),
  setShow3DView: (show) =>
    set((state) => {
      state.show3DView = show;
    }),
  setViewMode3D: (mode) =>
    set((state) => {
      state.viewMode3D = mode;
    }),
  toggleIfcCategoryVisibility: (category) =>
    set((state) => {
      const index = state.hiddenIfcCategories.indexOf(category);
      if (index >= 0) {
        state.hiddenIfcCategories.splice(index, 1);
      } else {
        state.hiddenIfcCategories.push(category);
      }
    }),
  setHiddenIfcCategories: (categories) =>
    set((state) => {
      state.hiddenIfcCategories = categories;
    }),
});
