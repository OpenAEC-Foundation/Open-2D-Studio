/**
 * Sheet Service - Business logic for sheet layout operations
 *
 * Provides functions for:
 * - Creating sheets with proper defaults
 * - Managing viewports
 * - Title block operations
 * - Coordinate transformations
 * - Paper size calculations
 */

import type {
  Sheet,
  SheetViewport,
  TitleBlock,
  TitleBlockField,
  Point,
  PaperSize,
  PaperOrientation,
} from '../../types/geometry';

/**
 * Standard paper sizes in mm
 */
export const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
};

/**
 * MM to pixels conversion factor (at 96 DPI)
 */
export const MM_TO_PIXELS = 3.7795275591;

/**
 * Common architectural scales
 */
export const SCALE_PRESETS: Record<string, number> = {
  '1:1': 1,
  '1:2': 0.5,
  '1:5': 0.2,
  '1:10': 0.1,
  '1:20': 0.05,
  '1:25': 0.04,
  '1:50': 0.02,
  '1:100': 0.01,
  '1:200': 0.005,
  '1:500': 0.002,
  '1:1000': 0.001,
  '2:1': 2,
  '5:1': 5,
  '10:1': 10,
};

/**
 * Generate a unique ID for sheets
 */
export function generateSheetId(): string {
  return `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique ID for viewports
 */
export function generateViewportId(): string {
  return `viewport_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create default title block fields
 */
function createDefaultTitleBlockFields(): TitleBlockField[] {
  return [
    { id: 'project', label: 'Project', value: '', x: 5, y: 3, width: 85, height: 12, fontSize: 10, fontFamily: 'Arial', align: 'left' },
    { id: 'client', label: 'Client', value: '', x: 95, y: 3, width: 80, height: 12, fontSize: 10, fontFamily: 'Arial', align: 'left' },
    { id: 'title', label: 'Drawing Title', value: '', x: 5, y: 18, width: 120, height: 12, fontSize: 12, fontFamily: 'Arial', align: 'left' },
    { id: 'number', label: 'Drawing No.', value: '', x: 130, y: 18, width: 45, height: 12, fontSize: 10, fontFamily: 'Arial', align: 'left' },
    { id: 'scale', label: 'Scale', value: 'As Noted', x: 5, y: 33, width: 30, height: 12, fontSize: 9, fontFamily: 'Arial', align: 'left' },
    { id: 'date', label: 'Date', value: new Date().toISOString().split('T')[0], x: 40, y: 33, width: 30, height: 12, fontSize: 9, fontFamily: 'Arial', align: 'left' },
    { id: 'drawnBy', label: 'Drawn', value: '', x: 75, y: 33, width: 30, height: 12, fontSize: 9, fontFamily: 'Arial', align: 'left' },
    { id: 'checkedBy', label: 'Checked', value: '', x: 110, y: 33, width: 30, height: 12, fontSize: 9, fontFamily: 'Arial', align: 'left' },
    { id: 'approvedBy', label: 'Approved', value: '', x: 145, y: 33, width: 30, height: 12, fontSize: 9, fontFamily: 'Arial', align: 'left' },
    { id: 'sheetNo', label: 'Sheet', value: '1', x: 5, y: 48, width: 75, height: 12, fontSize: 10, fontFamily: 'Arial', align: 'left' },
    { id: 'revision', label: 'Revision', value: '-', x: 85, y: 48, width: 40, height: 12, fontSize: 10, fontFamily: 'Arial', align: 'left' },
    { id: 'status', label: 'Status', value: 'Draft', x: 130, y: 48, width: 45, height: 12, fontSize: 10, fontFamily: 'Arial', align: 'left' },
  ];
}

/**
 * Create a default title block
 */
export function createDefaultTitleBlock(): TitleBlock {
  return {
    visible: true,
    x: 10, // margin from edge
    y: 10,
    width: 180,
    height: 60,
    fields: createDefaultTitleBlockFields(),
  };
}

/**
 * Create a new sheet
 */
export function createSheet(
  name: string,
  paperSize: PaperSize = 'A3',
  orientation: PaperOrientation = 'landscape'
): Sheet {
  return {
    id: generateSheetId(),
    name,
    paperSize,
    orientation,
    viewports: [],
    titleBlock: createDefaultTitleBlock(),
    annotations: [],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };
}

/**
 * Get paper dimensions in mm, accounting for orientation
 */
export function getPaperDimensions(
  paperSize: PaperSize,
  orientation: PaperOrientation,
  customWidth?: number,
  customHeight?: number
): { width: number; height: number } {
  if (paperSize === 'Custom') {
    return {
      width: customWidth || 210,
      height: customHeight || 297,
    };
  }

  const baseDims = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;

  if (orientation === 'landscape') {
    return { width: baseDims.height, height: baseDims.width };
  }
  return baseDims;
}

/**
 * Create a new viewport
 */
export function createViewport(
  drawingId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number = 0.01 // 1:100 default
): SheetViewport {
  return {
    id: generateViewportId(),
    drawingId,
    x,
    y,
    width,
    height,
    scale,
    centerX: 0,
    centerY: 0,
    locked: false,
    visible: true,
  };
}

/**
 * Update viewport properties
 */
export function updateViewport(
  viewport: SheetViewport,
  updates: Partial<SheetViewport>
): SheetViewport {
  return {
    ...viewport,
    ...updates,
  };
}

/**
 * Calculate viewport center to show entire draft boundary
 */
export function calculateViewportCenter(
  draftBoundary: { x: number; y: number; width: number; height: number }
): { centerX: number; centerY: number } {
  return {
    centerX: draftBoundary.x + draftBoundary.width / 2,
    centerY: draftBoundary.y + draftBoundary.height / 2,
  };
}

/**
 * Calculate scale to fit draft boundary in viewport
 */
export function calculateViewportScale(
  draftBoundary: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 0.9 // 90% fill
): number {
  const scaleX = (viewportWidth * padding) / draftBoundary.width;
  const scaleY = (viewportHeight * padding) / draftBoundary.height;
  return Math.min(scaleX, scaleY);
}

/**
 * Format scale for display (e.g., "1:100" or "2:1")
 */
export function formatScale(scale: number): string {
  if (scale >= 1) {
    if (Number.isInteger(scale)) {
      return `${scale}:1`;
    }
    return `${scale.toFixed(1)}:1`;
  }
  const inverse = 1 / scale;
  if (Number.isInteger(inverse)) {
    return `1:${inverse}`;
  }
  return `1:${Math.round(inverse)}`;
}

/**
 * Parse scale string to number (e.g., "1:100" -> 0.01)
 */
export function parseScale(scaleStr: string): number | null {
  const match = scaleStr.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const numerator = parseFloat(match[1]);
  const denominator = parseFloat(match[2]);

  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Convert sheet coordinates (mm) to screen coordinates
 */
export function sheetToScreen(
  sheetPos: Point,
  viewport: { offsetX: number; offsetY: number; zoom: number }
): Point {
  return {
    x: sheetPos.x * MM_TO_PIXELS * viewport.zoom + viewport.offsetX,
    y: sheetPos.y * MM_TO_PIXELS * viewport.zoom + viewport.offsetY,
  };
}

/**
 * Convert screen coordinates to sheet coordinates (mm)
 */
export function screenToSheet(
  screenPos: Point,
  viewport: { offsetX: number; offsetY: number; zoom: number }
): Point {
  return {
    x: (screenPos.x - viewport.offsetX) / viewport.zoom / MM_TO_PIXELS,
    y: (screenPos.y - viewport.offsetY) / viewport.zoom / MM_TO_PIXELS,
  };
}

/**
 * Convert world coordinates to viewport coordinates
 */
export function worldToViewport(
  worldPos: Point,
  viewportConfig: SheetViewport
): Point {
  return {
    x: viewportConfig.x + (worldPos.x - viewportConfig.centerX) * viewportConfig.scale + viewportConfig.width / 2,
    y: viewportConfig.y + (worldPos.y - viewportConfig.centerY) * viewportConfig.scale + viewportConfig.height / 2,
  };
}

/**
 * Convert viewport coordinates to world coordinates
 */
export function viewportToWorld(
  viewportPos: Point,
  viewportConfig: SheetViewport
): Point {
  return {
    x: viewportConfig.centerX + (viewportPos.x - viewportConfig.x - viewportConfig.width / 2) / viewportConfig.scale,
    y: viewportConfig.centerY + (viewportPos.y - viewportConfig.y - viewportConfig.height / 2) / viewportConfig.scale,
  };
}

/**
 * Check if a point is inside a viewport
 */
export function isPointInViewport(point: Point, viewport: SheetViewport): boolean {
  return (
    point.x >= viewport.x &&
    point.x <= viewport.x + viewport.width &&
    point.y >= viewport.y &&
    point.y <= viewport.y + viewport.height
  );
}

/**
 * Update title block field value
 */
export function updateTitleBlockField(
  titleBlock: TitleBlock,
  fieldId: string,
  value: string
): TitleBlock {
  return {
    ...titleBlock,
    fields: titleBlock.fields.map(field =>
      field.id === fieldId ? { ...field, value } : field
    ),
  };
}

/**
 * Update multiple title block fields
 */
export function updateTitleBlockFields(
  titleBlock: TitleBlock,
  updates: Record<string, string>
): TitleBlock {
  return {
    ...titleBlock,
    fields: titleBlock.fields.map(field =>
      updates[field.id] !== undefined ? { ...field, value: updates[field.id] } : field
    ),
  };
}

/**
 * Get printable area dimensions (paper minus margins)
 */
export function getPrintableArea(
  paperWidth: number,
  paperHeight: number,
  margins: { top: number; right: number; bottom: number; left: number }
): { x: number; y: number; width: number; height: number } {
  return {
    x: margins.left,
    y: margins.top,
    width: paperWidth - margins.left - margins.right,
    height: paperHeight - margins.top - margins.bottom,
  };
}

/**
 * Validate sheet data
 */
export function validateSheet(sheet: Sheet): boolean {
  if (!sheet.id || !sheet.name || !sheet.paperSize || !sheet.orientation) {
    return false;
  }

  if (!Array.isArray(sheet.viewports)) {
    return false;
  }

  if (!sheet.titleBlock) {
    return false;
  }

  return true;
}

/**
 * Validate viewport data
 */
export function validateViewport(viewport: SheetViewport): boolean {
  if (!viewport.id || !viewport.drawingId) {
    return false;
  }

  if (viewport.width <= 0 || viewport.height <= 0) {
    return false;
  }

  if (viewport.scale <= 0) {
    return false;
  }

  return true;
}
