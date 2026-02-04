/**
 * Selection Service - Business logic for shape selection
 *
 * Provides functions for:
 * - Point-based selection (click on shape)
 * - Box selection (window/crossing)
 * - Filtering selection by layer, type, or other criteria
 */

import type { Shape, Point, Layer } from '../../types/geometry';
import { isPointNearShape, getShapeBounds } from '../../engine/geometry/GeometryUtils';

/**
 * Selection box mode
 */
export type SelectionMode = 'window' | 'crossing';

/**
 * Selection box definition
 */
export interface SelectionBox {
  start: Point;
  end: Point;
  mode: SelectionMode;
}

/**
 * Find shape at a point (for click selection)
 */
export function findShapeAtPoint(
  point: Point,
  shapes: Shape[],
  tolerance: number = 5
): Shape | null {
  // Search in reverse order (topmost shapes first)
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (!shape.visible) continue;
    if (shape.locked) continue;

    if (isPointNearShape(point, shape, tolerance)) {
      return shape;
    }
  }
  return null;
}

/**
 * Find all shapes at a point (may have overlapping shapes)
 */
export function findShapesAtPoint(
  point: Point,
  shapes: Shape[],
  tolerance: number = 5
): Shape[] {
  return shapes.filter(shape => {
    if (!shape.visible || shape.locked) return false;
    return isPointNearShape(point, shape, tolerance);
  });
}

/**
 * Select shapes by box (window or crossing selection)
 */
export function selectShapesByBox(
  shapes: Shape[],
  box: SelectionBox
): Shape[] {
  const minX = Math.min(box.start.x, box.end.x);
  const maxX = Math.max(box.start.x, box.end.x);
  const minY = Math.min(box.start.y, box.end.y);
  const maxY = Math.max(box.start.y, box.end.y);

  return shapes.filter(shape => {
    if (!shape.visible || shape.locked) return false;

    const bounds = getShapeBounds(shape);
    if (!bounds) return false;

    if (box.mode === 'window') {
      // Window selection: shape must be completely inside
      return (
        bounds.minX >= minX &&
        bounds.maxX <= maxX &&
        bounds.minY >= minY &&
        bounds.maxY <= maxY
      );
    } else {
      // Crossing selection: shape can be inside or crossing
      return (
        bounds.maxX >= minX &&
        bounds.minX <= maxX &&
        bounds.maxY >= minY &&
        bounds.minY <= maxY
      );
    }
  });
}

/**
 * Filter shapes by layer
 */
export function filterByLayer(shapes: Shape[], layerId: string): Shape[] {
  return shapes.filter(shape => shape.layerId === layerId);
}

/**
 * Filter shapes by multiple layers
 */
export function filterByLayers(shapes: Shape[], layerIds: string[]): Shape[] {
  const layerSet = new Set(layerIds);
  return shapes.filter(shape => layerSet.has(shape.layerId));
}

/**
 * Filter shapes by type
 */
export function filterByType(shapes: Shape[], type: Shape['type']): Shape[] {
  return shapes.filter(shape => shape.type === type);
}

/**
 * Filter shapes by multiple types
 */
export function filterByTypes(shapes: Shape[], types: Shape['type'][]): Shape[] {
  const typeSet = new Set(types);
  return shapes.filter(shape => typeSet.has(shape.type));
}

/**
 * Filter shapes by drawing
 */
export function filterByDrawing(shapes: Shape[], drawingId: string): Shape[] {
  return shapes.filter(shape => shape.drawingId === drawingId);
}

// Legacy alias
export const filterByDraft = filterByDrawing;

/**
 * Filter to only visible shapes
 */
export function filterVisible(shapes: Shape[]): Shape[] {
  return shapes.filter(shape => shape.visible);
}

/**
 * Filter to only unlocked shapes
 */
export function filterUnlocked(shapes: Shape[]): Shape[] {
  return shapes.filter(shape => !shape.locked);
}

/**
 * Filter to selectable shapes (visible and unlocked)
 */
export function filterSelectable(shapes: Shape[]): Shape[] {
  return shapes.filter(shape => shape.visible && !shape.locked);
}

/**
 * Filter shapes by visible layers
 */
export function filterByVisibleLayers(shapes: Shape[], layers: Layer[]): Shape[] {
  const visibleLayerIds = new Set(
    layers.filter(layer => layer.visible).map(layer => layer.id)
  );
  return shapes.filter(shape => visibleLayerIds.has(shape.layerId));
}

/**
 * Filter shapes by unlocked layers
 */
export function filterByUnlockedLayers(shapes: Shape[], layers: Layer[]): Shape[] {
  const unlockedLayerIds = new Set(
    layers.filter(layer => !layer.locked).map(layer => layer.id)
  );
  return shapes.filter(shape => unlockedLayerIds.has(shape.layerId));
}

/**
 * Add shapes to selection (union)
 */
export function addToSelection(
  currentSelection: string[],
  newShapeIds: string[]
): string[] {
  const selectionSet = new Set(currentSelection);
  newShapeIds.forEach(id => selectionSet.add(id));
  return Array.from(selectionSet);
}

/**
 * Remove shapes from selection
 */
export function removeFromSelection(
  currentSelection: string[],
  shapeIdsToRemove: string[]
): string[] {
  const removeSet = new Set(shapeIdsToRemove);
  return currentSelection.filter(id => !removeSet.has(id));
}

/**
 * Toggle shape in selection
 */
export function toggleInSelection(
  currentSelection: string[],
  shapeId: string
): string[] {
  if (currentSelection.includes(shapeId)) {
    return currentSelection.filter(id => id !== shapeId);
  }
  return [...currentSelection, shapeId];
}

/**
 * Get shapes by IDs
 */
export function getShapesByIds(shapes: Shape[], ids: string[]): Shape[] {
  const idSet = new Set(ids);
  return shapes.filter(shape => idSet.has(shape.id));
}

/**
 * Invert selection within a set of shapes
 */
export function invertSelection(
  allShapes: Shape[],
  currentSelection: string[]
): string[] {
  const currentSet = new Set(currentSelection);
  return allShapes
    .filter(shape => shape.visible && !shape.locked && !currentSet.has(shape.id))
    .map(shape => shape.id);
}

/**
 * Select all shapes (visible and unlocked)
 */
export function selectAll(shapes: Shape[]): string[] {
  return filterSelectable(shapes).map(shape => shape.id);
}

/**
 * Check if a shape is selected
 */
export function isSelected(shapeId: string, selection: string[]): boolean {
  return selection.includes(shapeId);
}

/**
 * Get selection statistics
 */
export function getSelectionStats(
  shapes: Shape[],
  selectedIds: string[]
): {
  count: number;
  byType: Record<string, number>;
  byLayer: Record<string, number>;
} {
  const selectedShapes = getShapesByIds(shapes, selectedIds);

  const stats = {
    count: selectedShapes.length,
    byType: {} as Record<string, number>,
    byLayer: {} as Record<string, number>,
  };

  selectedShapes.forEach(shape => {
    stats.byType[shape.type] = (stats.byType[shape.type] || 0) + 1;
    stats.byLayer[shape.layerId] = (stats.byLayer[shape.layerId] || 0) + 1;
  });

  return stats;
}
