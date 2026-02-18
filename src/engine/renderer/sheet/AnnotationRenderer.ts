/**
 * AnnotationRenderer - Renders sheet annotations
 *
 * Handles rendering of:
 * - Text annotations
 * - Dimension annotations
 * - Leader annotations
 * - Callout annotations
 * - Section markers
 * - Revision clouds
 */

import { BaseRenderer } from '../core/BaseRenderer';
import { MM_TO_PIXELS } from '../types';
import type {
  SheetAnnotation,
  SheetTextAnnotation,
  SheetDimensionAnnotation,
  SheetLeaderAnnotation,
  SheetCalloutAnnotation,
  SheetSectionMarker,
  SheetRevisionCloud,
} from '../../../types/sheet';
import type { Point } from '../../../types/geometry';
import { CAD_DEFAULT_FONT } from '../../../constants/cadDefaults';

export interface AnnotationRenderOptions {
  /** Selected annotation IDs */
  selectedIds: string[];
  /** Whether to show selection handles */
  showHandles: boolean;
  /** Zoom level of the sheet viewport (for consistent line weights) */
  sheetZoom: number;
}

export class AnnotationRenderer extends BaseRenderer {
  /**
   * Render all annotations on a sheet
   */
  renderAnnotations(
    annotations: SheetAnnotation[],
    options: AnnotationRenderOptions
  ): void {
    const ctx = this.ctx;
    const { selectedIds, showHandles, sheetZoom } = options;

    for (const annotation of annotations) {
      if (!annotation.visible) continue;

      const isSelected = selectedIds.includes(annotation.id);

      ctx.save();
      this.renderAnnotation(annotation, isSelected, sheetZoom);

      // Draw selection indicator if selected
      if (isSelected && showHandles) {
        this.drawSelectionIndicator(annotation, sheetZoom);
      }

      ctx.restore();
    }
  }

  /**
   * Render a single annotation based on its type
   */
  private renderAnnotation(
    annotation: SheetAnnotation,
    isSelected: boolean,
    sheetZoom: number
  ): void {
    switch (annotation.type) {
      case 'text':
        this.drawTextAnnotation(annotation, isSelected);
        break;
      case 'dimension':
        this.drawDimensionAnnotation(annotation, isSelected, sheetZoom);
        break;
      case 'leader':
        this.drawLeaderAnnotation(annotation, isSelected, sheetZoom);
        break;
      case 'callout':
        this.drawCalloutAnnotation(annotation, isSelected, sheetZoom);
        break;
      case 'section-marker':
        this.drawSectionMarker(annotation, isSelected, sheetZoom);
        break;
      case 'revision-cloud':
        this.drawRevisionCloud(annotation, isSelected, sheetZoom);
        break;
    }
  }

