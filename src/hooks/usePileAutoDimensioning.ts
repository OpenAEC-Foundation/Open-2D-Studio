/**
 * usePileAutoDimensioning - Watches for pile changes and auto-generates
 * dimension lines between piles when pilePlanAutoDimensioning is enabled.
 *
 * Groups piles into rows and columns, creates chain dimensions between
 * consecutive piles plus total dimensions for each row/column.
 *
 * Uses a snapshot-based approach (like useSpaceAutoUpdate) to detect
 * actual pile position changes and avoid infinite loops.
 * Debounced at 300ms to avoid excessive recalculation during drag operations.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/appStore';
import type { PileShape } from '../types/geometry';
import type { DimensionShape } from '../types/dimension';
import { regeneratePileDimensions } from '../utils/pileDimensionUtils';

export function usePileAutoDimensioning(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPileSnapshotRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      // Only react when shapes or the setting changes
      if (
        state.shapes === prevState.shapes &&
        state.pilePlanAutoDimensioning === prevState.pilePlanAutoDimensioning
      ) {
        return;
      }

      // If auto-dimensioning is disabled, remove existing pile dimensions and bail
      if (!state.pilePlanAutoDimensioning) {
        const existingPileDims = state.shapes.filter(
          (s): s is DimensionShape =>
            s.type === 'dimension' &&
            (s as DimensionShape).isPileDimension === true
        );
        if (existingPileDims.length > 0) {
          state.deleteShapes(existingPileDims.map(s => s.id));
        }
        prevPileSnapshotRef.current = '';
        return;
      }

      // Build a snapshot of pile positions to detect actual changes
      // (not every shape change should trigger recalculation)
      const piles = state.shapes.filter(
        (s): s is PileShape =>
          s.type === 'pile' && s.drawingId === state.activeDrawingId
      );
      const pileSnapshot = piles
        .map(p => `${p.id}:${p.position.x},${p.position.y}`)
        .sort()
        .join('|');

      if (pileSnapshot === prevPileSnapshotRef.current) return;
      prevPileSnapshotRef.current = pileSnapshot;

      // Debounce
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        recalculatePileDimensions();
      }, 300);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}

function recalculatePileDimensions(): void {
  const state = useAppStore.getState();
  const { shapes, activeDrawingId, activeLayerId, addShapes, deleteShapes } = state;

  if (!activeDrawingId) return;
  if (!state.pilePlanAutoDimensioning) return;

  // Remove existing auto-generated pile dimensions
  const existingPileDims = shapes.filter(
    (s): s is DimensionShape =>
      s.type === 'dimension' &&
      s.drawingId === activeDrawingId &&
      (s as DimensionShape).isPileDimension === true
  );
  if (existingPileDims.length > 0) {
    deleteShapes(existingPileDims.map(s => s.id));
  }

  // Get piles in the active drawing
  const piles = shapes.filter(
    (s): s is PileShape =>
      s.type === 'pile' && s.drawingId === activeDrawingId
  );

  if (piles.length < 2) return;

  // Generate new dimensions
  const newDims = regeneratePileDimensions(piles, activeDrawingId, activeLayerId);

  if (newDims.length > 0) {
    addShapes(newDims);
  }
}
