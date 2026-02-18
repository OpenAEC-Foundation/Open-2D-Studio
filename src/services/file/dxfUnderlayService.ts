/**
 * DXF Underlay Service — Rasterizes DXF shapes into a single PNG image.
 *
 * Used for large DXF files that would be too slow to render as individual shapes.
 * The result is a single ImageShape rendered as a background underlay.
 */

import type { Shape } from '../../types/geometry';
import { getShapeBounds } from '../../engine/geometry/GeometryUtils';
import { ShapeRenderer } from '../../engine/renderer/core/ShapeRenderer';

export interface RasterizeResult {
  dataUrl: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Compute the combined bounding box of all shapes.
 */
function computeShapesBounds(shapes: Shape[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  for (const shape of shapes) {
    const b = getShapeBounds(shape);
    if (!b) continue;
    found = true;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  return found ? { minX, minY, maxX, maxY } : null;
}

/**
 * Rasterize an array of shapes to a PNG data URL.
 *
 * @param shapes      The parsed DXF shapes
 * @param maxResolution  Maximum pixel size for the longest side (default 4096)
 * @returns RasterizeResult or null if no shapes have valid bounds
 */
export function rasterizeDxfShapes(
  shapes: Shape[],
  maxResolution: number = 4096,
): RasterizeResult | null {
  const bounds = computeShapesBounds(shapes);
  if (!bounds) return null;

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  if (worldW <= 0 || worldH <= 0) return null;

  // Calculate pixel dimensions (fit within maxResolution, maintain aspect ratio)
  let pixelWidth: number;
  let pixelHeight: number;
  if (worldW >= worldH) {
    pixelWidth = Math.min(maxResolution, Math.ceil(worldW));
    pixelHeight = Math.max(1, Math.round(pixelWidth * (worldH / worldW)));
  } else {
    pixelHeight = Math.min(maxResolution, Math.ceil(worldH));
    pixelWidth = Math.max(1, Math.round(pixelHeight * (worldW / worldH)));
  }

  // Clamp to maxResolution
  if (pixelWidth > maxResolution) {
    pixelHeight = Math.max(1, Math.round(pixelHeight * (maxResolution / pixelWidth)));
    pixelWidth = maxResolution;
  }
  if (pixelHeight > maxResolution) {
    pixelWidth = Math.max(1, Math.round(pixelWidth * (maxResolution / pixelHeight)));
    pixelHeight = maxResolution;
  }

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  // Set up transform: world coords → pixel coords
  // Scale so that (minX,minY)→(0,0) and (maxX,maxY)→(pixelWidth,pixelHeight)
  const scaleX = pixelWidth / worldW;
  const scaleY = pixelHeight / worldH;
  // Y-axis in CAD is usually up (positive), but canvas Y is down.
  // DXF shapes use screen coords (Y down) after parsing, so we just translate.
  ctx.setTransform(scaleX, 0, 0, scaleY, -bounds.minX * scaleX, -bounds.minY * scaleY);

  // Create a ShapeRenderer to draw shapes (dpr=1 for offscreen)
  const shapeRenderer = new ShapeRenderer(ctx, pixelWidth, pixelHeight, 1);

  // Draw all shapes (not selected, not hovered, don't invert colors)
  for (const shape of shapes) {
    if (!shape.visible) continue;
    try {
      shapeRenderer.drawShape(shape, false, false, false);
    } catch {
      // Skip shapes that fail to render (e.g. unsupported types)
    }
  }

  const dataUrl = canvas.toDataURL('image/png');

  return { dataUrl, bounds, pixelWidth, pixelHeight };
}
