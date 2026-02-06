/**
 * Modify geometry utilities - pure functions for transform operations
 */

import type { Point, Shape, LineShape, ArcShape } from '../../types/geometry';
import { generateId } from '../../state/slices/types';

// ============================================================================
// Point Transforms
// ============================================================================

export type PointTransform = (p: Point) => Point;

export function translateTransform(dx: number, dy: number): PointTransform {
  return (p) => ({ x: p.x + dx, y: p.y + dy });
}

export function rotateTransform(center: Point, angle: number): PointTransform {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (p) => ({
    x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
    y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
  });
}

export function scaleTransform(origin: Point, factor: number): PointTransform {
  return (p) => ({
    x: origin.x + (p.x - origin.x) * factor,
    y: origin.y + (p.y - origin.y) * factor,
  });
}

export function mirrorTransform(axisP1: Point, axisP2: Point): PointTransform {
  const dx = axisP2.x - axisP1.x;
  const dy = axisP2.y - axisP1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (p) => p;
  return (p) => {
    const t = ((p.x - axisP1.x) * dx + (p.y - axisP1.y) * dy) / lenSq;
    const projX = axisP1.x + t * dx;
    const projY = axisP1.y + t * dy;
    return {
      x: 2 * projX - p.x,
      y: 2 * projY - p.y,
    };
  };
}

// ============================================================================
// Shape Transform
// ============================================================================

/**
 * Deep-clone a shape and apply a point transform to all geometric points.
 * Returns a new shape with a new ID.
 */
export function transformShape(shape: Shape, transform: PointTransform, newId?: string): Shape {
  const cloned: Shape = JSON.parse(JSON.stringify(shape));
  (cloned as any).id = newId ?? generateId();

  switch (cloned.type) {
    case 'line':
      cloned.start = transform(cloned.start);
      cloned.end = transform(cloned.end);
      break;
    case 'beam':
      cloned.start = transform(cloned.start);
      cloned.end = transform(cloned.end);
      break;
    case 'rectangle': {
      const rot = cloned.rotation || 0;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const tl = cloned.topLeft;
      // Compute the four corners in world space
      const corners = [
        { x: 0, y: 0 },
        { x: cloned.width, y: 0 },
        { x: cloned.width, y: cloned.height },
        { x: 0, y: cloned.height },
      ].map(c => ({
        x: tl.x + c.x * cos - c.y * sin,
        y: tl.y + c.x * sin + c.y * cos,
      }));

      // Transform all four corners
      const tc = corners.map(transform);

      // Derive new rotation from the transformed first edge (topLeft -> topRight)
      const newEdgeDx = tc[1].x - tc[0].x;
      const newEdgeDy = tc[1].y - tc[0].y;
      const newRot = Math.atan2(newEdgeDy, newEdgeDx);

      // Derive new width and height from transformed edges
      const newWidth = Math.sqrt(newEdgeDx * newEdgeDx + newEdgeDy * newEdgeDy);
      const sideEdgeDx = tc[3].x - tc[0].x;
      const sideEdgeDy = tc[3].y - tc[0].y;
      const newHeight = Math.sqrt(sideEdgeDx * sideEdgeDx + sideEdgeDy * sideEdgeDy);

      cloned.topLeft = tc[0];
      cloned.width = newWidth;
      cloned.height = newHeight;
      cloned.rotation = newRot;
      break;
    }
    case 'circle':
      cloned.center = transform(cloned.center);
      // For scale, adjust radius
      {
        const edgePt = { x: shape.type === 'circle' ? shape.center.x + shape.radius : 0, y: shape.type === 'circle' ? shape.center.y : 0 };
        const newEdge = transform(edgePt);
        const dx = newEdge.x - cloned.center.x;
        const dy = newEdge.y - cloned.center.y;
        cloned.radius = Math.sqrt(dx * dx + dy * dy);
      }
      break;
    case 'arc':
      cloned.center = transform(cloned.center);
      {
        const startPt = {
          x: (shape as ArcShape).center.x + (shape as ArcShape).radius * Math.cos((shape as ArcShape).startAngle),
          y: (shape as ArcShape).center.y + (shape as ArcShape).radius * Math.sin((shape as ArcShape).startAngle),
        };
        const endPt = {
          x: (shape as ArcShape).center.x + (shape as ArcShape).radius * Math.cos((shape as ArcShape).endAngle),
          y: (shape as ArcShape).center.y + (shape as ArcShape).radius * Math.sin((shape as ArcShape).endAngle),
        };
        const newStart = transform(startPt);
        const newEnd = transform(endPt);
        const dx = newStart.x - cloned.center.x;
        const dy = newStart.y - cloned.center.y;
        cloned.radius = Math.sqrt(dx * dx + dy * dy);
        cloned.startAngle = Math.atan2(newStart.y - cloned.center.y, newStart.x - cloned.center.x);
        cloned.endAngle = Math.atan2(newEnd.y - cloned.center.y, newEnd.x - cloned.center.x);
      }
      break;
    case 'ellipse':
      cloned.center = transform(cloned.center);
      // Simplified: adjust radii via scale factor estimate
      {
        const rPt = { x: (shape as any).center.x + (shape as any).radiusX, y: (shape as any).center.y };
        const newR = transform(rPt);
        const dx = newR.x - cloned.center.x;
        const dy = newR.y - cloned.center.y;
        const newRadiusX = Math.sqrt(dx * dx + dy * dy);
        const ratio = newRadiusX / ((shape as any).radiusX || 1);
        cloned.radiusX = newRadiusX;
        cloned.radiusY = (shape as any).radiusY * ratio;
      }
      break;
    case 'polyline':
      cloned.points = cloned.points.map(transform);
      break;
    case 'spline':
      cloned.points = cloned.points.map(transform);
      break;
    case 'text':
      cloned.position = transform(cloned.position);
      if (cloned.leaderPoints) {
        cloned.leaderPoints = cloned.leaderPoints.map(transform);
      }
      break;
    case 'point':
      cloned.position = transform(cloned.position);
      break;
    case 'hatch':
      cloned.points = cloned.points.map(transform);
      break;
    case 'dimension':
      (cloned as any).points = ((cloned as any).points as Point[]).map(transform);
      break;
  }

  return cloned;
}

