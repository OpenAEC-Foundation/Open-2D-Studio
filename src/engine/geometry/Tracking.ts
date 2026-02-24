/**
 * Tracking System - Polar tracking and object tracking
 * Enables drawing lines aligned with existing geometry
 */

import { IPoint, PointUtils } from './Point';
import { ILine, LineUtils } from './Line';
import type { UnitSettings } from '../../units/types';
import { formatNumber } from '../../units/format';

export type TrackingMode = 'polar' | 'ortho' | 'object';

export interface TrackingLine {
  origin: IPoint;
  direction: IPoint;
  angle: number;
  type: 'polar' | 'parallel' | 'perpendicular' | 'extension';
  sourceShapeId?: string;
}

export interface TrackingResult {
  point: IPoint;
  trackingLines: TrackingLine[];
  snapDescription?: string;
}

export interface TrackingSettings {
  enabled: boolean;
  polarEnabled: boolean;
  orthoEnabled: boolean;
  objectTrackingEnabled: boolean;
  parallelTrackingEnabled: boolean;
  perpendicularTrackingEnabled: boolean;
  polarAngleIncrement: number; // degrees (15, 30, 45, 90)
  trackingTolerance: number; // pixels
  /** Source angle from snapped shape (for perpendicular/parallel tracking from snap point) */
  sourceSnapAngle?: number;
}

export const defaultTrackingSettings: TrackingSettings = {
  enabled: true,
  polarEnabled: true,
  orthoEnabled: false,
  objectTrackingEnabled: true,
  parallelTrackingEnabled: false,  // Respects snap settings - disabled by default
  perpendicularTrackingEnabled: false,  // Respects snap settings - disabled by default
  polarAngleIncrement: 45,
  trackingTolerance: 10,
};

/**
 * Find tracking alignments from a base point
 */
export function findPolarTrackingLines(
  basePoint: IPoint,
  angleIncrement: number = 45
): TrackingLine[] {
  const lines: TrackingLine[] = [];
  const incrementRad = (angleIncrement * Math.PI) / 180;
  const numAngles = Math.floor(360 / angleIncrement);

  for (let i = 0; i < numAngles; i++) {
    const angle = i * incrementRad;
    lines.push({
      origin: basePoint,
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      angle: angle,
      type: 'polar',
    });
  }

  return lines;
}

/**
 * Find tracking lines from a snapped source angle (perpendicular and parallel to snapped edge)
 * This is used when the user snaps to a beam/line edge and wants to draw perpendicular to it
 */
export function findSourceAngleTrackingLines(
  basePoint: IPoint,
  sourceAngle: number
): TrackingLine[] {
  const lines: TrackingLine[] = [];

  // Parallel to source (same direction as snapped edge)
  const parallelDir = { x: Math.cos(sourceAngle), y: Math.sin(sourceAngle) };
  lines.push({
    origin: basePoint,
    direction: parallelDir,
    angle: sourceAngle,
    type: 'parallel',
  });

  // Opposite parallel direction
  lines.push({
    origin: basePoint,
    direction: { x: -parallelDir.x, y: -parallelDir.y },
    angle: sourceAngle + Math.PI,
    type: 'parallel',
  });

  // Perpendicular to source (90 degrees from snapped edge)
  const perpAngle = sourceAngle + Math.PI / 2;
  const perpDir = { x: Math.cos(perpAngle), y: Math.sin(perpAngle) };
  lines.push({
    origin: basePoint,
    direction: perpDir,
    angle: perpAngle,
    type: 'perpendicular',
  });

  // Opposite perpendicular direction
  lines.push({
    origin: basePoint,
    direction: { x: -perpDir.x, y: -perpDir.y },
    angle: perpAngle + Math.PI,
    type: 'perpendicular',
  });

  return lines;
}

/**
 * Find tracking lines from existing shapes (parallel and perpendicular)
 */
