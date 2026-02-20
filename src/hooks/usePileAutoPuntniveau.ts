/**
 * usePileAutoPuntniveau - Watches for pile and puntniveau changes and
 * automatically assigns puntniveauNAP to piles that fall within a
 * puntniveau polygon area.
 *
 * When a pile's position falls inside a puntniveau polygon, its
 * puntniveauNAP is set to that polygon's value.
 *
 * Uses a signature-based approach (like usePileAutoNumbering) to detect
 * actual changes and avoid unnecessary updates.
 * Debounced at 200ms to avoid excessive updates during drag operations.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/appStore';
import type { PileShape, PuntniveauShape, Shape } from '../types/geometry';

/**
 * Ray casting algorithm for point-in-polygon test.
 * Returns true if the point lies inside the polygon.
 */
function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > point.y) !== (yj > point.y) &&
        point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function usePileAutoPuntniveau(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSignatureRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      // Only react when shapes change
      if (state.shapes === prevState.shapes) return;

      const activeDrawingId = state.activeDrawingId;
      if (!activeDrawingId) return;

      // Get all piles and puntniveau shapes in the active drawing
      const piles = state.shapes.filter(
        (s): s is PileShape => s.type === 'pile' && s.drawingId === activeDrawingId
      );
      const puntniveaus = state.shapes.filter(
        (s): s is PuntniveauShape => s.type === 'puntniveau' && s.drawingId === activeDrawingId
      );

      if (piles.length === 0 || puntniveaus.length === 0) {
        prevSignatureRef.current = '';
        return;
      }

      // Create a signature from pile positions + puntniveau polygons and values
      const pilesSig = piles
        .map(p => `${p.id}:${p.position.x.toFixed(0)},${p.position.y.toFixed(0)}:${p.puntniveauNAP ?? ''}`)
        .sort()
        .join('|');
      const puntSig = puntniveaus
        .map(pn => `${pn.id}:${pn.puntniveauNAP}:${pn.points.map(pt => `${pt.x.toFixed(0)},${pt.y.toFixed(0)}`).join(';')}`)
        .sort()
        .join('|');
      const signature = `${pilesSig}||${puntSig}`;

      if (signature === prevSignatureRef.current) return;
      prevSignatureRef.current = signature;

      // Debounce to avoid excessive updates during drag
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        assignPuntniveaus();
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

function assignPuntniveaus(): void {
  const state = useAppStore.getState();
  const { shapes, updateShapes, activeDrawingId } = state;

  if (!activeDrawingId) return;

  const piles = shapes.filter(
    (s): s is PileShape => s.type === 'pile' && s.drawingId === activeDrawingId
  );
  const puntniveaus = shapes.filter(
    (s): s is PuntniveauShape => s.type === 'puntniveau' && s.drawingId === activeDrawingId
  );

  if (piles.length === 0 || puntniveaus.length === 0) return;

  // For each pile, find which puntniveau polygon it falls in (if any)
  const updates: { id: string; updates: Partial<Shape> }[] = [];

  for (const pile of piles) {
    let newPuntniveauNAP: number | undefined = undefined;

    for (const pn of puntniveaus) {
      if (pn.points.length >= 3 && pointInPolygon(pile.position, pn.points)) {
        newPuntniveauNAP = pn.puntniveauNAP;
        break; // First match wins
      }
    }

    // Only update if the value actually changed
    const currentValue = pile.puntniveauNAP;
    if (newPuntniveauNAP !== undefined && currentValue !== newPuntniveauNAP) {
      updates.push({
        id: pile.id,
        updates: { puntniveauNAP: newPuntniveauNAP, puntniveauFromArea: true } as Partial<PileShape>,
      });
    }
  }

  if (updates.length > 0) {
    updateShapes(updates);
  }
}
