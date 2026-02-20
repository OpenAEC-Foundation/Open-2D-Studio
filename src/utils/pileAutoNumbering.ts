import type { PileShape } from '../types/geometry';

/**
 * Sort piles from top-left to bottom-right and assign sequential numbers.
 *
 * - Group by approximate Y (CAD coordinates: higher Y = higher on screen = top)
 * - Within same row (Y within tolerance), sort by X ascending (left to right)
 * - Return sorted array of pile IDs with their new labels (plain numbers: "1", "2", "3", ...)
 */
export function getAutoNumberedPiles(
  piles: PileShape[],
  rowTolerance: number = 50,
): { id: string; label: string }[] {
  if (piles.length === 0) return [];

  // Sort by Y ascending (top first — smaller Y = higher on screen), then X ascending (left first)
  const sorted = [...piles].sort((a, b) => {
    // Group into rows using tolerance
    if (Math.abs(a.position.y - b.position.y) <= rowTolerance) {
      return a.position.x - b.position.x; // same row: left to right
    }
    return a.position.y - b.position.y; // different rows: top first (smaller Y = top on screen)
  });

  return sorted.map((pile, index) => ({
    id: pile.id,
    label: String(index + 1),
  }));
}