export function findObjectTrackingLines(
  basePoint: IPoint,
  shapes: Array<{ id: string; type: string; start?: IPoint; end?: IPoint }>,
  tolerance: number = 50,
  includeParallel: boolean = true,
  includePerpendicular: boolean = true
): TrackingLine[] {
  const lines: TrackingLine[] = [];

  for (const shape of shapes) {
    // Handle both lines and beams (beams have start/end centerline like lines)
    if ((shape.type === 'line' || shape.type === 'beam') && shape.start && shape.end) {
      const line: ILine = { start: shape.start, end: shape.end };
      const dir = LineUtils.direction(line);
      const perpDir = LineUtils.perpendicularDirection(line);

      // Add parallel tracking lines if enabled
      if (includeParallel) {
        lines.push({
          origin: basePoint,
          direction: dir,
          angle: Math.atan2(dir.y, dir.x),
          type: 'parallel',
          sourceShapeId: shape.id,
        });

        // Add opposite parallel direction
        lines.push({
          origin: basePoint,
          direction: { x: -dir.x, y: -dir.y },
          angle: Math.atan2(-dir.y, -dir.x),
          type: 'parallel',
          sourceShapeId: shape.id,
        });
      }

      // Add perpendicular tracking lines if enabled
      if (includePerpendicular) {
        lines.push({
          origin: basePoint,
          direction: perpDir,
          angle: Math.atan2(perpDir.y, perpDir.x),
          type: 'perpendicular',
          sourceShapeId: shape.id,
        });

        // Add opposite perpendicular direction
        lines.push({
          origin: basePoint,
          direction: { x: -perpDir.x, y: -perpDir.y },
          angle: Math.atan2(-perpDir.y, -perpDir.x),
          type: 'perpendicular',
          sourceShapeId: shape.id,
        });
      }

      // Extension tracking from endpoints (always include if object tracking is on)
      const distToStart = PointUtils.distance(basePoint, shape.start);
      const distToEnd = PointUtils.distance(basePoint, shape.end);

      if (distToStart < tolerance) {
        lines.push({
          origin: shape.start,
          direction: { x: -dir.x, y: -dir.y },
          angle: Math.atan2(-dir.y, -dir.x),
          type: 'extension',
          sourceShapeId: shape.id,
        });
      }

      if (distToEnd < tolerance) {
        lines.push({
          origin: shape.end,
          direction: dir,
          angle: Math.atan2(dir.y, dir.x),
          type: 'extension',
          sourceShapeId: shape.id,
        });
      }
    }
  }

  return lines;
}

/**
 * Find the closest point on any tracking line to the cursor
 */
export function findTrackingPoint(
  cursor: IPoint,
  trackingLines: TrackingLine[],
  tolerance: number
): TrackingResult | null {
  let closestResult: TrackingResult | null = null;
  let closestDistance = tolerance;

  for (const trackingLine of trackingLines) {
    // Create an infinite line from origin in the tracking direction
    const lineEnd = PointUtils.add(
      trackingLine.origin,
      PointUtils.multiply(trackingLine.direction, 10000)
    );
    const line: ILine = { start: trackingLine.origin, end: lineEnd };

    // Get the closest point on this tracking line
    const closestPoint = LineUtils.closestPointOnLine(line, cursor);

    // Only consider points in the positive direction from origin
    const toCursor = PointUtils.subtract(closestPoint, trackingLine.origin);
    const dotProduct = PointUtils.dot(toCursor, trackingLine.direction);

    if (dotProduct < 0) continue; // Point is in opposite direction

    const distance = PointUtils.distance(cursor, closestPoint);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestResult = {
        point: closestPoint,
        trackingLines: [trackingLine],
        snapDescription: getTrackingDescription(trackingLine),
      };
    }
  }

  return closestResult;
}

/**
 * Find intersection of tracking lines (when multiple align)
 */
export function findTrackingIntersections(
  cursor: IPoint,
  trackingLines: TrackingLine[],
  tolerance: number
): TrackingResult | null {
  const activeLines: TrackingLine[] = [];

  // Find all tracking lines that the cursor is close to
  for (const trackingLine of trackingLines) {
    const lineEnd = PointUtils.add(
      trackingLine.origin,
      PointUtils.multiply(trackingLine.direction, 10000)
    );
    const line: ILine = { start: trackingLine.origin, end: lineEnd };
    const distance = LineUtils.distanceToLine(line, cursor);

    if (distance < tolerance) {
      // Check if in positive direction
      const closestPoint = LineUtils.closestPointOnLine(line, cursor);
      const toCursor = PointUtils.subtract(closestPoint, trackingLine.origin);
      const dotProduct = PointUtils.dot(toCursor, trackingLine.direction);

      if (dotProduct >= 0) {
        activeLines.push(trackingLine);
      }
    }
  }

  if (activeLines.length < 2) return null;

  // Find intersection of the first two active lines
  const line1End = PointUtils.add(
    activeLines[0].origin,
    PointUtils.multiply(activeLines[0].direction, 10000)
  );
  const line2End = PointUtils.add(
    activeLines[1].origin,
    PointUtils.multiply(activeLines[1].direction, 10000)
  );

  const intersection = LineUtils.lineIntersection(
    { start: activeLines[0].origin, end: line1End },
    { start: activeLines[1].origin, end: line2End }
  );

  if (intersection && PointUtils.distance(cursor, intersection) < tolerance * 2) {
    return {
      point: intersection,
      trackingLines: activeLines.slice(0, 2),
      snapDescription: 'Intersection',
    };
  }

  return null;
}

