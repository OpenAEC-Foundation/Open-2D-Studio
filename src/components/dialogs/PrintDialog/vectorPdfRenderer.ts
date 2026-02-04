/**
 * Vector PDF Renderer - Renders shapes using jsPDF's native vector drawing primitives
 *
 * This produces crisp, scalable vector output instead of raster images.
 */

import type { jsPDF } from 'jspdf';
import type { Shape, Point, LineStyle, HatchShape } from '../../../types/geometry';
import type { DimensionShape } from '../../../types/dimension';
import type { PrintAppearance } from '../../../state/slices/uiSlice';
import type { CustomHatchPattern, LineFamily } from '../../../types/hatch';
import { catmullRomToBezier } from '../../../engine/geometry/SplineUtils';
import { bulgeToArc } from '../../../engine/geometry/GeometryUtils';
import { BUILTIN_PATTERNS, isSvgHatchPattern } from '../../../types/hatch';

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle various formats
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Convert color to grayscale
 */
function toGrayscale(color: string): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgb(color);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return { r: gray, g: gray, b: gray };
}

/**
 * Convert color to black or white based on brightness
 */
function toBlackLines(color: string): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgb(color);
  const brightness = (r + g + b) / 3;
  return brightness > 240 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
}

/**
 * Transform color based on appearance mode
 */
function transformColor(
  color: string,
  appearance: PrintAppearance,
  invertWhite: boolean
): { r: number; g: number; b: number } {
  let c = color;
  if (invertWhite && c.toLowerCase() === '#ffffff') {
    c = '#000000';
  }
  switch (appearance) {
    case 'grayscale':
      return toGrayscale(c);
    case 'blackLines':
      return toBlackLines(c);
    default:
      return hexToRgb(c);
  }
}

// ============================================================================
// Arc to Bezier Conversion
// ============================================================================

interface BezierCurve {
  cp1: Point;
  cp2: Point;
  end: Point;
}

/**
 * Convert an arc to cubic bezier curves
 * Splits arcs > 90 degrees into multiple segments for accuracy
 */
function arcToCubicBezier(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean = false
): BezierCurve[] {
  const curves: BezierCurve[] = [];

  // Normalize angles
  let sa = startAngle;
  let ea = endAngle;

  // Calculate sweep angle
  let sweep: number;
  if (counterClockwise) {
    sweep = sa - ea;
    if (sweep <= 0) sweep += Math.PI * 2;
  } else {
    sweep = ea - sa;
    if (sweep <= 0) sweep += Math.PI * 2;
  }

  // Split into 90-degree (PI/2) max segments
  const maxSegmentAngle = Math.PI / 2;
  const numSegments = Math.ceil(sweep / maxSegmentAngle);
  const segmentAngle = sweep / numSegments;

  let currentAngle = sa;

  for (let i = 0; i < numSegments; i++) {
    const nextAngle = counterClockwise
      ? currentAngle - segmentAngle
      : currentAngle + segmentAngle;

    const curve = arcSegmentToBezier(cx, cy, radius, currentAngle, nextAngle);
    curves.push(curve);

    currentAngle = nextAngle;
  }

  return curves;
}

/**
 * Convert a single arc segment (max 90 degrees) to a cubic bezier
 * Uses the formula: k = (4/3) * tan(angle/4)
 */
function arcSegmentToBezier(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): BezierCurve {
  const angle = endAngle - startAngle;
  const k = (4 / 3) * Math.tan(angle / 4);

  // Start point
  const sx = cx + radius * Math.cos(startAngle);
  const sy = cy + radius * Math.sin(startAngle);

  // End point
  const ex = cx + radius * Math.cos(endAngle);
  const ey = cy + radius * Math.sin(endAngle);

  // Control point 1: perpendicular to radius at start
  const cp1x = sx - k * radius * Math.sin(startAngle);
  const cp1y = sy + k * radius * Math.cos(startAngle);

  // Control point 2: perpendicular to radius at end (opposite direction)
  const cp2x = ex + k * radius * Math.sin(endAngle);
  const cp2y = ey - k * radius * Math.cos(endAngle);

  return {
    cp1: { x: cp1x, y: cp1y },
    cp2: { x: cp2x, y: cp2y },
    end: { x: ex, y: ey },
  };
}

/**
 * Convert ellipse arc to bezier curves (handles rotation)
 */
