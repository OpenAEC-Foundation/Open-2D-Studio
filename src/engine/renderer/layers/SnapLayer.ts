/**
 * SnapLayer - Renders snap point indicators and labels
 */

import type { Viewport, SnapPoint, SnapType } from '../types';
import { BaseRenderer } from '../core/BaseRenderer';
import { SNAP_COLORS, SNAP_LABELS } from '../types';

export class SnapLayer extends BaseRenderer {
  /**
   * Draw snap point indicator in world coordinates
   */
  drawSnapIndicator(snapPoint: SnapPoint, viewport: Viewport): void {
    const ctx = this.ctx;
    const { point, type } = snapPoint;
    const size = 8 / viewport.zoom;

    ctx.save();
    ctx.strokeStyle = this.getSnapColor(type);
    ctx.fillStyle = this.getSnapColor(type);
    ctx.lineWidth = 1.5 / viewport.zoom;

    switch (type) {
      case 'endpoint':
        // Square marker
        ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
        break;

      case 'midpoint':
        // Triangle marker
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - size / 2);
        ctx.lineTo(point.x - size / 2, point.y + size / 2);
        ctx.lineTo(point.x + size / 2, point.y + size / 2);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'center':
        // Circle marker
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'intersection':
        // X marker
        ctx.beginPath();
        ctx.moveTo(point.x - size / 2, point.y - size / 2);
        ctx.lineTo(point.x + size / 2, point.y + size / 2);
        ctx.moveTo(point.x + size / 2, point.y - size / 2);
        ctx.lineTo(point.x - size / 2, point.y + size / 2);
        ctx.stroke();
        break;

      case 'perpendicular':
        // Perpendicular symbol (L rotated)
        ctx.beginPath();
        ctx.moveTo(point.x - size / 2, point.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineTo(point.x, point.y - size / 2);
        ctx.stroke();
        // Small square in corner
        const cornerSize = size / 4;
        ctx.strokeRect(point.x - cornerSize, point.y - cornerSize, cornerSize, cornerSize);
        break;

      case 'tangent':
        // Circle with line
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(point.x - size / 2, point.y + size / 3);
        ctx.lineTo(point.x + size / 2, point.y + size / 3);
        ctx.stroke();
        break;

      case 'nearest':
        // Diamond marker
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - size / 2);
        ctx.lineTo(point.x + size / 2, point.y);
        ctx.lineTo(point.x, point.y + size / 2);
        ctx.lineTo(point.x - size / 2, point.y);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'grid':
        // Plus marker
        ctx.beginPath();
        ctx.moveTo(point.x - size / 2, point.y);
        ctx.lineTo(point.x + size / 2, point.y);
        ctx.moveTo(point.x, point.y - size / 2);
        ctx.lineTo(point.x, point.y + size / 2);
        ctx.stroke();
        break;

      case 'parallel':
        // Two parallel lines marker
        ctx.beginPath();
        ctx.moveTo(point.x - size / 2, point.y - size / 4);
        ctx.lineTo(point.x + size / 2, point.y - size / 4);
        ctx.moveTo(point.x - size / 2, point.y + size / 4);
        ctx.lineTo(point.x + size / 2, point.y + size / 4);
        ctx.stroke();
        break;

      default:
        // Small filled circle as fallback
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 4, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  /**
   * Draw snap label in screen coordinates
   */
  drawSnapLabel(snapPoint: SnapPoint, viewport: Viewport): void {
    const ctx = this.ctx;
    const { point, type } = snapPoint;

    // Convert world point to screen coordinates
    const screen = this.worldToScreen(point, viewport);

    ctx.save();
    this.resetTransform();

    // Draw label background
    const label = this.getSnapLabel(type);
    ctx.font = '11px Arial, sans-serif';
    const metrics = ctx.measureText(label);
    const padding = 4;
    const labelX = screen.x + 12;
    const labelY = screen.y - 12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(labelX - padding, labelY - 11, metrics.width + padding * 2, 14);

    // Draw label text
    ctx.fillStyle = this.getSnapColor(type);
    ctx.fillText(label, labelX, labelY);

    ctx.restore();
  }

  /**
   * Get snap color
   */
  getSnapColor(type: SnapType): string {
    return SNAP_COLORS[type] || '#ffffff';
  }

  /**
   * Get snap label
   */
  getSnapLabel(type: SnapType): string {
    return SNAP_LABELS[type] || type;
  }
}
