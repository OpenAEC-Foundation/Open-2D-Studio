/**
 * ConnectedShapeDetection - Finds chains of connected walls/lines/beams
 *
 * Used by Tab pre-selection: when hovering over a wall and pressing Tab,
 * finds all shapes connected via shared endpoints to form a chain.
 */

import type { Shape, Point, WallShape, LineShape, BeamShape } from '../../types/geometry';

/** Tolerance for endpoint matching (in world units, typically mm) */
const ENDPOINT_TOLERANCE = 5;

/** Get the endpoints of a shape that supports chain selection */
function getEndpoints(shape: Shape): Point[] | null {
  switch (shape.type) {
    case 'wall': {
      const w = shape as WallShape;
      return [w.start, w.end];
    }
    case 'line': {
      const l = shape as LineShape;
      return [l.start, l.end];
    }
    case 'beam': {
      const b = shape as BeamShape;
      return [b.start, b.end];
    }
    default:
      return null;
  }
}

/** Check if two points are within tolerance */
function pointsClose(a: Point, b: Point, tolerance: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= tolerance * tolerance;
}

/**
 * Find all shapes connected to the given shape via shared endpoints.
 * Recursively follows the chain — if A connects to B and B connects to C,
 * all three are returned.
 *
 * @param startShapeId - The shape to start from (usually the hovered shape)
 * @param allShapes - All shapes in the drawing to search
 * @param tolerance - Endpoint matching tolerance in world units
 * @returns Array of connected shape IDs (including the start shape)
 */
export function findConnectedShapes(
  startShapeId: string,
  allShapes: Shape[],
  tolerance: number = ENDPOINT_TOLERANCE
): string[] {
  const startShape = allShapes.find(s => s.id === startShapeId);
  if (!startShape) return [];

  const startEndpoints = getEndpoints(startShape);
  if (!startEndpoints) return [];

  // Only consider shapes of the same type family (wall-wall, line-line, beam-beam)
  // or any linear type for a more inclusive chain
  const candidates = allShapes.filter(s => {
    if (s.id === startShapeId) return false;
    if (!s.visible) return false;
    return getEndpoints(s) !== null;
  });

  // BFS to find all connected shapes
  const connected = new Set<string>([startShapeId]);
  const queue: string[] = [startShapeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentShape = allShapes.find(s => s.id === currentId);
    if (!currentShape) continue;

    const currentEndpoints = getEndpoints(currentShape);
    if (!currentEndpoints) continue;

    for (const candidate of candidates) {
      if (connected.has(candidate.id)) continue;

      const candidateEndpoints = getEndpoints(candidate);
      if (!candidateEndpoints) continue;

      // Check if any endpoint of current shape is close to any endpoint of candidate
      let isConnected = false;
      for (const ep1 of currentEndpoints) {
        for (const ep2 of candidateEndpoints) {
          if (pointsClose(ep1, ep2, tolerance)) {
            isConnected = true;
            break;
          }
        }
        if (isConnected) break;
      }

      if (isConnected) {
        connected.add(candidate.id);
        queue.push(candidate.id);
      }
    }
  }

  return Array.from(connected);
}
