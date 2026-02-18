/**
 * usePileDrawing - Handles pile placement (single click)
 */

import { useCallback } from 'react';
import { useAppStore, generateId } from '../../state/appStore';
import type { Point, PileShape } from '../../types/geometry';

export function usePileDrawing() {
  const {
    activeLayerId,
    activeDrawingId,
    currentStyle,
    addShape,
    setDrawingPreview,
    pendingPile,
    clearPendingPile,
  } = useAppStore();

  /**
   * Create a pile shape at a given position
   */
  const createPile = useCallback(
    (position: Point, label: string, diameter: number, fontSize: number, showCross: boolean) => {
      const pileShape: PileShape = {
        id: generateId(),
        type: 'pile',
        layerId: activeLayerId,
        drawingId: activeDrawingId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        position,
        diameter,
        label,
        fontSize,
        showCross,
      };
      addShape(pileShape);
      return pileShape.id;
    },
    [activeLayerId, activeDrawingId, currentStyle, addShape]
  );

  /**
   * Handle click for pile placement
   */
  const handlePileClick = useCallback(
    (snappedPos: Point) => {
      if (!pendingPile) return false;

      createPile(
        snappedPos,
        pendingPile.label,
        pendingPile.diameter,
        pendingPile.fontSize,
        pendingPile.showCross,
      );

      // Keep pendingPile active so user can place multiple piles
      return true;
    },
    [pendingPile, createPile]
  );

  /**
   * Update pile preview
   */
  const updatePilePreview = useCallback(
    (snappedPos: Point) => {
      if (!pendingPile) return;

      setDrawingPreview({
        type: 'pile',
        position: snappedPos,
        diameter: pendingPile.diameter,
        label: pendingPile.label,
        fontSize: pendingPile.fontSize,
        showCross: pendingPile.showCross,
      });
    },
    [pendingPile, setDrawingPreview]
  );

  /**
   * Cancel pile placement
   */
  const cancelPileDrawing = useCallback(() => {
    setDrawingPreview(null);
    clearPendingPile();
  }, [setDrawingPreview, clearPendingPile]);

  return {
    handlePileClick,
    updatePilePreview,
    cancelPileDrawing,
    createPile,
    isPileDrawingActive: !!pendingPile,
  };
}