/**
 * Main tracking function - combines all tracking methods
 */
export function applyTracking(
  cursor: IPoint,
  basePoint: IPoint | null,
  shapes: Array<{ id: string; type: string; start?: IPoint; end?: IPoint }>,
  settings: TrackingSettings
): TrackingResult | null {
  if (!settings.enabled || !basePoint) return null;

  const allTrackingLines: TrackingLine[] = [];

  // Add polar tracking lines
  if (settings.polarEnabled || settings.orthoEnabled) {
    const increment = settings.orthoEnabled ? 90 : settings.polarAngleIncrement;
    allTrackingLines.push(...findPolarTrackingLines(basePoint, increment));
  }

  // Add tracking lines from source snap angle (perpendicular/parallel to snapped edge)
  // Check these FIRST with higher priority - if cursor is near perpendicular/parallel to
  // the source edge, use those tracking lines immediately
  // Only add if the respective tracking type is enabled
  if (settings.sourceSnapAngle !== undefined &&
      (settings.parallelTrackingEnabled || settings.perpendicularTrackingEnabled)) {
    const allSourceAngleLines = findSourceAngleTrackingLines(basePoint, settings.sourceSnapAngle);

    // Filter based on enabled tracking types
    const sourceAngleLines = allSourceAngleLines.filter(line => {
      if (line.type === 'parallel') return settings.parallelTrackingEnabled;
      if (line.type === 'perpendicular') return settings.perpendicularTrackingEnabled;
      return true;
    });

    if (sourceAngleLines.length > 0) {
      // Check if cursor is close to any source angle tracking line with wider tolerance
      const sourceAngleTolerance = settings.trackingTolerance * 1.5; // Slightly wider tolerance
      const sourceResult = findTrackingPoint(cursor, sourceAngleLines, sourceAngleTolerance);
      if (sourceResult) {
        return sourceResult; // Perpendicular/parallel to source takes priority
      }

      // Also add to general tracking lines for intersection detection
      allTrackingLines.push(...sourceAngleLines);
    }
  }

  // Add object tracking lines (parallel/perpendicular to existing shapes)
  if (settings.objectTrackingEnabled) {
    allTrackingLines.push(
      ...findObjectTrackingLines(
        basePoint,
        shapes,
        settings.trackingTolerance * 5,
        settings.parallelTrackingEnabled,
        settings.perpendicularTrackingEnabled
      )
    );
  }

  // First check for intersections of tracking lines
  const intersection = findTrackingIntersections(
    cursor,
    allTrackingLines,
    settings.trackingTolerance
  );
  if (intersection) return intersection;

  // Then find closest single tracking line
  return findTrackingPoint(cursor, allTrackingLines, settings.trackingTolerance);
}

/**
 * Get human-readable description of tracking type
 */
function getTrackingDescription(line: TrackingLine, unitSettings?: UnitSettings): string {
  const angleDeg = ((line.angle * 180) / Math.PI + 360) % 360;

  switch (line.type) {
    case 'polar':
      return unitSettings
        ? `Polar: ${formatNumber(angleDeg, 0, unitSettings.numberFormat)}°`
        : `Polar: ${angleDeg.toFixed(0)}°`;
    case 'parallel':
      return 'Parallel';
    case 'perpendicular':
      return 'Perpendicular';
    case 'extension':
      return 'Extension';
    default:
      return '';
  }
}

/**
 * Get tracking line color for rendering
 */
export function getTrackingLineColor(type: TrackingLine['type']): string {
  switch (type) {
    case 'polar':
      return '#00ff88';
    case 'parallel':
      return '#ff8800';
    case 'perpendicular':
      return '#00aaff';
    case 'extension':
      return '#ffff00';
    default:
      return '#ffffff';
  }
}