/**
 * Apply transform in-place to shape (returns partial updates for updateShapes)
 */
export function getShapeTransformUpdates(shape: Shape, transform: PointTransform): Partial<Shape> {
  const transformed = transformShape(shape, transform, shape.id);
  const { id, type, layerId, drawingId, style, visible, locked, ...geom } = transformed as any;
  return geom;
}

// ============================================================================
// Trim / Extend / Fillet / Offset
// ============================================================================

function lineLineIntersection(
  p1: Point, p2: Point, p3: Point, p4: Point
): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/**
 * Trim a line at the intersection with a cutting edge.
 * keepSide: the point on the line that should be preserved (clicked side).
 */
export function trimLineAtIntersection(
  line: LineShape,
  cuttingEdge: Shape,
  keepSide: Point
): Partial<LineShape> | null {
  let cutStart: Point, cutEnd: Point;
  if (cuttingEdge.type === 'line') {
    cutStart = cuttingEdge.start;
    cutEnd = cuttingEdge.end;
  } else {
    return null; // Only line-line trim for now
  }

  const intersection = lineLineIntersection(line.start, line.end, cutStart, cutEnd);
  if (!intersection) return null;

  // Check intersection is between line endpoints (extended slightly)
  const t = lineParamAt(line.start, line.end, intersection);
  if (t < -0.01 || t > 1.01) return null;

  // Determine which end to keep based on keepSide proximity
  const distToStart = Math.hypot(keepSide.x - line.start.x, keepSide.y - line.start.y);
  const distToEnd = Math.hypot(keepSide.x - line.end.x, keepSide.y - line.end.y);

  if (distToStart < distToEnd) {
    return { start: line.start, end: intersection };
  } else {
    return { start: intersection, end: line.end };
  }
}

function lineParamAt(start: Point, end: Point, pt: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return 0;
  return ((pt.x - start.x) * dx + (pt.y - start.y) * dy) / lenSq;
}

/**
 * Extend a line to a boundary shape.
 */
export function extendLineToBoundary(
  line: LineShape,
  boundary: Shape
): Partial<LineShape> | null {
  let bStart: Point, bEnd: Point;
  if (boundary.type === 'line') {
    bStart = boundary.start;
    bEnd = boundary.end;
  } else {
    return null; // Only line-line extend for now
  }

  // Extend the line (as infinite) to find intersection with boundary
  const intersection = lineLineIntersection(line.start, line.end, bStart, bEnd);
  if (!intersection) return null;

  // Check intersection is on the boundary segment
  const tBound = lineParamAt(bStart, bEnd, intersection);
  if (tBound < -0.01 || tBound > 1.01) return null;

  // Extend from the nearer endpoint
  const distToStart = Math.hypot(intersection.x - line.start.x, intersection.y - line.start.y);
  const distToEnd = Math.hypot(intersection.x - line.end.x, intersection.y - line.end.y);

  if (distToStart < distToEnd) {
    return { start: intersection, end: line.end };
  } else {
    return { start: line.start, end: intersection };
  }
}