function ellipseArcToBezier(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  startAngle: number,
  endAngle: number
): BezierCurve[] {
  // Generate bezier for unit circle, then scale and rotate
  const curves = arcToCubicBezier(0, 0, 1, startAngle, endAngle);

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return curves.map(curve => {
    const transform = (p: Point): Point => {
      // Scale by radii
      const sx = p.x * rx;
      const sy = p.y * ry;
      // Rotate
      const rotX = sx * cos - sy * sin;
      const rotY = sx * sin + sy * cos;
      // Translate
      return { x: cx + rotX, y: cy + rotY };
    };

    return {
      cp1: transform(curve.cp1),
      cp2: transform(curve.cp2),
      end: transform(curve.end),
    };
  });
}

// ============================================================================
// Render Options
// ============================================================================

export interface VectorRenderOptions {
  scale: number;
  offsetX: number;
  offsetY: number;
  appearance: PrintAppearance;
  plotLineweights: boolean;
  minLineWidthMM?: number;
  customPatterns?: CustomHatchPattern[];
}

// ============================================================================
// Style Setup
// ============================================================================

/**
 * Set line dash pattern on jsPDF document
 */
function setLineDash(doc: jsPDF, lineStyle: LineStyle, scale: number): void {
  // jsPDF uses setLineDashPattern(dashArray, dashPhase)
  // Scale is in mm
  switch (lineStyle) {
    case 'dashed':
      doc.setLineDashPattern([2 * scale, 1 * scale], 0);
      break;
    case 'dotted':
      doc.setLineDashPattern([0.5 * scale, 0.5 * scale], 0);
      break;
    case 'dashdot':
      doc.setLineDashPattern([2 * scale, 0.5 * scale, 0.5 * scale, 0.5 * scale], 0);
      break;
    default: // solid
      doc.setLineDashPattern([], 0);
  }
}

/**
 * Apply stroke style to document
 */
function applyStrokeStyle(
  doc: jsPDF,
  shape: Shape,
  opts: VectorRenderOptions
): void {
  const color = transformColor(shape.style.strokeColor, opts.appearance, true);
  doc.setDrawColor(color.r, color.g, color.b);

  const minLineWidth = opts.minLineWidthMM ?? 0.1;
  const lineWidth = opts.plotLineweights
    ? Math.max(shape.style.strokeWidth * opts.scale, minLineWidth)
    : minLineWidth;
  doc.setLineWidth(lineWidth);

  setLineDash(doc, shape.style.lineStyle, opts.scale);
}

/**
 * Apply fill style to document
 */
function applyFillStyle(
  doc: jsPDF,
  color: string,
  appearance: PrintAppearance
): void {
  const rgb = transformColor(color, appearance, true);
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
}

// ============================================================================
// Shape Renderers
// ============================================================================

/**
 * Coordinate transform functions
 */
function createTransform(opts: VectorRenderOptions) {
  return {
    tx: (x: number) => x * opts.scale + opts.offsetX,
    ty: (y: number) => y * opts.scale + opts.offsetY,
  };
}

/**
 * Render a line shape
 */
function renderLine(doc: jsPDF, shape: Shape & { type: 'line' }, opts: VectorRenderOptions): void {
  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);

  doc.line(tx(shape.start.x), ty(shape.start.y), tx(shape.end.x), ty(shape.end.y));
}

/**
 * Render a rectangle shape
 */
function renderRectangle(doc: jsPDF, shape: Shape & { type: 'rectangle' }, opts: VectorRenderOptions): void {
  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);
  const hasFill = !!shape.style.fillColor;

  if (hasFill) {
    applyFillStyle(doc, shape.style.fillColor!, opts.appearance);
  }

  const x = tx(shape.topLeft.x);
  const y = ty(shape.topLeft.y);
  const w = shape.width * opts.scale;
  const h = shape.height * opts.scale;
  const r = (shape.cornerRadius ?? 0) * opts.scale;
  const rotation = shape.rotation || 0;

  if (rotation === 0 && r === 0) {
    // Simple axis-aligned rectangle
    doc.rect(x, y, w, h, hasFill ? 'FD' : 'S');
  } else if (rotation === 0 && r > 0) {
    // Rounded rectangle without rotation
    const maxR = Math.min(r, w / 2, h / 2);
    doc.roundedRect(x, y, w, h, maxR, maxR, hasFill ? 'FD' : 'S');
  } else {
    // Rotated rectangle - use lines() with path
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Calculate corners relative to topLeft
    const corners = [
      { x: 0, y: 0 },
      { x: shape.width, y: 0 },
      { x: shape.width, y: shape.height },
      { x: 0, y: shape.height },
    ].map(c => ({
      x: tx(shape.topLeft.x + c.x * cos - c.y * sin),
      y: ty(shape.topLeft.y + c.x * sin + c.y * cos),
    }));

    // Draw as polygon using lines()
    const path: [number, number][] = [];
    for (let i = 1; i < corners.length; i++) {
      path.push([corners[i].x - corners[i - 1].x, corners[i].y - corners[i - 1].y]);
    }
    // Close the path
    path.push([corners[0].x - corners[3].x, corners[0].y - corners[3].y]);

    doc.lines(path, corners[0].x, corners[0].y, [1, 1], hasFill ? 'FD' : 'S', true);
  }
}