  /**
   * Draw a text annotation
   */
  private drawTextAnnotation(
    annotation: SheetTextAnnotation,
    isSelected: boolean
  ): void {
    const ctx = this.ctx;
    const { position, content, fontSize, fontFamily, rotation, alignment, color, bold, italic } = annotation;

    // Convert position to pixels
    const x = position.x * MM_TO_PIXELS;
    const y = position.y * MM_TO_PIXELS;
    const fontSizePx = fontSize * MM_TO_PIXELS;

    ctx.save();

    // Apply rotation
    if (rotation !== 0) {
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.translate(-x, -y);
    }

    // Build font string
    const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}`;
    ctx.font = `${fontStyle}${fontSizePx}px ${fontFamily}`;
    ctx.fillStyle = isSelected ? '#0066ff' : color;
    ctx.textAlign = alignment;
    ctx.textBaseline = 'top';

    // Draw text (split by newlines)
    const lines = content.split('\n');
    const lineHeight = fontSizePx * 1.2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }

    ctx.restore();
  }

  /**
   * Draw a dimension annotation
   */
  private drawDimensionAnnotation(
    annotation: SheetDimensionAnnotation,
    isSelected: boolean,
    sheetZoom: number
  ): void {
    const ctx = this.ctx;
    const { points, value, style, prefix, suffix, dimensionType } = annotation;

    if (points.length < 2) return;

    const lineColor = isSelected ? '#0066ff' : style.lineColor;
    const textColor = isSelected ? '#0066ff' : style.textColor;
    const lineWidth = 0.5 / sheetZoom;

    ctx.strokeStyle = lineColor;
    ctx.fillStyle = textColor;
    ctx.lineWidth = lineWidth;

    // Convert points to pixels
    const pixelPoints = points.map(p => ({
      x: p.x * MM_TO_PIXELS,
      y: p.y * MM_TO_PIXELS,
    }));

    switch (dimensionType) {
      case 'linear':
      case 'aligned':
        this.drawLinearDimension(pixelPoints, value, style, prefix, suffix, lineColor, textColor);
        break;
      case 'radius':
      case 'diameter':
        this.drawRadialDimension(pixelPoints, value, style, prefix, suffix, lineColor, textColor, dimensionType);
        break;
      case 'angular':
        this.drawAngularDimension(pixelPoints, value, style, prefix, suffix, lineColor, textColor);
        break;
      default:
        this.drawLinearDimension(pixelPoints, value, style, prefix, suffix, lineColor, textColor);
    }
  }

  /**
   * Draw a linear/aligned dimension
   */
  private drawLinearDimension(
    points: Point[],
    value: string,
    style: SheetDimensionAnnotation['style'],
    prefix: string | undefined,
    suffix: string | undefined,
    lineColor: string,
    textColor: string
  ): void {
    const ctx = this.ctx;
    const [p1, p2, dimLine] = points;

    if (!p1 || !p2) return;

    // Dimension line position (either third point or midway)
    const dimY = dimLine?.y ?? (p1.y - 30);

    const gap = style.extensionLineGap * MM_TO_PIXELS;
    const overshoot = style.extensionLineOvershoot * MM_TO_PIXELS;

    // Extension lines
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y + gap);
    ctx.lineTo(p1.x, dimY - overshoot);
    ctx.moveTo(p2.x, p2.y + gap);
    ctx.lineTo(p2.x, dimY - overshoot);
    ctx.stroke();

    // Dimension line
    ctx.beginPath();
    ctx.moveTo(p1.x, dimY);
    ctx.lineTo(p2.x, dimY);
    ctx.stroke();

    // Arrows
    this.drawArrow(p1.x, dimY, 0, style.arrowSize * MM_TO_PIXELS, style.arrowType, lineColor);
    this.drawArrow(p2.x, dimY, Math.PI, style.arrowSize * MM_TO_PIXELS, style.arrowType, lineColor);

    // Text
    const midX = (p1.x + p2.x) / 2;
    const textY = style.textPlacement === 'above' ? dimY - 5 :
                  style.textPlacement === 'below' ? dimY + 15 : dimY + 3;

    const displayText = `${prefix || ''}${value}${suffix || ''}`;
    const textHeight = style.textHeight * MM_TO_PIXELS;

    ctx.font = `${textHeight}px ${CAD_DEFAULT_FONT}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = style.textPlacement === 'above' ? 'bottom' :
                       style.textPlacement === 'below' ? 'top' : 'middle';

    // White background for text
    const textWidth = ctx.measureText(displayText).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(midX - textWidth / 2 - 2, textY - textHeight / 2 - 2, textWidth + 4, textHeight + 4);

