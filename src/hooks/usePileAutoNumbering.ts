/**
 * usePileAutoNumbering - Watches for pile changes and auto-numbers them.
 *
 * When pilePlanAutoNumbering is enabled in Drawing Standards, piles in the
 * active drawing are automatically numbered sequentially (1, 2, 3, ...)
 * sorted from top-left to bottom-right.
 *
 * Triggers when piles are added, removed, or moved.
 * Debounced at 200ms to avoid excessive updates during drag operations.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/appStore';
import type { PileShape, Shape } from '../types/geometry';
import { getAutoNumberedPiles } from '../utils/pileAutoNumbering';

export function usePileAutoNumbering(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSignatureRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      // Only react when shapes change
      if (state.shapes === prevState.shapes) return;

      // Check if auto-numbering is enabled
      if (!state.pilePlanAutoNumbering) return;

      const activeDrawingId = state.activeDrawingId;
      if (!activeDrawingId) return;

      // Get all piles in the active drawing
      const piles = state.shapes.filter(
        (s): s is PileShape => s.type === 'pile' && s.drawingId === activeDrawingId
      );

      if (piles.length === 0) {
        prevSignatureRef.current = '';
        return;
      }

      // Create a signature from pile IDs + positions to detect actual changes
      const signature = piles
        .map(p => `${p.id}:${p.position.x.toFixed(0)},${p.position.y.toFixed(0)}`)
        .sort()
        .join('|');

      if (signature === prevSignatureRef.current) return;
      prevSignatureRef.current = signature;

      // Debounce to avoid excessive updates during drag
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        renumberPiles();
      }, 200);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}

function renumberPiles(): void {
  const state = useAppStore.getState();
  const { shapes, updateShapes, pilePlanAutoNumbering, activeDrawingId } = state;

  if (!pilePlanAutoNumbering || !activeDrawingId) return;

  const piles = shapes.filter(
    (s): s is PileShape => s.type === 'pile' && s.drawingId === activeDrawingId
  );

  if (piles.length === 0) return;

  // Compute new numbering
  const numbered = getAutoNumberedPiles(piles);

  // Only update piles whose labels actually changed
  const updates: { id: string; updates: Partial<Shape> }[] = [];
  for (const { id, label } of numbered) {
    const pile = shapes.find(s => s.id === id) as PileShape | undefined;
    if (pile && pile.label !== label) {
      updates.push({ id, updates: { label } as Partial<PileShape> });
    }
  }

  if (updates.length > 0) {
    updateShapes(updates);
  }
}
