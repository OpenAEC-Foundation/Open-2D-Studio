/**
 * TrackingLayer - Renders polar/object tracking lines and labels
 */

import type { Viewport, Point, TrackingLine } from '../types';
import { BaseRenderer } from '../core/BaseRenderer';
import { getTrackingLineColor } from '../../geometry/Tracking';
import type { UnitSettings } from '../../../units/types';
import { formatNumber } from '../../../units/format';

export class TrackingLayer extends BaseRenderer {
  /**
   * Draw tracking lines
   */
  drawTrackingLines(
    trackingLines: TrackingLine[],
    trackingPoint: Point | null | undefined,
    viewport: Viewport
  ): void {
    const ctx = this.ctx;

    // Calculate max distance for tracking line extension
    const maxDistance = Math.max(this.width, this.height) / viewport.zoom * 2;

    ctx.save();

    for (const line of trackingLines) {
      const color = getTrackingLineColor(line.type);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / viewport.zoom;
      ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);

      // Draw the tracking line extending from origin
      ctx.beginPath();
      ctx.moveTo(line.origin.x, line.origin.y);

      // Extend line in the direction
      const endX = line.origin.x + line.direction.x * maxDistance;
      const endY = line.origin.y + line.direction.y * maxDistance;
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw small circle at origin point
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(line.origin.x, line.origin.y, 3 / viewport.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw tracking point marker if we have one
    if (trackingPoint) {
      this.drawTrackingPointMarker(trackingPoint, viewport);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Draw tracking point marker
   */
  private drawTrackingPointMarker(trackingPoint: Point, viewport: Viewport): void {
    const ctx = this.ctx;

    ctx.setLineDash([]);
    ctx.strokeStyle = '#00ffff';
    ctx.fillStyle = '#00ffff';
    ctx.lineWidth = 2 / viewport.zoom;

    // Draw crosshair at tracking point
    const size = 8 / viewport.zoom;
    ctx.beginPath();
    ctx.moveTo(trackingPoint.x - size, trackingPoint.y);
    ctx.lineTo(trackingPoint.x + size, trackingPoint.y);
    ctx.moveTo(trackingPoint.x, trackingPoint.y - size);
    ctx.lineTo(trackingPoint.x, trackingPoint.y + size);
    ctx.stroke();

    // Draw small circle
    ctx.beginPath();
    ctx.arc(trackingPoint.x, trackingPoint.y, 4 / viewport.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Draw tracking label in screen coordinates
   */
  drawTrackingLabel(
    trackingLines: TrackingLine[],
    trackingPoint: Point,
    viewport: Viewport,
    unitSettings?: UnitSettings
  ): void {
    if (trackingLines.length === 0) return;

    const ctx = this.ctx;
    const line = trackingLines[0];

    // Convert world point to screen coordinates
    const screen = this.worldToScreen(trackingPoint, viewport);

    ctx.save();
    this.resetTransform();

    // Build label text
    let label = '';
    const angleDeg = ((line.angle * 180) / Math.PI + 360) % 360;

    switch (line.type) {
      case 'polar':
        label = unitSettings
          ? `Polar: ${formatNumber(angleDeg, 0, unitSettings.numberFormat)}°`
          : `Polar: ${angleDeg.toFixed(0)}°`;
        break;
      case 'parallel':
        label = 'Parallel';
        break;
      case 'perpendicular':
        label = 'Perpendicular';
        break;
      case 'extension':
        label = 'Extension';
        break;
    }

    // Draw label background
    ctx.font = '11px Arial, sans-serif';
    const metrics = ctx.measureText(label);
    const padding = 4;
    const labelX = screen.x + 15;
    const labelY = screen.y + 15;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(labelX - padding, labelY - 11, metrics.width + padding * 2, 14);

    // Draw label text
    ctx.fillStyle = getTrackingLineColor(line.type);
    ctx.fillText(label, labelX, labelY);

    ctx.restore();
  }
}