/**
 * Render a circle shape
 */
function renderCircle(doc: jsPDF, shape: Shape & { type: 'circle' }, opts: VectorRenderOptions): void {
  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);
  const hasFill = !!shape.style.fillColor;

  if (hasFill) {
    applyFillStyle(doc, shape.style.fillColor!, opts.appearance);
  }

  doc.circle(tx(shape.center.x), ty(shape.center.y), shape.radius * opts.scale, hasFill ? 'FD' : 'S');
}

/**
 * Render an arc shape using bezier curves
 */
function renderArc(doc: jsPDF, shape: Shape & { type: 'arc' }, opts: VectorRenderOptions): void {
  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);

  const cx = tx(shape.center.x);
  const cy = ty(shape.center.y);
  const r = shape.radius * opts.scale;

  const curves = arcToCubicBezier(cx, cy, r, shape.startAngle, shape.endAngle);

  if (curves.length === 0) return;

  // Calculate start point
  const startX = cx + r * Math.cos(shape.startAngle);
  const startY = cy + r * Math.sin(shape.startAngle);

  // Build path array for lines() method
  // Each bezier curve is [cp1dx, cp1dy, cp2dx, cp2dy, edx, edy]
  const path: number[][] = [];
  let lastX = startX;
  let lastY = startY;

  for (const curve of curves) {
    path.push([
      curve.cp1.x - lastX,
      curve.cp1.y - lastY,
      curve.cp2.x - lastX,
      curve.cp2.y - lastY,
      curve.end.x - lastX,
      curve.end.y - lastY,
    ]);
    lastX = curve.end.x;
    lastY = curve.end.y;
  }

  doc.lines(path, startX, startY, [1, 1], 'S', false);
}

/**
 * Render an ellipse shape
 */
function renderEllipse(doc: jsPDF, shape: Shape & { type: 'ellipse' }, opts: VectorRenderOptions): void {
  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);
  const hasFill = !!shape.style.fillColor && shape.startAngle === undefined;

  if (hasFill) {
    applyFillStyle(doc, shape.style.fillColor!, opts.appearance);
  }

  const cx = tx(shape.center.x);
  const cy = ty(shape.center.y);
  const rx = shape.radiusX * opts.scale;
  const ry = shape.radiusY * opts.scale;

  // Full ellipse without rotation - use native ellipse()
  if (shape.rotation === 0 && shape.startAngle === undefined) {
    doc.ellipse(cx, cy, rx, ry, hasFill ? 'FD' : 'S');
    return;
  }

  // Partial or rotated ellipse - use bezier curves
  const startAngle = shape.startAngle ?? 0;
  const endAngle = shape.endAngle ?? Math.PI * 2;

  const curves = ellipseArcToBezier(cx, cy, rx, ry, shape.rotation, startAngle, endAngle);

  if (curves.length === 0) return;

  // Calculate start point
  const cos = Math.cos(shape.rotation);
  const sin = Math.sin(shape.rotation);
  const sx = rx * Math.cos(startAngle);
  const sy = ry * Math.sin(startAngle);
  const startX = cx + sx * cos - sy * sin;
  const startY = cy + sx * sin + sy * cos;

  // Build path
  const path: number[][] = [];
  let lastX = startX;
  let lastY = startY;

  for (const curve of curves) {
    path.push([
      curve.cp1.x - lastX,
      curve.cp1.y - lastY,
      curve.cp2.x - lastX,
      curve.cp2.y - lastY,
      curve.end.x - lastX,
      curve.end.y - lastY,
    ]);
    lastX = curve.end.x;
    lastY = curve.end.y;
  }

  doc.lines(path, startX, startY, [1, 1], 'S', false);
}