    ctx.fillStyle = textColor;
    ctx.fillText(displayText, midX, textY);
  }

  /**
   * Draw a radial (radius/diameter) dimension
   */
  private drawRadialDimension(
    points: Point[],
    value: string,
    style: SheetDimensionAnnotation['style'],
    prefix: string | undefined,
    suffix: string | undefined,
    lineColor: string,
    textColor: string,
    type: 'radius' | 'diameter'
  ): void {
    const ctx = this.ctx;
    const [center, edge] = points;

    if (!center || !edge) return;

    // Draw line from center to edge
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(edge.x, edge.y);
    ctx.stroke();

    // Arrow at edge
    const angle = Math.atan2(edge.y - center.y, edge.x - center.x);
    this.drawArrow(edge.x, edge.y, angle + Math.PI, style.arrowSize * MM_TO_PIXELS, style.arrowType, lineColor);

    // Text
    const midX = (center.x + edge.x) / 2;
    const midY = (center.y + edge.y) / 2;
    const displayText = `${prefix || (type === 'radius' ? 'R' : '\u2300')}${value}${suffix || ''}`;
    const textHeight = style.textHeight * MM_TO_PIXELS;

    ctx.font = `${textHeight}px ${CAD_DEFAULT_FONT}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(displayText, midX, midY - 3);
  }

  /**
   * Draw an angular dimension
   */
  private drawAngularDimension(
    points: Point[],
    value: string,
    style: SheetDimensionAnnotation['style'],
    prefix: string | undefined,
    suffix: string | undefined,
    lineColor: string,
    textColor: string
  ): void {
    const ctx = this.ctx;
    const [vertex, p1, p2] = points;

    if (!vertex || !p1 || !p2) return;

    const angle1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const angle2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    const radius = 40; // Arc radius in pixels

    // Draw arc
    ctx.strokeStyle = lineColor;
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, radius, angle1, angle2);
    ctx.stroke();

    // Text at mid-angle
    const midAngle = (angle1 + angle2) / 2;
    const textX = vertex.x + Math.cos(midAngle) * (radius + 10);
    const textY = vertex.y + Math.sin(midAngle) * (radius + 10);
    const displayText = `${prefix || ''}${value}${suffix || '\u00B0'}`;
    const textHeight = style.textHeight * MM_TO_PIXELS;

    ctx.font = `${textHeight}px ${CAD_DEFAULT_FONT}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, textX, textY);
  }

  /**
   * Draw an arrow at a point
   */
  private drawArrow(
    x: number,
    y: number,
    angle: number,
    size: number,
    type: string,
    color: string
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    switch (type) {
      case 'filled':
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, size / 3);
        ctx.lineTo(-size, -size / 3);
        ctx.closePath();
        ctx.fill();
        break;
      case 'open':
        ctx.beginPath();
        ctx.moveTo(-size, size / 3);
        ctx.lineTo(0, 0);
        ctx.lineTo(-size, -size / 3);
        ctx.stroke();
        break;
      case 'dot':
        ctx.beginPath();
        ctx.arc(0, 0, size / 6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'tick':
        ctx.beginPath();
        ctx.moveTo(-size / 2, -size / 2);
        ctx.lineTo(size / 2, size / 2);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  /**
   * Draw a leader annotation
   */
  private drawLeaderAnnotation(
    annotation: SheetLeaderAnnotation,
    isSelected: boolean,
    sheetZoom: number
  ): void {
    const ctx = this.ctx;
    const { points, text, arrowType, lineColor, textColor, fontSize, textAlignment } = annotation;

    if (points.length < 2) return;

    const color = isSelected ? '#0066ff' : lineColor;
    const txtColor = isSelected ? '#0066ff' : textColor;

    // Convert points to pixels
    const pixelPoints = points.map(p => ({
      x: p.x * MM_TO_PIXELS,
      y: p.y * MM_TO_PIXELS,
    }));

    // Draw leader line
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5 / sheetZoom;
    ctx.beginPath();
    ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
    for (let i = 1; i < pixelPoints.length; i++) {
      ctx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
    }
    ctx.stroke();

    // Draw arrow at start
    const startAngle = Math.atan2(
      pixelPoints[1].y - pixelPoints[0].y,
      pixelPoints[1].x - pixelPoints[0].x
    );
    this.drawArrow(
      pixelPoints[0].x,
      pixelPoints[0].y,
      startAngle,
      3 * MM_TO_PIXELS,
      arrowType,
      color
    );

    // Draw text at end
    const lastPoint = pixelPoints[pixelPoints.length - 1];
    const fontSizePx = fontSize * MM_TO_PIXELS;

    ctx.font = `${fontSizePx}px ${CAD_DEFAULT_FONT}`;
    ctx.fillStyle = txtColor;
    ctx.textAlign = textAlignment;
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, lastPoint.x, lastPoint.y - 2);

    // Underline for text
    const textWidth = ctx.measureText(text).width;
    const underlineX = textAlignment === 'left' ? lastPoint.x :
                       textAlignment === 'right' ? lastPoint.x - textWidth :
                       lastPoint.x - textWidth / 2;

    ctx.beginPath();
    ctx.moveTo(underlineX, lastPoint.y);
    ctx.lineTo(underlineX + textWidth, lastPoint.y);
    ctx.stroke();
  }

  /**
   * Draw a callout annotation
   */
  private drawCalloutAnnotation(
    annotation: SheetCalloutAnnotation,
    isSelected: boolean,
    sheetZoom: number
  ): void {
    const ctx = this.ctx;
    const { position, calloutNumber, shape, size, lineColor, fillColor } = annotation;

    const x = position.x * MM_TO_PIXELS;
    const y = position.y * MM_TO_PIXELS;
    const sizePx = size * MM_TO_PIXELS;

    const stroke = isSelected ? '#0066ff' : lineColor;
    const fill = fillColor || '#ffffff';

    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 1 / sheetZoom;

    // Draw shape
    switch (shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, sizePx / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'hexagon':
        this.drawHexagon(x, y, sizePx / 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'rectangle':
        ctx.fillRect(x - sizePx / 2, y - sizePx / 2, sizePx, sizePx);
        ctx.strokeRect(x - sizePx / 2, y - sizePx / 2, sizePx, sizePx);
        break;
      case 'cloud':
        this.drawCloudBubble(x, y, sizePx / 2);
        ctx.fill();
        ctx.stroke();
        break;
    }

    // Draw callout number
    ctx.fillStyle = isSelected ? '#0066ff' : lineColor;
    ctx.font = `bold ${sizePx * 0.6}px ${CAD_DEFAULT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(calloutNumber, x, y);
  }

  /**
   * Draw a hexagon
   */
  private drawHexagon(x: number, y: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  }

  /**
   * Draw a cloud-shaped bubble
   */
  private drawCloudBubble(x: number, y: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    // Approximate cloud with overlapping arcs
    const arcRadius = radius * 0.5;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const cx = x + radius * 0.7 * Math.cos(angle);
      const cy = y + radius * 0.7 * Math.sin(angle);
      ctx.arc(cx, cy, arcRadius, 0, Math.PI * 2);
    }
  }

  /**
   * Draw a section marker
   */
  private drawSectionMarker(
    annotation: SheetSectionMarker,
    isSelected: boolean,
    sheetZoom: number
  ): void {
    const ctx = this.ctx;
    const { lineStart, lineEnd, sectionNumber, direction, lineColor } = annotation;

    const x1 = lineStart.x * MM_TO_PIXELS;
    const y1 = lineStart.y * MM_TO_PIXELS;
    const x2 = lineEnd.x * MM_TO_PIXELS;
    const y2 = lineEnd.y * MM_TO_PIXELS;

    const color = isSelected ? '#0066ff' : lineColor;

    // Draw section line (dashed)
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / sheetZoom;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate perpendicular direction for arrows
    const dx = x2 - x1;
    const dy = y2 - y1;
    const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;

    // Draw direction arrows at ends
    const arrowSize = 8;
    const circleRadius = 12;

    // Draw circles with section number at each end
    const drawEndMarker = (x: number, y: number, showArrow: boolean, arrowAngle: number) => {
      // Circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Section number
      ctx.fillStyle = color;
      ctx.font = `bold 12px ${CAD_DEFAULT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sectionNumber, x, y);

      // Arrow indicating direction
      if (showArrow) {
        const arrowX = x + Math.cos(arrowAngle) * (circleRadius + 5);
        const arrowY = y + Math.sin(arrowAngle) * (circleRadius + 5);
        this.drawArrow(arrowX, arrowY, arrowAngle, arrowSize, 'filled', color);
      }
    };

    // Determine which ends get arrows based on direction
    const showArrowAtStart = direction === 'both' || direction === 'left' || direction === 'up';
    const showArrowAtEnd = direction === 'both' || direction === 'right' || direction === 'down';

    drawEndMarker(x1, y1, showArrowAtStart, perpAngle);
    drawEndMarker(x2, y2, showArrowAtEnd, perpAngle + Math.PI);
  }

  /**
   * Draw a revision cloud
   */
  private drawRevisionCloud(
    annotation: SheetRevisionCloud,
    isSelected: boolean,
    sheetZoom: number
  ): void {
    const ctx = this.ctx;
    const { points, arcBulge, lineColor } = annotation;

    if (points.length < 3) return;

    const color = isSelected ? '#0066ff' : lineColor;

    // Convert points to pixels
    const pixelPoints = points.map(p => ({
      x: p.x * MM_TO_PIXELS,
      y: p.y * MM_TO_PIXELS,
    }));

    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / sheetZoom;
    ctx.beginPath();

    // Draw cloud arcs between each pair of points
    for (let i = 0; i < pixelPoints.length; i++) {
      const p1 = pixelPoints[i];
      const p2 = pixelPoints[(i + 1) % pixelPoints.length];

      // Calculate arc between points
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Number of arcs based on distance
      const numArcs = Math.max(1, Math.floor(dist / (15 * arcBulge)));

      for (let j = 0; j < numArcs; j++) {
        const t1 = j / numArcs;
        const t2 = (j + 1) / numArcs;

        const ax = p1.x + dx * t1;
        const ay = p1.y + dy * t1;
        const bx = p1.x + dx * t2;
        const by = p1.y + dy * t2;

        // Control point for arc (perpendicular offset)
        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;
        const perpX = -(by - ay);
        const perpY = bx - ax;
        const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);
        const bulgeOffset = dist / numArcs * arcBulge;

        const cpX = midX + (perpX / perpLen) * bulgeOffset;
        const cpY = midY + (perpY / perpLen) * bulgeOffset;

        if (i === 0 && j === 0) {
          ctx.moveTo(ax, ay);
        }
        ctx.quadraticCurveTo(cpX, cpY, bx, by);
      }
    }

    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Draw selection indicator around an annotation
   */
  private drawSelectionIndicator(
    annotation: SheetAnnotation,
    sheetZoom: number
  ): void {
    const ctx = this.ctx;
    const bounds = this.getAnnotationBounds(annotation);

    if (!bounds) return;

    // Draw dashed selection rectangle
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1 / sheetZoom;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);

    // Draw corner handles
    const handleSize = 6 / sheetZoom;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 1 / sheetZoom;

    const handles = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];

    for (const handle of handles) {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.strokeRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }
  }

  /**
   * Get the bounding box of an annotation in pixels
   */
  private getAnnotationBounds(
    annotation: SheetAnnotation
  ): { x: number; y: number; width: number; height: number } | null {
    const padding = 5;

    switch (annotation.type) {
      case 'text': {
        const { position, fontSize, content } = annotation;
        const x = position.x * MM_TO_PIXELS;
        const y = position.y * MM_TO_PIXELS;
        const fontSizePx = fontSize * MM_TO_PIXELS;
        const lines = content.split('\n');
        const width = Math.max(...lines.map(l => l.length)) * fontSizePx * 0.6;
        const height = lines.length * fontSizePx * 1.2;
        return {
          x: x - padding,
          y: y - padding,
          width: width + padding * 2,
          height: height + padding * 2,
        };
      }
      case 'leader': {
        const { points } = annotation;
        if (points.length === 0) return null;
        const xs = points.map(p => p.x * MM_TO_PIXELS);
        const ys = points.map(p => p.y * MM_TO_PIXELS);
        return {
          x: Math.min(...xs) - padding,
          y: Math.min(...ys) - padding,
          width: Math.max(...xs) - Math.min(...xs) + padding * 2,
          height: Math.max(...ys) - Math.min(...ys) + padding * 2,
        };
      }
      case 'callout': {
        const { position, size } = annotation;
        const x = position.x * MM_TO_PIXELS;
        const y = position.y * MM_TO_PIXELS;
        const sizePx = size * MM_TO_PIXELS;
        return {
          x: x - sizePx / 2 - padding,
          y: y - sizePx / 2 - padding,
          width: sizePx + padding * 2,
          height: sizePx + padding * 2,
        };
      }
      case 'revision-cloud': {
        const { points } = annotation;
        if (points.length === 0) return null;
        const xs = points.map(p => p.x * MM_TO_PIXELS);
        const ys = points.map(p => p.y * MM_TO_PIXELS);
        return {
          x: Math.min(...xs) - padding,
          y: Math.min(...ys) - padding,
          width: Math.max(...xs) - Math.min(...xs) + padding * 2,
          height: Math.max(...ys) - Math.min(...ys) + padding * 2,
        };
      }
      case 'dimension': {
        const { points } = annotation;
        if (points.length === 0) return null;
        const xs = points.map(p => p.x * MM_TO_PIXELS);
        const ys = points.map(p => p.y * MM_TO_PIXELS);
        return {
          x: Math.min(...xs) - padding * 4,
          y: Math.min(...ys) - padding * 4,
          width: Math.max(...xs) - Math.min(...xs) + padding * 8,
          height: Math.max(...ys) - Math.min(...ys) + padding * 8,
        };
      }
      case 'section-marker': {
        const { lineStart, lineEnd } = annotation;
        const x1 = lineStart.x * MM_TO_PIXELS;
        const y1 = lineStart.y * MM_TO_PIXELS;
        const x2 = lineEnd.x * MM_TO_PIXELS;
        const y2 = lineEnd.y * MM_TO_PIXELS;
        return {
          x: Math.min(x1, x2) - 20,
          y: Math.min(y1, y2) - 20,
          width: Math.abs(x2 - x1) + 40,
          height: Math.abs(y2 - y1) + 40,
        };
      }
      default:
        return null;
    }
  }

  /**
   * Get the bounding box of an annotation in sheet coordinates (mm)
   */
  getAnnotationBoundsInMm(
    annotation: SheetAnnotation
  ): { x: number; y: number; width: number; height: number } | null {
    const bounds = this.getAnnotationBounds(annotation);
    if (!bounds) return null;

    return {
      x: bounds.x / MM_TO_PIXELS,
      y: bounds.y / MM_TO_PIXELS,
      width: bounds.width / MM_TO_PIXELS,
      height: bounds.height / MM_TO_PIXELS,
    };
  }
}