/**
 * Create a fillet arc between two lines.
 * Returns the fillet arc shape data and the trimmed line updates.
 */
export function filletTwoLines(
  line1: LineShape,
  line2: LineShape,
  radius: number
): { arc: { center: Point; radius: number; startAngle: number; endAngle: number }; line1Update: Partial<LineShape>; line2Update: Partial<LineShape> } | null {
  const intersection = lineLineIntersection(line1.start, line1.end, line2.start, line2.end);
  if (!intersection) return null;
  if (radius <= 0) return null;

  // Direction vectors of each line
  const d1x = line1.end.x - line1.start.x;
  const d1y = line1.end.y - line1.start.y;
  const len1 = Math.hypot(d1x, d1y);
  const d2x = line2.end.x - line2.start.x;
  const d2y = line2.end.y - line2.start.y;
  const len2 = Math.hypot(d2x, d2y);

  if (len1 < 1e-10 || len2 < 1e-10) return null;

  const u1 = { x: d1x / len1, y: d1y / len1 };
  const u2 = { x: d2x / len2, y: d2y / len2 };

  // Half angle between lines
  const dot = u1.x * u2.x + u1.y * u2.y;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const halfAngle = angle / 2;
  if (Math.abs(Math.sin(halfAngle)) < 1e-10) return null;

  const dist = radius / Math.tan(halfAngle);

  // Direction from intersection toward line endpoints (away from intersection)
  const t1s = lineParamAt(line1.start, line1.end, intersection);
  const dir1 = t1s > 0.5 ? -1 : 1;
  const t2s = lineParamAt(line2.start, line2.end, intersection);
  const dir2 = t2s > 0.5 ? -1 : 1;

  // Tangent points
  const tan1: Point = {
    x: intersection.x + dir1 * u1.x * dist,
    y: intersection.y + dir1 * u1.y * dist,
  };
  const tan2: Point = {
    x: intersection.x + dir2 * u2.x * dist,
    y: intersection.y + dir2 * u2.y * dist,
  };

  // Normals (perpendicular, toward center)
  const cross = u1.x * u2.y - u1.y * u2.x;
  const side = cross > 0 ? 1 : -1;
  const n1 = { x: -u1.y * side, y: u1.x * side };

  const center: Point = {
    x: tan1.x + n1.x * radius,
    y: tan1.y + n1.y * radius,
  };

  const startAngle = Math.atan2(tan1.y - center.y, tan1.x - center.x);
  const endAngle = Math.atan2(tan2.y - center.y, tan2.x - center.x);

  // Trim lines to tangent points
  const line1Update: Partial<LineShape> = {};
  const line2Update: Partial<LineShape> = {};

  const d1toStart = Math.hypot(tan1.x - line1.start.x, tan1.y - line1.start.y);
  const d1toEnd = Math.hypot(tan1.x - line1.end.x, tan1.y - line1.end.y);
  if (d1toStart < d1toEnd) {
    line1Update.end = tan1;
  } else {
    line1Update.start = tan1;
  }

  const d2toStart = Math.hypot(tan2.x - line2.start.x, tan2.y - line2.start.y);
  const d2toEnd = Math.hypot(tan2.x - line2.end.x, tan2.y - line2.end.y);
  if (d2toStart < d2toEnd) {
    line2Update.end = tan2;
  } else {
    line2Update.start = tan2;
  }

  return {
    arc: { center, radius, startAngle, endAngle },
    line1Update,
    line2Update,
  };
}

/**
 * Create a chamfer (straight line) between two lines.
 * Returns the chamfer line segment and the trimmed line updates.
 */