/**
 * Render a polyline shape (with optional bulge arcs)
 */
function renderPolyline(doc: jsPDF, shape: Shape & { type: 'polyline' }, opts: VectorRenderOptions): void {
  if (shape.points.length < 2) return;

  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);
  const hasFill = !!shape.style.fillColor && shape.closed;

  if (hasFill) {
    applyFillStyle(doc, shape.style.fillColor!, opts.appearance);
  }

  // Build path
  const path: number[][] = [];
  let lastX = tx(shape.points[0].x);
  let lastY = ty(shape.points[0].y);
  const startX = lastX;
  const startY = lastY;

  for (let i = 0; i < shape.points.length - 1; i++) {
    const bulge = shape.bulge?.[i] ?? 0;
    const p1 = shape.points[i];
    const p2 = shape.points[i + 1];

    if (bulge !== 0) {
      // Arc segment - convert to bezier
      const arc = bulgeToArc(p1, p2, bulge);
      const cx = tx(arc.center.x);
      const cy = ty(arc.center.y);
      const r = arc.radius * opts.scale;

      const curves = arcToCubicBezier(cx, cy, r, arc.startAngle, arc.endAngle, arc.clockwise);

      for (const curve of curves) {
        path.push([
          curve.cp1.x - lastX,
          curve.cp1.y - lastY,
          curve.cp2.x - lastX,
          curve.cp2.y - lastY,
          curve.end.x - lastX,
          curve.end.y - lastY,
        ]);
        lastX = curve.end.x;
        lastY = curve.end.y;
      }
    } else {
      // Straight line segment
      const nextX = tx(p2.x);
      const nextY = ty(p2.y);
      path.push([nextX - lastX, nextY - lastY]);
      lastX = nextX;
      lastY = nextY;
    }
  }

  // Handle closing segment
  if (shape.closed) {
    const lastBulge = shape.bulge?.[shape.points.length - 1] ?? 0;
    if (lastBulge !== 0) {
      const arc = bulgeToArc(shape.points[shape.points.length - 1], shape.points[0], lastBulge);
      const cx = tx(arc.center.x);
      const cy = ty(arc.center.y);
      const r = arc.radius * opts.scale;

      const curves = arcToCubicBezier(cx, cy, r, arc.startAngle, arc.endAngle, arc.clockwise);

      for (const curve of curves) {
        path.push([
          curve.cp1.x - lastX,
          curve.cp1.y - lastY,
          curve.cp2.x - lastX,
          curve.cp2.y - lastY,
          curve.end.x - lastX,
          curve.end.y - lastY,
        ]);
        lastX = curve.end.x;
        lastY = curve.end.y;
      }
    } else {
      path.push([startX - lastX, startY - lastY]);
    }
  }

  doc.lines(path, startX, startY, [1, 1], hasFill ? 'FD' : 'S', shape.closed);
}

/**
 * Render a spline shape using Catmull-Rom to Bezier conversion
 */
function renderSpline(doc: jsPDF, shape: Shape & { type: 'spline' }, opts: VectorRenderOptions): void {
  if (shape.points.length < 2) return;

  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);

  // Transform points
  const scaledPts = shape.points.map(p => ({ x: tx(p.x), y: ty(p.y) }));

  // Convert to bezier segments
  const segments = catmullRomToBezier(scaledPts);

  if (segments.length === 0) return;

  // Build path
  const path: number[][] = [];
  let lastX = scaledPts[0].x;
  let lastY = scaledPts[0].y;

  for (const seg of segments) {
    path.push([
      seg.cp1.x - lastX,
      seg.cp1.y - lastY,
      seg.cp2.x - lastX,
      seg.cp2.y - lastY,
      seg.end.x - lastX,
      seg.end.y - lastY,
    ]);
    lastX = seg.end.x;
    lastY = seg.end.y;
  }

  doc.lines(path, scaledPts[0].x, scaledPts[0].y, [1, 1], 'S', false);
}

/**
 * Render a text shape
 */
