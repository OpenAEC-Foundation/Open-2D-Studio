/**
 * gridlineUtils - Shared utilities for gridline operations
 *
 * Extracted from PropertiesPanel for reuse in the canvas "+" button overlay.
 *
 * Structural engineering convention:
 *   - Horizontal gridlines (|dx| > |dy|) use LETTER labels: A, B, C, ...
 *   - Vertical gridlines   (|dy| > |dx|) use NUMBER labels: 1, 2, 3, ...
 */

import type { GridlineShape } from '../types/geometry';
import { useAppStore } from '../state/appStore';

/**
 * Parse a gridline spacing pattern like "4000 3000 5x5400"
 * Returns cumulative offsets in mm.
 */
export function parseSpacingPattern(pattern: string): number[] | null {
  const tokens = pattern.trim().split(/\s+/);
  if (tokens.length === 0 || (tokens.length === 1 && tokens[0] === '')) return null;
  const offsets: number[] = [];
  let cumulative = 0;
  for (const token of tokens) {
    const repeatMatch = token.match(/^(\d+)[xX](\d+(?:\.\d+)?)$/);
    if (repeatMatch) {
      const count = parseInt(repeatMatch[1], 10);
      const dist = parseFloat(repeatMatch[2]);
      if (count <= 0 || dist <= 0 || isNaN(dist)) return null;
      for (let i = 0; i < count; i++) {
        cumulative += dist;
        offsets.push(cumulative);
      }
    } else {
      const dist = parseFloat(token);
      if (isNaN(dist) || dist <= 0) return null;
      cumulative += dist;
      offsets.push(cumulative);
    }
  }
  return offsets.length > 0 ? offsets : null;
}

/** Increment a gridline label: "1"->"2", "A"->"B", "Z"->"AA" */
export function incrementGridLabel(label: string): string {
  if (/^\d+$/.test(label)) return String(Number(label) + 1);
  if (/^[A-Z]+$/.test(label)) {
    const chars = label.split('');
    let carry = true;
    for (let i = chars.length - 1; i >= 0 && carry; i--) {
      if (chars[i].charCodeAt(0) < 90) { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); carry = false; }
      else chars[i] = 'A';
    }
    if (carry) chars.unshift('A');
    return chars.join('');
  }
  if (/^[a-z]+$/.test(label)) {
    const chars = label.split('');
    let carry = true;
    for (let i = chars.length - 1; i >= 0 && carry; i--) {
      if (chars[i].charCodeAt(0) < 122) { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); carry = false; }
      else chars[i] = 'a';
    }
    if (carry) chars.unshift('a');
    return chars.join('');
  }
  const trailingNum = label.match(/^(.*?)(\d+)$/);
  if (trailingNum) return trailingNum[1] + String(Number(trailingNum[2]) + 1);
  return label + '2';
}

/**
 * Determine if a gridline is horizontal based on its start/end points.
 * A gridline is "horizontal" when |dx| > |dy| (the line runs left-right).
 * Horizontal gridlines use letter labels (A, B, C...).
 * Vertical gridlines use number labels (1, 2, 3...).
 */
export function isGridlineHorizontal(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx > dy;
}

/** Check if a label is a pure numeric string like "1", "23" */
function isNumericLabel(label: string): boolean {
  return /^\d+$/.test(label);
}

/** Check if a label is a pure uppercase letter string like "A", "AB" */
function isLetterLabel(label: string): boolean {
  return /^[A-Z]+$/.test(label);
}

/**
 * Get the next available gridline label based on orientation.
 *
 * Structural engineering convention:
 *   - Horizontal gridlines (line runs left-right) -> letter labels: A, B, C...
 *   - Vertical gridlines (line runs top-bottom)   -> number labels: 1, 2, 3...
 *
 * Considers existing gridlines in the active drawing to find the next unused label.
 * If the user has manually typed a custom label (not the default series starter),
 * that label is respected and only auto-corrected if it matches the default
 * opposite-type starter.
 *
 * @param currentLabel - The label currently set in the pending gridline state
 * @param isHorizontal - Whether the gridline being placed is horizontal
 * @param drawingId - The active drawing ID (to scope label uniqueness)
 * @returns The correct label to use for this gridline
 */
export function getNextGridlineLabel(
  currentLabel: string,
  isHorizontal: boolean,
  drawingId: string,
): string {
  const existingLabels = new Set(
    useAppStore.getState().shapes
      .filter((s): s is GridlineShape => s.type === 'gridline' && s.drawingId === drawingId)
      .map(g => g.label)
  );

  let label = currentLabel;

  // Auto-correct when the label is a default series starter for the wrong orientation.
  // Horizontal -> should be letters; Vertical -> should be numbers.
  if (isHorizontal) {
    // User has a number label but this is a horizontal gridline -> switch to letters
    if (isNumericLabel(label)) {
      label = 'A';
      while (existingLabels.has(label)) label = incrementGridLabel(label);
    }
  } else {
    // User has a letter label but this is a vertical gridline -> switch to numbers
    if (isLetterLabel(label)) {
      label = '1';
      while (existingLabels.has(label)) label = incrementGridLabel(label);
    }
  }

  // Skip any already-used labels in the current series
  while (existingLabels.has(label)) {
    label = incrementGridLabel(label);
  }

  return label;
}

/**
 * Get the next label to queue up after placing a gridline,
 * for the auto-increment behavior. Increments the just-used label
 * and skips any already-taken labels.
 */
export function getNextIncrementedLabel(usedLabel: string, drawingId: string): string {
  const existingLabels = new Set(
    useAppStore.getState().shapes
      .filter((s): s is GridlineShape => s.type === 'gridline' && s.drawingId === drawingId)
      .map(g => g.label)
  );

  let next = incrementGridLabel(usedLabel);
  while (existingLabels.has(next)) {
    next = incrementGridLabel(next);
  }
  return next;
}

/**
 * Create gridlines from a spacing pattern relative to a reference gridline.
 * Returns the new gridline shapes.
 */
export function createGridlinesFromPattern(
  gridline: GridlineShape,
  pattern: string
): GridlineShape[] {
  const offsets = parseSpacingPattern(pattern);
  if (!offsets) return [];

  // Perpendicular direction to the gridline
  const gdx = gridline.end.x - gridline.start.x;
  const gdy = gridline.end.y - gridline.start.y;
  const len = Math.sqrt(gdx * gdx + gdy * gdy);
  if (len === 0) return [];

  // Perpendicular unit vector
  let px = gdy / len;
  let py = -gdx / len;
  const isHorizontal = Math.abs(px) < 1e-9;
  if (isHorizontal) {
    if (py > 0) { px = -px; py = -py; }
  } else {
    if (px < 0) { px = -px; py = -py; }
  }

  let currentLabel = gridline.label;
  const existingLabels = new Set(
    useAppStore.getState().shapes
      .filter((s): s is GridlineShape => s.type === 'gridline')
      .map(g => g.label)
  );

  return offsets.map(offset => {
    currentLabel = incrementGridLabel(currentLabel);
    while (existingLabels.has(currentLabel)) {
      currentLabel = incrementGridLabel(currentLabel);
    }
    existingLabels.add(currentLabel);
    return {
      ...gridline,
      id: crypto.randomUUID(),
      label: currentLabel,
      start: { x: gridline.start.x + px * offset, y: gridline.start.y + py * offset },
      end: { x: gridline.end.x + px * offset, y: gridline.end.y + py * offset },
    };
  });
}
