/**
 * useSectionCalloutDrawing - Handles section callout drawing (two-click: start and end of cut line)
 * Follows the same pattern as useGridlineDrawing.ts
 *
 * Supports auto-incrementing labels: A→B→C or 1→2→3
 */

import { useCallback } from 'react';
import { useAppStore, generateId } from '../../state/appStore';
import type { Point, SectionCalloutShape } from '../../types/geometry';
import { snapToAngle } from '../../engine/geometry/GeometryUtils';

/**
 * Increment a label string:
 *  "A" → "B", "Z" → "AA", "1" → "2", "9" → "10"
 */
export function incrementLabel(label: string): string {
  // Pure numeric
  if (/^\d+$/.test(label)) {
    return String(Number(label) + 1);
  }

  // Pure uppercase alphabetic — treat as base-26
  if (/^[A-Z]+$/.test(label)) {
    const chars = label.split('');
    let carry = true;
    for (let i = chars.length - 1; i >= 0 && carry; i--) {
      const code = chars[i].charCodeAt(0);
      if (code < 90) { // < 'Z'
        chars[i] = String.fromCharCode(code + 1);
        carry = false;
      } else {
        chars[i] = 'A';
      }
    }
    if (carry) chars.unshift('A');
    return chars.join('');
  }

  // Fallback: append a number or increment trailing number
  const trailingNum = label.match(/^(.*?)(\d+)$/);
  if (trailingNum) {
    return trailingNum[1] + String(Number(trailingNum[2]) + 1);
  }
  return label + '2';
}

/**
 * Get the next available section label (A, B, C, ...) that doesn't conflict
 * with any existing section-callout shapes in the store.
 */
export function getNextSectionLabel(): string {
  const shapes = useAppStore.getState().shapes;
  const existingLabels = new Set(
    shapes
      .filter((s): s is SectionCalloutShape => s.type === 'section-callout')
      .map(sc => sc.label)
  );
  let label = 'A';
  while (existingLabels.has(label)) {
    label = incrementLabel(label);
  }
  return label;
}