function renderText(doc: jsPDF, shape: Shape & { type: 'text' }, opts: VectorRenderOptions): void {
  const { tx, ty } = createTransform(opts);
  const { position, text, fontSize, rotation, alignment, bold, italic, color, lineHeight = 1.2 } = shape;

  const textColor = transformColor(color || shape.style.strokeColor, opts.appearance, true);
  doc.setTextColor(textColor.r, textColor.g, textColor.b);

  const scaledFontSize = fontSize * opts.scale;

  // Set font style
  let fontStyle = 'normal';
  if (bold && italic) fontStyle = 'bolditalic';
  else if (bold) fontStyle = 'bold';
  else if (italic) fontStyle = 'italic';

  // Use helvetica as fallback (jsPDF built-in)
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(scaledFontSize * 2.835); // Convert mm to points

  const lines = text.split('\n');
  const actualLineHeight = scaledFontSize * lineHeight;

  // Calculate position based on alignment
  let x = tx(position.x);
  const y = ty(position.y);

  // jsPDF text alignment
  let align: 'left' | 'center' | 'right' = 'left';
  if (alignment === 'center') align = 'center';
  else if (alignment === 'right') align = 'right';

  // Handle rotation
  if (rotation !== 0) {
    const angleDeg = rotation * (180 / Math.PI);
    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * actualLineHeight;
      doc.text(lines[i], x, lineY, { angle: -angleDeg, align });
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * actualLineHeight;
      doc.text(lines[i], x, lineY, { align });
    }
  }

  // Draw leader line if present
  if (shape.leaderPoints && shape.leaderPoints.length > 0) {
    doc.setDrawColor(textColor.r, textColor.g, textColor.b);
    doc.setLineWidth(0.1 * opts.scale);
    doc.setLineDashPattern([], 0);

    let lastX = tx(position.x);
    let lastY = ty(position.y);

    for (const pt of shape.leaderPoints) {
      const nextX = tx(pt.x);
      const nextY = ty(pt.y);
      doc.line(lastX, lastY, nextX, nextY);
      lastX = nextX;
      lastY = nextY;
    }
  }
}

/**
 * Render a point shape (small cross or dot)
 */
function renderPoint(doc: jsPDF, shape: Shape & { type: 'point' }, opts: VectorRenderOptions): void {
  applyStrokeStyle(doc, shape, opts);
  const { tx, ty } = createTransform(opts);

  const x = tx(shape.position.x);
  const y = ty(shape.position.y);
  const size = 1 * opts.scale; // 1mm cross

  // Draw small cross
  doc.line(x - size, y, x + size, y);
  doc.line(x, y - size, x, y + size);
}

/**
 * Render a dimension shape
 */
function renderDimension(doc: jsPDF, dim: DimensionShape, opts: VectorRenderOptions): void {
  const { tx, ty } = createTransform(opts);
  const lineColor = transformColor(dim.dimensionStyle.lineColor, opts.appearance, true);
  const textColor = transformColor(dim.dimensionStyle.textColor, opts.appearance, true);

  doc.setDrawColor(lineColor.r, lineColor.g, lineColor.b);
  doc.setLineWidth(Math.max(0.1, dim.style.strokeWidth * opts.scale * 0.5));
  doc.setLineDashPattern([], 0);

  if (dim.points.length < 2) return;

  const p1 = dim.points[0];
  const p2 = dim.points[1];

  if (dim.dimensionType === 'linear' || dim.dimensionType === 'aligned') {
    const offset = dim.dimensionLineOffset;

    let dimLineY: number;
    if (dim.linearDirection === 'horizontal') {
      dimLineY = Math.min(p1.y, p2.y) - Math.abs(offset);
    } else if (dim.linearDirection === 'vertical') {
      dimLineY = p1.y;
    } else {
      dimLineY = Math.min(p1.y, p2.y) - Math.abs(offset);
    }

    // Extension lines
    doc.line(tx(p1.x), ty(p1.y), tx(p1.x), ty(dimLineY));
    doc.line(tx(p2.x), ty(p2.y), tx(p2.x), ty(dimLineY));

    // Dimension line
    doc.line(tx(p1.x), ty(dimLineY), tx(p2.x), ty(dimLineY));

    // Draw arrows at ends
    const arrowSize = dim.dimensionStyle.arrowSize * opts.scale;
    drawArrow(doc, tx(p1.x), ty(dimLineY), 0, arrowSize);
    drawArrow(doc, tx(p2.x), ty(dimLineY), Math.PI, arrowSize);

    // Text
    const midX = (tx(p1.x) + tx(p2.x)) / 2;
    const midY = ty(dimLineY) - 1 * opts.scale;
    const fontSize = dim.dimensionStyle.textHeight * opts.scale;

    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize * 2.835);

    const displayText = (dim.prefix || '') + dim.value + (dim.suffix || '');
    doc.text(displayText, midX, midY, { align: 'center' });

  } else if (dim.dimensionType === 'radius' || dim.dimensionType === 'diameter') {
    const center = p1;
    const pointOnCircle = p2;

    // Dimension line
    doc.line(tx(center.x), ty(center.y), tx(pointOnCircle.x), ty(pointOnCircle.y));

    // Arrow at circle point
    const angle = Math.atan2(pointOnCircle.y - center.y, pointOnCircle.x - center.x);
    const arrowSize = dim.dimensionStyle.arrowSize * opts.scale;
    drawArrow(doc, tx(pointOnCircle.x), ty(pointOnCircle.y), angle + Math.PI, arrowSize);

    // Text
    const midX = (tx(center.x) + tx(pointOnCircle.x)) / 2;
    const midY = (ty(center.y) + ty(pointOnCircle.y)) / 2 - 1 * opts.scale;
    const fontSize = dim.dimensionStyle.textHeight * opts.scale;

    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize * 2.835);

    const displayText = (dim.prefix || '') + dim.value + (dim.suffix || '');
    doc.text(displayText, midX, midY, { align: 'center' });
  }
}

