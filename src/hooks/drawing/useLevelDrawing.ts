/**
 * useLevelDrawing - Handles level drawing (click start, click end)
 * Follows the same pattern as useGridlineDrawing.ts
 *
 * Levels are horizontal reference planes (floor levels).
 * - Placement is constrained to be horizontal (Y locked to start point).
 * - Peil value is auto-calculated from the Y position.
 * - Label always shows on the right (end) side only.
 */

import { useCallback } from 'react';
import { useAppStore, generateId } from '../../state/appStore';
import type { Point, LevelShape, LevelLabelPosition } from '../../types/geometry';

/**
 * Format a peil value (in mm) for display.
 * peil=0    -> "\u00b1 0"
 * peil=3100 -> "+ 3100"
 * peil=-500 -> "- 500"
 *
 * Takes a PEIL value (not a canvas Y coordinate).
 */
export function formatPeilLabel(peil: number): string {
  const rounded = Math.round(peil);
  if (rounded === 0) return '\u00b1 0';
  if (rounded > 0) return `+ ${rounded}`;
  return `- ${Math.abs(rounded)}`;
}

/**
 * Calculate the peil value from a canvas Y coordinate.
 * Canvas Y is inverted (positive Y = downward), while peil is positive upward.
 * So peil = -Y.
 */
export function calculatePeilFromY(y: number): number {
  return Math.round(-y);
}

export function useLevelDrawing() {
  const {
    activeLayerId,
    activeDrawingId,
    currentStyle,
    addShape,
    drawingPoints,
    addDrawingPoint,
    clearDrawingPoints,
    setDrawingPreview,
    pendingLevel,
    setPendingLevel,
    clearPendingLevel,
  } = useAppStore();

  /**
   * Create a level shape
   */
  const createLevel = useCallback(
    (
      start: Point,
      end: Point,
      _label: string,
      _labelPosition: LevelLabelPosition,
      bubbleRadius: number,
      fontSize: number,
    ) => {
      // Auto-calculate peil from Y position (canvas Y is inverted)
      const peil = calculatePeilFromY(start.y);
      const autoLabel = formatPeilLabel(peil);

      const levelShape: LevelShape = {
        id: generateId(),
        type: 'level',
        layerId: activeLayerId,
        drawingId: activeDrawingId,
        style: {
          ...currentStyle,
          lineStyle: 'dashed', // Dashed for levels (vs dashdot for gridlines)
        },
        visible: true,
        locked: false,
        start,
        end,
        label: autoLabel,
        labelPosition: 'end', // Always right side
        bubbleRadius,
        fontSize,
        elevation: peil,
        peil,
        description: pendingLevel?.description,
      };
      addShape(levelShape);
      return levelShape.id;
    },
    [activeLayerId, activeDrawingId, currentStyle, addShape, pendingLevel]
  );

  /**
   * Handle click for level drawing
   */
  const handleLevelClick = useCallback(
    (snappedPos: Point, _shiftKey: boolean) => {
      if (!pendingLevel) return false;

      if (drawingPoints.length === 0) {
        // First click: set start point
        addDrawingPoint(snappedPos);
        return true;
      } else {
        // Second click: set end point and create level
        const startPoint = drawingPoints[0];
        // Constrain to horizontal: lock Y to the start point's Y
        const finalPos: Point = { x: snappedPos.x, y: startPoint.y };

        const dx = Math.abs(finalPos.x - startPoint.x);

        if (dx > 1) {
          createLevel(
            startPoint,
            finalPos,
            pendingLevel.label,
            'end', // Always right side
            pendingLevel.bubbleRadius,
            pendingLevel.fontSize,
          );
        }

        clearDrawingPoints();
        setDrawingPreview(null);

        // Keep pending state for next level placement (user can keep placing)
        setPendingLevel({
          ...pendingLevel,
        });
        return true;
      }
    },
    [pendingLevel, drawingPoints, addDrawingPoint, clearDrawingPoints, setDrawingPreview, createLevel, setPendingLevel]
  );

  /**
   * Update level preview
   */
  const updateLevelPreview = useCallback(
    (snappedPos: Point, _shiftKey: boolean) => {
      if (!pendingLevel || drawingPoints.length === 0) return;

      const startPoint = drawingPoints[0];
      // Constrain to horizontal: lock Y to the start point's Y
      const previewPos: Point = { x: snappedPos.x, y: startPoint.y };

      // Auto-calculate peil label from Y position (canvas Y is inverted)
      const autoLabel = formatPeilLabel(calculatePeilFromY(startPoint.y));

      setDrawingPreview({
        type: 'level',
        start: startPoint,
        end: previewPos,
        label: autoLabel,
        labelPosition: 'end', // Always right side
        bubbleRadius: pendingLevel.bubbleRadius,
      });
    },
    [pendingLevel, drawingPoints, setDrawingPreview]
  );

  /**
   * Cancel level drawing
   */
  const cancelLevelDrawing = useCallback(() => {
    clearDrawingPoints();
    setDrawingPreview(null);
    clearPendingLevel();
  }, [clearDrawingPoints, setDrawingPreview, clearPendingLevel]);

  /**
   * Get the base point for tracking (first click point)
   */
  const getLevelBasePoint = useCallback((): Point | null => {
    if (!pendingLevel || drawingPoints.length === 0) return null;
    return drawingPoints[0];
  }, [pendingLevel, drawingPoints]);

  return {
    handleLevelClick,
    updateLevelPreview,
    cancelLevelDrawing,
    getLevelBasePoint,
    createLevel,
    isLevelDrawingActive: !!pendingLevel,
    hasFirstPoint: drawingPoints.length > 0,
  };
}
