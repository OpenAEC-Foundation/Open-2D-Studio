/**
 * pileDimensionUtils - Auto-generates dimension lines between piles.
 *
 * Groups piles into rows (same Y ± tolerance) and columns (same X ± tolerance),
 * then creates chain dimensions between consecutive piles and total dimensions
 * spanning each row/column.
 *
 * Follows the same pattern as gridDimensionUtils.ts for creating DimensionShape objects.
 */

import type { PileShape, Point } from '../types/geometry';
import type { DimensionShape } from '../types/dimension';
import { DIM_ASSOCIATE_STYLE } from '../constants/cadDefaults';
import { calculateDimensionValue, formatDimAssociateValue } from '../engine/geometry/DimensionUtils';

/** Tolerance for grouping piles into rows/columns (50mm in drawing units) */
const GROUP_TOLERANCE = 50;

/**
 * Helper: create a DimensionShape for pile dimensioning using DimAssociate style.
 * Links to two pile IDs for associativity.
 */
function makePileDim(
  p1: Point,
  p2: Point,
  offset: number,
  direction: 'horizontal' | 'vertical',
  drawingId: string,
  layerId: string,
  linkedPileIds: [string, string],
  idSuffix: string,
): DimensionShape {
  const value = calculateDimensionValue([p1, p2], 'linear', direction);
  const formattedValue = formatDimAssociateValue(value);
  return {
    id: `pile-dim-${idSuffix}`,
    type: 'dimension',
    layerId,
    drawingId,
    style: { strokeColor: '#000000', strokeWidth: 2.5, lineStyle: 'solid' as const },
    visible: true,
    locked: false,
    dimensionType: 'linear',
    points: [p1, p2],
    dimensionLineOffset: offset,
    linearDirection: direction,
    value: formattedValue,
    valueOverridden: false,
    dimensionStyle: { ...DIM_ASSOCIATE_STYLE },
    isPileDimension: true,
    dimensionStyleName: 'DimAssociate',
    linkedPileIds,
  };
}

/**
 * Generate a deterministic ID suffix from two pile IDs and a direction tag.
 */
function dimId(pileId1: string, pileId2: string, tag: string): string {
  return `${tag}-${pileId1}-${pileId2}`;
}

/**
 * Group piles by approximate coordinate value.
 * Returns groups where each group contains piles within `tolerance` of each other
 * on the specified axis.
 */
function groupByAxis(
  piles: PileShape[],
  axis: 'x' | 'y',
  tolerance: number,
): PileShape[][] {
  if (piles.length === 0) return [];

  // Sort piles by the axis value
  const sorted = [...piles].sort((a, b) => a.position[axis] - b.position[axis]);

  const groups: PileShape[][] = [];
  let currentGroup: PileShape[] = [sorted[0]];
  let groupCenter = sorted[0].position[axis];

  for (let i = 1; i < sorted.length; i++) {
    const val = sorted[i].position[axis];
    if (Math.abs(val - groupCenter) <= tolerance) {
      currentGroup.push(sorted[i]);
      // Update group center as running average
      groupCenter =
        currentGroup.reduce((sum, p) => sum + p.position[axis], 0) / currentGroup.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupCenter = val;
    }
  }
  groups.push(currentGroup);

  return groups.filter(g => g.length >= 2);
}

/**
 * Regenerate all pile dimension lines for a given set of piles.
 *
 * @param piles - All pile shapes in the drawing
 * @param drawingId - Active drawing ID
 * @param layerId - Layer to place dimensions on
 * @param offset - Distance from pile positions to dimension line (default 300mm)
 * @returns Array of DimensionShape objects to add to the store
 */
export function regeneratePileDimensions(
  piles: PileShape[],
  drawingId: string,
  layerId: string,
  offset: number = 300,
): DimensionShape[] {
  if (piles.length < 2) return [];

  const newDims: DimensionShape[] = [];

  // ---- Rows: group by Y, create horizontal dimensions ----
  const rows = groupByAxis(piles, 'y', GROUP_TOLERANCE);

  for (const row of rows) {
    // Sort piles in this row left to right (by X)
    const sorted = [...row].sort((a, b) => a.position.x - b.position.x);

    // Find the maximum Y in this row (lowest point visually if Y increases downward)
    const maxY = Math.max(...sorted.map(p => p.position.y));
    // Dimension line Y: below the row
    const dimY = maxY + offset;

    // Chain dimensions between consecutive piles
    for (let i = 0; i < sorted.length - 1; i++) {
      const p1: Point = { x: sorted[i].position.x, y: dimY };
      const p2: Point = { x: sorted[i + 1].position.x, y: dimY };
      newDims.push(makePileDim(
        p1, p2,
        0,
        'horizontal',
        drawingId,
        layerId,
        [sorted[i].id, sorted[i + 1].id],
        dimId(sorted[i].id, sorted[i + 1].id, 'row-chain'),
      ));
    }

    // Total dimension spanning the entire row (offset further down)
    if (sorted.length > 2) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const p1: Point = { x: first.position.x, y: dimY };
      const p2: Point = { x: last.position.x, y: dimY };
      newDims.push(makePileDim(
        p1, p2,
        offset, // additional offset for total line
        'horizontal',
        drawingId,
        layerId,
        [first.id, last.id],
        dimId(first.id, last.id, 'row-total'),
      ));
    }
  }

  // ---- Columns: group by X, create vertical dimensions ----
  const columns = groupByAxis(piles, 'x', GROUP_TOLERANCE);

  for (const col of columns) {
    // Sort piles in this column top to bottom (by Y)
    const sorted = [...col].sort((a, b) => a.position.y - b.position.y);

    // Find the minimum X in this column (leftmost pile)
    const minX = Math.min(...sorted.map(p => p.position.x));
    // Dimension line X: to the left of the column
    const dimX = minX - offset;

    // Chain dimensions between consecutive piles
    for (let i = 0; i < sorted.length - 1; i++) {
      const p1: Point = { x: dimX, y: sorted[i].position.y };
      const p2: Point = { x: dimX, y: sorted[i + 1].position.y };
      newDims.push(makePileDim(
        p1, p2,
        0,
        'vertical',
        drawingId,
        layerId,
        [sorted[i].id, sorted[i + 1].id],
        dimId(sorted[i].id, sorted[i + 1].id, 'col-chain'),
      ));
    }

    // Total dimension spanning the entire column (offset further left)
    if (sorted.length > 2) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const p1: Point = { x: dimX, y: first.position.y };
      const p2: Point = { x: dimX, y: last.position.y };
      newDims.push(makePileDim(
        p1, p2,
        -offset, // additional offset (negative = further left)
        'vertical',
        drawingId,
        layerId,
        [first.id, last.id],
        dimId(first.id, last.id, 'col-total'),
      ));
    }
  }

  return newDims;
}