/**
 * Draw an arrow head at position
 */
function drawArrow(doc: jsPDF, x: number, y: number, angle: number, size: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Arrow head points
  const tipX = x;
  const tipY = y;
  const leftX = x - size * cos + size * 0.4 * sin;
  const leftY = y - size * sin - size * 0.4 * cos;
  const rightX = x - size * cos - size * 0.4 * sin;
  const rightY = y - size * sin + size * 0.4 * cos;

  // Draw filled triangle
  const path: [number, number][] = [
    [leftX - tipX, leftY - tipY],
    [rightX - leftX, rightY - leftY],
    [tipX - rightX, tipY - rightY],
  ];

  doc.lines(path, tipX, tipY, [1, 1], 'F', true);
}

/**
 * Render a hatch shape with pattern
 */
function renderHatch(doc: jsPDF, hatch: HatchShape, opts: VectorRenderOptions): void {
  const { tx, ty } = createTransform(opts);
  const { points, patternType, patternAngle, patternScale, fillColor, backgroundColor, customPatternId } = hatch;

  if (points.length < 3) return;

  // Calculate bounding box in PDF coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pdfPoints = points.map(p => {
    const px = tx(p.x);
    const py = ty(p.y);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    return { x: px, y: py };
  });

  // Create clipping path
  doc.saveGraphicsState();

  // Build polygon path for clipping
  const clipPath: [number, number][] = [];
  for (let i = 1; i < pdfPoints.length; i++) {
    clipPath.push([pdfPoints[i].x - pdfPoints[i - 1].x, pdfPoints[i].y - pdfPoints[i - 1].y]);
  }
  clipPath.push([pdfPoints[0].x - pdfPoints[pdfPoints.length - 1].x, pdfPoints[0].y - pdfPoints[pdfPoints.length - 1].y]);

  // Draw clip path and apply clipping
  doc.lines(clipPath, pdfPoints[0].x, pdfPoints[0].y, [1, 1], null, true);
  // Note: jsPDF clip() method needs to be called after path is defined
  // For now, we'll use a workaround by drawing in the boundary

  // Draw background if specified
  if (backgroundColor) {
    const bgColor = transformColor(backgroundColor, opts.appearance, true);
    doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
    doc.lines(clipPath, pdfPoints[0].x, pdfPoints[0].y, [1, 1], 'F', true);
  }

  const patternColor = transformColor(fillColor, opts.appearance, true);

  // Handle custom patterns
  if (patternType === 'custom' && customPatternId) {
    const customPattern = BUILTIN_PATTERNS.find(p => p.id === customPatternId) ||
                          opts.customPatterns?.find(p => p.id === customPatternId);
    if (customPattern) {
      if (isSvgHatchPattern(customPattern)) {
        // SVG patterns - fill with solid color as fallback
        doc.setFillColor(patternColor.r, patternColor.g, patternColor.b);
        doc.setGState({ opacity: 0.3 });
        doc.lines(clipPath, pdfPoints[0].x, pdfPoints[0].y, [1, 1], 'F', true);
        doc.setGState({ opacity: 1 });
      } else if (customPattern.lineFamilies.length > 0) {
        // Render line families
        renderLineFamiliesToPdf(
          doc, customPattern.lineFamilies, minX, minY, maxX, maxY,
          patternScale * opts.scale, patternAngle, patternColor,
          opts.plotLineweights ? hatch.style.strokeWidth * opts.scale * 0.5 : 0.1,
          pdfPoints
        );
      } else {
        // Empty line families = solid fill
        doc.setFillColor(patternColor.r, patternColor.g, patternColor.b);
        doc.lines(clipPath, pdfPoints[0].x, pdfPoints[0].y, [1, 1], 'F', true);
      }
    }
  } else if (patternType === 'solid') {
    doc.setFillColor(patternColor.r, patternColor.g, patternColor.b);
    doc.lines(clipPath, pdfPoints[0].x, pdfPoints[0].y, [1, 1], 'F', true);
  } else if (patternType === 'dots') {
    // Dots pattern
    const spacing = 2 * patternScale * opts.scale;
    const dotRadius = 0.2 * patternScale * opts.scale;
    doc.setFillColor(patternColor.r, patternColor.g, patternColor.b);

    for (let x = minX; x <= maxX; x += spacing) {
      for (let y = minY; y <= maxY; y += spacing) {
        if (isPointInPolygon({ x, y }, pdfPoints)) {
          doc.circle(x, y, dotRadius, 'F');
        }
      }
    }
  } else {
    // Line patterns (diagonal, horizontal, vertical, crosshatch)
    const spacing = 2 * patternScale * opts.scale;
    const angles: number[] = [];

    switch (patternType) {
      case 'horizontal': angles.push(0); break;
      case 'vertical': angles.push(90); break;
      case 'diagonal': angles.push(patternAngle); break;
      case 'crosshatch': angles.push(patternAngle); angles.push(patternAngle + 90); break;
    }

    doc.setDrawColor(patternColor.r, patternColor.g, patternColor.b);
    doc.setLineWidth(opts.plotLineweights ? hatch.style.strokeWidth * opts.scale * 0.5 : 0.1);
    doc.setLineDashPattern([], 0);

    for (const angleDeg of angles) {
      renderHatchLines(doc, angleDeg, spacing, minX, minY, maxX, maxY, pdfPoints);
    }
  }

  doc.restoreGraphicsState();

  // Draw boundary stroke
  const strokeColor = transformColor(hatch.style.strokeColor, opts.appearance, true);
  doc.setDrawColor(strokeColor.r, strokeColor.g, strokeColor.b);
  doc.setLineWidth(opts.plotLineweights ? Math.max(hatch.style.strokeWidth * opts.scale, 0.1) : 0.2);
  doc.setLineDashPattern([], 0);
  doc.lines(clipPath, pdfPoints[0].x, pdfPoints[0].y, [1, 1], 'S', true);
}

