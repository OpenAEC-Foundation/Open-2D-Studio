/**
 * useBoundaryEditing - Handles drawing boundary editing (selection and dragging)
 */

import { useCallback } from 'react';
import { useAppStore, type BoundaryHandleType } from '../../state/appStore';
import type { Point, DrawingBoundary } from '../../types/geometry';

export function useBoundaryEditing() {
  const {
    viewport,
    drawings,
    activeDrawingId,
    boundaryEditState,
    boundaryVisible,
    selectBoundary,
    deselectBoundary,
    startBoundaryDrag,
    updateBoundaryDrag,
    endBoundaryDrag,
  } = useAppStore();

  /**
   * Get active drawing boundary
   */
  const getActiveBoundary = useCallback((): DrawingBoundary | null => {
    const drawing = drawings.find(d => d.id === activeDrawingId);
    return drawing?.boundary || null;
  }, [drawings, activeDrawingId]);

  /**
   * Get boundary handle positions
   */
  const getBoundaryHandles = useCallback((boundary: DrawingBoundary): { type: BoundaryHandleType; x: number; y: number }[] => {
    return [
      { type: 'top-left', x: boundary.x, y: boundary.y },
      { type: 'top-right', x: boundary.x + boundary.width, y: boundary.y },
      { type: 'bottom-left', x: boundary.x, y: boundary.y + boundary.height },
      { type: 'bottom-right', x: boundary.x + boundary.width, y: boundary.y + boundary.height },
      { type: 'top', x: boundary.x + boundary.width / 2, y: boundary.y },
      { type: 'bottom', x: boundary.x + boundary.width / 2, y: boundary.y + boundary.height },
      { type: 'left', x: boundary.x, y: boundary.y + boundary.height / 2 },
      { type: 'right', x: boundary.x + boundary.width, y: boundary.y + boundary.height / 2 },
      { type: 'center', x: boundary.x + boundary.width / 2, y: boundary.y + boundary.height / 2 },
    ];
  }, []);

  /**
   * Check if a world point is near a boundary handle
   */
  const findBoundaryHandle = useCallback((worldPos: Point, boundary: DrawingBoundary): BoundaryHandleType | null => {
    const handles = getBoundaryHandles(boundary);
    const handleRadius = 15 / viewport.zoom;

    for (const handle of handles) {
      const dx = worldPos.x - handle.x;
      const dy = worldPos.y - handle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= handleRadius) {
        return handle.type;
      }
    }
    return null;
  }, [getBoundaryHandles, viewport.zoom]);

  /**
   * Check if a world point is on the boundary edge (for selection)
   */
  const isPointOnBoundaryEdge = useCallback((worldPos: Point, boundary: DrawingBoundary): boolean => {
    const tolerance = 10 / viewport.zoom;

    const x = boundary.x;
    const y = boundary.y;
    const w = boundary.width;
    const h = boundary.height;

    // Check each edge
    if (worldPos.y >= y - tolerance && worldPos.y <= y + tolerance &&
        worldPos.x >= x - tolerance && worldPos.x <= x + w + tolerance) {
      return true;
    }
    if (worldPos.y >= y + h - tolerance && worldPos.y <= y + h + tolerance &&
        worldPos.x >= x - tolerance && worldPos.x <= x + w + tolerance) {
      return true;
    }
    if (worldPos.x >= x - tolerance && worldPos.x <= x + tolerance &&
        worldPos.y >= y - tolerance && worldPos.y <= y + h + tolerance) {
      return true;
    }
    if (worldPos.x >= x + w - tolerance && worldPos.x <= x + w + tolerance &&
        worldPos.y >= y - tolerance && worldPos.y <= y + h + tolerance) {
      return true;
    }

    return false;
  }, [viewport.zoom]);

  /**
   * Handle mouse down for boundary editing
   */
  const handleBoundaryMouseDown = useCallback(
    (worldPos: Point): boolean => {
      // Don't allow interaction when boundary is not visible
      if (!boundaryVisible) return false;
      if (!boundaryEditState.isSelected) return false;

      const boundary = getActiveBoundary();
      if (!boundary) return false;

      const handle = findBoundaryHandle(worldPos, boundary);
      if (handle) {
        startBoundaryDrag(handle, worldPos);
        return true;
      }
      return false;
    },
    [boundaryVisible, boundaryEditState.isSelected, getActiveBoundary, findBoundaryHandle, startBoundaryDrag]
  );

  /**
   * Handle click for boundary selection
   */
  const handleBoundaryClick = useCallback(
    (worldPos: Point): boolean => {
      // Don't allow selection when boundary is not visible
      if (!boundaryVisible) return false;

      const boundary = getActiveBoundary();
      if (!boundary) return false;

      // If boundary is selected and clicking on a handle, don't do anything
      if (boundaryEditState.isSelected) {
        const handle = findBoundaryHandle(worldPos, boundary);
        if (handle) {
          return true;
        }
      }

      // Check if clicking on the boundary edge
      if (isPointOnBoundaryEdge(worldPos, boundary)) {
        selectBoundary();
        return true;
      }

      return false;
    },
    [boundaryVisible, getActiveBoundary, boundaryEditState.isSelected, findBoundaryHandle, isPointOnBoundaryEdge, selectBoundary]
  );

  /**
   * Handle mouse move for boundary dragging
   */
  const handleBoundaryMouseMove = useCallback(
    (worldPos: Point): boolean => {
      if (!boundaryEditState.activeHandle) return false;
      updateBoundaryDrag(worldPos);
      return true;
    },
    [boundaryEditState.activeHandle, updateBoundaryDrag]
  );

  /**
   * Handle mouse up for boundary dragging
   */
  const handleBoundaryMouseUp = useCallback((): boolean => {
    if (!boundaryEditState.activeHandle) return false;
    endBoundaryDrag();
    return true;
  }, [boundaryEditState.activeHandle, endBoundaryDrag]);

  /**
   * Check if boundary is being dragged
   */
  const isDragging = useCallback(() => boundaryEditState.activeHandle !== null, [boundaryEditState.activeHandle]);

  return {
    getActiveBoundary,
    getBoundaryHandles,
    findBoundaryHandle,
    isPointOnBoundaryEdge,
    handleBoundaryMouseDown,
    handleBoundaryClick,
    handleBoundaryMouseMove,
    handleBoundaryMouseUp,
    isDragging,
    selectBoundary,
    deselectBoundary,
    isSelected: boundaryEditState.isSelected,
  };
}