export function useSectionCalloutDrawing() {
  const {
    activeLayerId,
    activeDrawingId,
    currentStyle,
    addShape,
    updateShape,
    addDrawingSilent,
    updateSectionDrawingBoundary,
    drawingPoints,
    addDrawingPoint,
    clearDrawingPoints,
    setDrawingPreview,
    pendingSectionCallout,
    setPendingSectionCallout,
    clearPendingSectionCallout,
  } = useAppStore();

  /**
   * Create a section callout shape
   */
  const createSectionCallout = useCallback(
    (
      start: Point,
      end: Point,
      label: string,
      bubbleRadius: number,
      fontSize: number,
      flipDirection: boolean,
      hideStartHead?: boolean,
      hideEndHead?: boolean,
      viewDepth?: number,
    ) => {
      const shape: SectionCalloutShape = {
        id: generateId(),
        type: 'section-callout',
        layerId: activeLayerId,
        drawingId: activeDrawingId,
        style: {
          ...currentStyle,
          lineStyle: 'solid',
          strokeWidth: currentStyle.strokeWidth || 1,
        },
        visible: true,
        locked: false,
        calloutType: 'section',
        start,
        end,
        label,
        fontSize,
        bubbleRadius,
        flipDirection,
        hideStartHead,
        hideEndHead,
        viewDepth: viewDepth ?? 5000,
      };
      addShape(shape);
      return shape.id;
    },
    [activeLayerId, activeDrawingId, currentStyle, addShape]
  );

  /**
   * Handle click for section callout drawing
   */
  const handleSectionCalloutClick = useCallback(
    (snappedPos: Point, shiftKey: boolean) => {
      if (!pendingSectionCallout) return false;

      if (drawingPoints.length === 0) {
        // First click: set start point
        addDrawingPoint(snappedPos);
        return true;
      } else {
        // Second click: set end point and create section callout
        const startPoint = drawingPoints[0];
        const finalPos = shiftKey ? snapToAngle(startPoint, snappedPos) : snappedPos;

        const dx = Math.abs(finalPos.x - startPoint.x);
        const dy = Math.abs(finalPos.y - startPoint.y);

        // Only create if there's a meaningful distance
        if (dx > 1 || dy > 1) {
          // Find existing labels to avoid duplicates
          const existingLabels = new Set(
            useAppStore.getState().shapes
              .filter((s): s is SectionCalloutShape => s.type === 'section-callout')
              .map(sc => sc.label)
          );

          // Ensure current label is unique (may have been taken since dialog opened)
          let label = pendingSectionCallout.label;
          while (existingLabels.has(label)) {
            label = incrementLabel(label);
          }

          const shapeId = createSectionCallout(
            startPoint,
            finalPos,
            label,
            pendingSectionCallout.bubbleRadius,
            pendingSectionCallout.fontSize,
            pendingSectionCallout.flipDirection,
            pendingSectionCallout.hideStartHead,
            pendingSectionCallout.hideEndHead,
            pendingSectionCallout.viewDepth,
          );

          // Auto-create a new section drawing for this section callout
          const drawingName = `Section ${label}`;
          const newDrawingId = addDrawingSilent(drawingName, 'section');
          // Link the section callout shape to the new drawing
          updateShape(shapeId, { targetDrawingId: newDrawingId } as any);

          // Update the section drawing boundary based on the callout line length
          updateSectionDrawingBoundary(newDrawingId);

          // Auto-increment for next section callout
          let nextLabel = incrementLabel(label);
          while (existingLabels.has(nextLabel)) nextLabel = incrementLabel(nextLabel);

          clearDrawingPoints();
          setDrawingPreview(null);
          setPendingSectionCallout({
            ...pendingSectionCallout,
            label: nextLabel,
          });
        } else {
          clearDrawingPoints();
          setDrawingPreview(null);
        }
        return true;
      }
    },
    [pendingSectionCallout, drawingPoints, addDrawingPoint, clearDrawingPoints, setDrawingPreview, createSectionCallout, setPendingSectionCallout, activeDrawingId, addDrawingSilent, updateShape, updateSectionDrawingBoundary]
  );

  /**
   * Update section callout preview
   */
  const updateSectionCalloutPreview = useCallback(
    (snappedPos: Point, shiftKey: boolean) => {
      if (!pendingSectionCallout || drawingPoints.length === 0) return;

      const startPoint = drawingPoints[0];
      const previewPos = shiftKey ? snapToAngle(startPoint, snappedPos) : snappedPos;

      setDrawingPreview({
        type: 'section-callout',
        start: startPoint,
        end: previewPos,
        label: pendingSectionCallout.label,
        bubbleRadius: pendingSectionCallout.bubbleRadius,
        flipDirection: pendingSectionCallout.flipDirection,
        viewDepth: pendingSectionCallout.viewDepth,
      });
    },
    [pendingSectionCallout, drawingPoints, setDrawingPreview]
  );

  /**
   * Cancel section callout drawing
   */
  const cancelSectionCalloutDrawing = useCallback(() => {
    clearDrawingPoints();
    setDrawingPreview(null);
    clearPendingSectionCallout();
  }, [clearDrawingPoints, setDrawingPreview, clearPendingSectionCallout]);

  /**
   * Get the base point for tracking (first click point)
   */
  const getSectionCalloutBasePoint = useCallback((): Point | null => {
    if (!pendingSectionCallout || drawingPoints.length === 0) return null;
    return drawingPoints[0];
  }, [pendingSectionCallout, drawingPoints]);

  return {
    handleSectionCalloutClick,
    updateSectionCalloutPreview,
    cancelSectionCalloutDrawing,
    getSectionCalloutBasePoint,
    createSectionCallout,
    isSectionCalloutDrawingActive: !!pendingSectionCallout,
    hasFirstPoint: drawingPoints.length > 0,
  };
}