/**
 * Check if a point is inside a polygon (PDF coordinates)
 */
function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Render hatch pattern lines
 */
function renderHatchLines(
  doc: jsPDF,
  angleDeg: number,
  spacing: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  boundary: { x: number; y: number }[]
): void {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
  const halfDiag = diagonal / 2 + spacing;
  const numLines = Math.ceil((halfDiag * 2) / spacing);

  for (let i = -numLines; i <= numLines; i++) {
    const offset = i * spacing;
    const ox = cx + offset * (-sinA);
    const oy = cy + offset * cosA;
    const x1 = ox - halfDiag * cosA;
    const y1 = oy - halfDiag * sinA;
    const x2 = ox + halfDiag * cosA;
    const y2 = oy + halfDiag * sinA;

    // Clip line to boundary polygon
    const clipped = clipLineToPolygon(x1, y1, x2, y2, boundary);
    if (clipped) {
      doc.line(clipped.x1, clipped.y1, clipped.x2, clipped.y2);
    }
  }
}

/**
 * Clip a line segment to a polygon boundary
 */
function clipLineToPolygon(
  x1: number, y1: number, x2: number, y2: number,
  polygon: { x: number; y: number }[]
): { x1: number; y1: number; x2: number; y2: number } | null {
  const intersections: { t: number; x: number; y: number }[] = [];

  // Check intersection with each polygon edge
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const intersection = lineLineIntersection(
      x1, y1, x2, y2,
      polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y
    );
    if (intersection) {
      intersections.push(intersection);
    }
  }

  if (intersections.length < 2) {
    // Check if line is entirely inside
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    if (isPointInPolygon({ x: midX, y: midY }, polygon)) {
      return { x1, y1, x2, y2 };
    }
    return null;
  }

  // Sort by t parameter and take first and last
  intersections.sort((a, b) => a.t - b.t);
  const first = intersections[0];
  const last = intersections[intersections.length - 1];

  return { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
}