export function chamferTwoLines(
  line1: LineShape,
  line2: LineShape,
  dist1: number,
  dist2: number
): { lineSegment: { start: Point; end: Point }; line1Update: Partial<LineShape>; line2Update: Partial<LineShape> } | null {
  const intersection = lineLineIntersection(line1.start, line1.end, line2.start, line2.end);
  if (!intersection) return null;

  // Direction vectors of each line
  const d1x = line1.end.x - line1.start.x;
  const d1y = line1.end.y - line1.start.y;
  const len1 = Math.hypot(d1x, d1y);
  const d2x = line2.end.x - line2.start.x;
  const d2y = line2.end.y - line2.start.y;
  const len2 = Math.hypot(d2x, d2y);

  if (len1 < 1e-10 || len2 < 1e-10) return null;

  const u1 = { x: d1x / len1, y: d1y / len1 };
  const u2 = { x: d2x / len2, y: d2y / len2 };

  // Direction from intersection toward line endpoints (away from intersection)
  const t1s = lineParamAt(line1.start, line1.end, intersection);
  const dir1 = t1s > 0.5 ? -1 : 1;
  const t2s = lineParamAt(line2.start, line2.end, intersection);
  const dir2 = t2s > 0.5 ? -1 : 1;

  // Chamfer points at dist1 along line1 and dist2 along line2 from intersection
  const cp1: Point = {
    x: intersection.x + dir1 * u1.x * dist1,
    y: intersection.y + dir1 * u1.y * dist1,
  };
  const cp2: Point = {
    x: intersection.x + dir2 * u2.x * dist2,
    y: intersection.y + dir2 * u2.y * dist2,
  };

  // Trim lines to chamfer points
  const line1Update: Partial<LineShape> = {};
  const line2Update: Partial<LineShape> = {};

  const d1toStart = Math.hypot(cp1.x - line1.start.x, cp1.y - line1.start.y);
  const d1toEnd = Math.hypot(cp1.x - line1.end.x, cp1.y - line1.end.y);
  if (d1toStart < d1toEnd) {
    line1Update.end = cp1;
  } else {
    line1Update.start = cp1;
  }

  const d2toStart = Math.hypot(cp2.x - line2.start.x, cp2.y - line2.start.y);
  const d2toEnd = Math.hypot(cp2.x - line2.end.x, cp2.y - line2.end.y);
  if (d2toStart < d2toEnd) {
    line2Update.end = cp2;
  } else {
    line2Update.start = cp2;
  }

  return {
    lineSegment: { start: cp1, end: cp2 },
    line1Update,
    line2Update,
  };
}

/**
 * Offset a shape by a given distance on a given side.
 * Returns a new shape (deep-cloned with new ID).
 */
export function offsetShape(shape: Shape, distance: number, cursorPos: Point): Shape | null {
  const cloned: Shape = JSON.parse(JSON.stringify(shape));
  (cloned as any).id = generateId();

  switch (cloned.type) {
    case 'line': {
      const dx = cloned.end.x - cloned.start.x;
      const dy = cloned.end.y - cloned.start.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-10) return null;
      const nx = -dy / len;
      const ny = dx / len;
      // Determine side from cursor
      const midX = (cloned.start.x + cloned.end.x) / 2;
      const midY = (cloned.start.y + cloned.end.y) / 2;
      const dotSide = (cursorPos.x - midX) * nx + (cursorPos.y - midY) * ny;
      const sign = dotSide >= 0 ? 1 : -1;
      cloned.start = { x: cloned.start.x + nx * distance * sign, y: cloned.start.y + ny * distance * sign };
      cloned.end = { x: cloned.end.x + nx * distance * sign, y: cloned.end.y + ny * distance * sign };
      return cloned;
    }
    case 'circle': {
      const dToCenter = Math.hypot(cursorPos.x - cloned.center.x, cursorPos.y - cloned.center.y);
      if (dToCenter > cloned.radius) {
        cloned.radius += distance;
      } else {
        cloned.radius = Math.max(0.1, cloned.radius - distance);
      }
      return cloned;
    }
    case 'arc': {
      const dToCenter = Math.hypot(cursorPos.x - cloned.center.x, cursorPos.y - cloned.center.y);
      if (dToCenter > cloned.radius) {
        cloned.radius += distance;
      } else {
        cloned.radius = Math.max(0.1, cloned.radius - distance);
      }
      return cloned;
    }
    case 'ellipse': {
      const dToCenter = Math.hypot(cursorPos.x - cloned.center.x, cursorPos.y - cloned.center.y);
      const avgRadius = (cloned.radiusX + cloned.radiusY) / 2;
      if (dToCenter > avgRadius) {
        cloned.radiusX += distance;
        cloned.radiusY += distance;
      } else {
        cloned.radiusX = Math.max(0.1, cloned.radiusX - distance);
        cloned.radiusY = Math.max(0.1, cloned.radiusY - distance);
      }
      return cloned;
    }
    default:
      return null;
  }
}
