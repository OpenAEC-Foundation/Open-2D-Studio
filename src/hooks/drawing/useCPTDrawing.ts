/**
 * useCPTDrawing - Handles CPT (Cone Penetration Test) placement (single click)
 */

import { useCallback } from 'react';
import { useAppStore, generateId } from '../../state/appStore';
import type { Point, CPTShape } from '../../types/geometry';

export function useCPTDrawing() {
  const {
    activeLayerId,
    activeDrawingId,
    currentStyle,
    addShape,
    setDrawingPreview,
    pendingCPT,
    clearPendingCPT,
  } = useAppStore();

  /**
   * Create a CPT shape at a given position
   */
  const createCPT = useCallback(
    (position: Point, name: string, fontSize: number, markerSize: number) => {
      const cptShape: CPTShape = {
        id: generateId(),
        type: 'cpt',
        layerId: activeLayerId,
        drawingId: activeDrawingId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        position,
        name,
        fontSize,
        markerSize,
      };
      addShape(cptShape);
      return cptShape.id;
    },
    [activeLayerId, activeDrawingId, currentStyle, addShape]
  );

  /**
   * Handle click for CPT placement
   */
  const handleCPTClick = useCallback(
    (snappedPos: Point) => {
      if (!pendingCPT) return false;

      createCPT(
        snappedPos,
        pendingCPT.name,
        pendingCPT.fontSize,
        pendingCPT.markerSize,
      );

      // Auto-increment the CPT name for next placement
      const match = pendingCPT.name.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        const padded = String(num).padStart(match[2].length, '0');
        useAppStore.getState().setPendingCPT({
          ...pendingCPT,
          name: `${prefix}${padded}`,
        });
      }

      return true;
    },
    [pendingCPT, createCPT]
  );

  /**
   * Update CPT preview
   */
  const updateCPTPreview = useCallback(
    (snappedPos: Point) => {
      if (!pendingCPT) return;

      setDrawingPreview({
        type: 'cpt',
        position: snappedPos,
        name: pendingCPT.name,
        fontSize: pendingCPT.fontSize,
        markerSize: pendingCPT.markerSize,
      });
    },
    [pendingCPT, setDrawingPreview]
  );

  /**
   * Cancel CPT placement
   */
  const cancelCPTDrawing = useCallback(() => {
    setDrawingPreview(null);
    clearPendingCPT();
  }, [setDrawingPreview, clearPendingCPT]);

  return {
    handleCPTClick,
    updateCPTPreview,
    cancelCPTDrawing,
    createCPT,
    isCPTDrawingActive: !!pendingCPT,
  };
}