/**
 * Calculate line-line intersection
 */
function lineLineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): { t: number; x: number; y: number } | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      t,
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }
  return null;
}

/**
 * Render line families for custom patterns
 */
function renderLineFamiliesToPdf(
  doc: jsPDF,
  lineFamilies: LineFamily[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  scale: number,
  rotationOffset: number,
  defaultColor: { r: number; g: number; b: number },
  defaultStrokeWidth: number,
  boundary: { x: number; y: number }[]
): void {
  for (const family of lineFamilies) {
    const spacing = (family.deltaY || 10) * scale;
    const deltaX = (family.deltaX || 0) * scale;
    const angleDeg = family.angle + rotationOffset;
    const strokeWidth = family.strokeWidth ?? defaultStrokeWidth;
    const strokeColor = family.strokeColor ? hexToRgb(family.strokeColor) : defaultColor;

    doc.setDrawColor(strokeColor.r, strokeColor.g, strokeColor.b);
    doc.setLineWidth(strokeWidth);

    // Handle dash pattern
    if (family.dashPattern && family.dashPattern.length > 0) {
      if (family.dashPattern.includes(0)) {
        // Dots pattern
        renderDotsPattern(doc, angleDeg, spacing, deltaX, minX, minY, maxX, maxY, scale, strokeColor, boundary);
        continue;
      }
      const scaledDashPattern = family.dashPattern.map(d => Math.abs(d) * scale);
      doc.setLineDashPattern(scaledDashPattern, 0);
    } else {
      doc.setLineDashPattern([], 0);
    }

    // Draw lines
    renderHatchLines(doc, angleDeg, spacing, minX, minY, maxX, maxY, boundary);
  }

  doc.setLineDashPattern([], 0);
}

/**
 * Render dots pattern
 */
function renderDotsPattern(
  doc: jsPDF,
  angleDeg: number,
  spacing: number,
  deltaX: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  scale: number,
  color: { r: number; g: number; b: number },
  boundary: { x: number; y: number }[]
): void {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
  const halfDiag = diagonal / 2 + spacing * 2;

  const dotRadius = 0.2 * scale;
  const numLines = Math.ceil((halfDiag * 2) / spacing) + 2;
  const dotsPerLine = Math.ceil((halfDiag * 2) / (deltaX || spacing)) + 2;
  const dotSpacing = deltaX || spacing;

  doc.setFillColor(color.r, color.g, color.b);

  for (let i = -numLines; i <= numLines; i++) {
    const perpOffset = i * spacing;
    const baseX = cx + perpOffset * (-sinA);
    const baseY = cy + perpOffset * cosA;

    for (let j = -dotsPerLine; j <= dotsPerLine; j++) {
      const alongOffset = j * dotSpacing;
      const dx = baseX + alongOffset * cosA;
      const dy = baseY + alongOffset * sinA;

      if (isPointInPolygon({ x: dx, y: dy }, boundary)) {
        doc.circle(dx, dy, dotRadius, 'F');
      }
    }
  }
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Render all shapes to PDF using vector primitives
 */
export function renderShapesToPdf(
  doc: jsPDF,
  shapes: Shape[],
  opts: VectorRenderOptions
): void {
  for (const shape of shapes) {
    if (!shape.visible) continue;

    switch (shape.type) {
      case 'line':
        renderLine(doc, shape, opts);
        break;
      case 'rectangle':
        renderRectangle(doc, shape, opts);
        break;
      case 'circle':
        renderCircle(doc, shape, opts);
        break;
      case 'arc':
        renderArc(doc, shape, opts);
        break;
      case 'ellipse':
        renderEllipse(doc, shape, opts);
        break;
      case 'polyline':
        renderPolyline(doc, shape, opts);
        break;
      case 'spline':
        renderSpline(doc, shape, opts);
        break;
      case 'text':
        renderText(doc, shape, opts);
        break;
      case 'point':
        renderPoint(doc, shape, opts);
        break;
      case 'dimension':
        renderDimension(doc, shape as DimensionShape, opts);
        break;
      case 'hatch':
        renderHatch(doc, shape as HatchShape, opts);
        break;
    }

    // Reset dash pattern after each shape
    doc.setLineDashPattern([], 0);
  }
}
