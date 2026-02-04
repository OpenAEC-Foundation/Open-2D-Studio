import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { tempDir } from '@tauri-apps/api/path';
import type { Shape, Sheet, SheetViewport, Drawing } from '../../../types/geometry';
import type { ParametricShape, ProfileParametricShape } from '../../../types/parametric';
import type { CustomHatchPattern } from '../../../types/hatch';
import type { PrintSettings } from '../../../state/slices/uiSlice';
import { renderShapesToPdf, type VectorRenderOptions } from './vectorPdfRenderer';
import { loadCustomSVGTemplates, renderSVGTitleBlock } from '../../../services/export/svgTitleBlockService';

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  'A4': { width: 210, height: 297 },
  'A3': { width: 297, height: 420 },
  'A2': { width: 420, height: 594 },
  'A1': { width: 594, height: 841 },
  'A0': { width: 841, height: 1189 },
  'Letter': { width: 216, height: 279 },
  'Legal': { width: 216, height: 356 },
  'Tabloid': { width: 279, height: 432 },
};

function calculateExtents(shapes: Shape[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (shapes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes) {
    if (!shape.visible) continue;
    switch (shape.type) {
      case 'line':
        minX = Math.min(minX, shape.start.x, shape.end.x);
        minY = Math.min(minY, shape.start.y, shape.end.y);
        maxX = Math.max(maxX, shape.start.x, shape.end.x);
        maxY = Math.max(maxY, shape.start.y, shape.end.y);
        break;
      case 'rectangle':
        minX = Math.min(minX, shape.topLeft.x, shape.topLeft.x + shape.width);
        minY = Math.min(minY, shape.topLeft.y, shape.topLeft.y + shape.height);
        maxX = Math.max(maxX, shape.topLeft.x, shape.topLeft.x + shape.width);
        maxY = Math.max(maxY, shape.topLeft.y, shape.topLeft.y + shape.height);
        break;
      case 'circle':
        minX = Math.min(minX, shape.center.x - shape.radius);
        minY = Math.min(minY, shape.center.y - shape.radius);
        maxX = Math.max(maxX, shape.center.x + shape.radius);
        maxY = Math.max(maxY, shape.center.y + shape.radius);
        break;
      case 'arc':
        minX = Math.min(minX, shape.center.x - shape.radius);
        minY = Math.min(minY, shape.center.y - shape.radius);
        maxX = Math.max(maxX, shape.center.x + shape.radius);
        maxY = Math.max(maxY, shape.center.y + shape.radius);
        break;
      case 'ellipse':
        minX = Math.min(minX, shape.center.x - shape.radiusX);
        minY = Math.min(minY, shape.center.y - shape.radiusY);
        maxX = Math.max(maxX, shape.center.x + shape.radiusX);
        maxY = Math.max(maxY, shape.center.y + shape.radiusY);
        break;
      case 'polyline':
      case 'spline':
        for (const p of shape.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        break;
      case 'text':
        minX = Math.min(minX, shape.position.x);
        minY = Math.min(minY, shape.position.y);
        maxX = Math.max(maxX, shape.position.x + 100);
        maxY = Math.max(maxY, shape.position.y + shape.fontSize);
        break;
      case 'hatch':
        for (const p of shape.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        break;
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

const PLOT_SCALES: Record<string, number> = {
  'Fit': 0,
  '1:1': 1, '1:2': 0.5, '1:5': 0.2, '1:10': 0.1, '1:20': 0.05,
  '1:50': 0.02, '1:100': 0.01, '2:1': 2, '5:1': 5, '10:1': 10,
};

/**
 * Render shapes directly to PDF document using vector primitives
 */
function renderPageVector(
  doc: jsPDF,
  shapes: Shape[],
  settings: PrintSettings,
  paperWidthMM: number,
  paperHeightMM: number,
  customPatterns?: CustomHatchPattern[],
): boolean {
  const bounds = calculateExtents(shapes);
  if (!bounds) return false;

  const margins = settings.margins;
  const printableWidthMM = paperWidthMM - margins.left - margins.right;
  const printableHeightMM = paperHeightMM - margins.top - margins.bottom;

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Calculate scale in mm (not pixels)
  let plotScale: number;
  if (settings.scale === 'Fit') {
    const scaleX = printableWidthMM / contentWidth;
    const scaleY = printableHeightMM / contentHeight;
    plotScale = Math.min(scaleX, scaleY);
  } else if (settings.customScale) {
    plotScale = settings.customScale;
  } else {
    plotScale = PLOT_SCALES[settings.scale] || 1;
  }

  let offsetX: number, offsetY: number;

  if (settings.centerPlot) {
    offsetX = margins.left + (printableWidthMM - contentWidth * plotScale) / 2 - bounds.minX * plotScale;
    offsetY = margins.top + (printableHeightMM - contentHeight * plotScale) / 2 - bounds.minY * plotScale;
  } else {
    offsetX = margins.left + settings.offsetX - bounds.minX * plotScale;
    offsetY = margins.top + settings.offsetY - bounds.minY * plotScale;
  }

  const renderOpts: VectorRenderOptions = {
    scale: plotScale,
    offsetX,
    offsetY,
    appearance: settings.appearance,
    plotLineweights: settings.plotLineweights,
    minLineWidthMM: 0.1,
    customPatterns,
  };

  renderShapesToPdf(doc, shapes, renderOpts);

  return true;
}

/**
 * Render parametric shapes to PDF using vector primitives
 */
function renderParametricShapesToPdf(
  doc: jsPDF,
  shapes: ParametricShape[],
  options: {
    scale: number;
    offsetX: number;
    offsetY: number;
    appearance: 'color' | 'grayscale' | 'blackLines';
  }
): void {
  const { scale, offsetX, offsetY, appearance } = options;

  const minLineWidthMM = 0.1;

  for (const shape of shapes) {
    if (shape.parametricType !== 'profile') continue;

    const profileShape = shape as ProfileParametricShape;
    const geometry = profileShape.generatedGeometry;

    if (!geometry || geometry.outlines.length === 0) continue;

    // Determine stroke color based on appearance settings
    let strokeColor = shape.style.strokeColor;
    if (appearance === 'blackLines') {
      strokeColor = '#000000';
    } else if (appearance === 'grayscale') {
      const hex = strokeColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      strokeColor = `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
    } else if (strokeColor === '#ffffff') {
      strokeColor = '#000000';
    }

    // Parse color
    const hex = strokeColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    doc.setDrawColor(r, g, b);
    doc.setLineWidth(Math.max(shape.style.strokeWidth * scale, minLineWidthMM));
    doc.setLineDashPattern([], 0);

    // Draw each outline
    for (let i = 0; i < geometry.outlines.length; i++) {
      const outline = geometry.outlines[i];
      const closed = geometry.closed[i];

      if (outline.length < 2) continue;

      // Build path
      const path: [number, number][] = [];
      const startX = outline[0].x * scale + offsetX;
      const startY = outline[0].y * scale + offsetY;

      for (let j = 1; j < outline.length; j++) {
        const prevX = outline[j - 1].x * scale + offsetX;
        const prevY = outline[j - 1].y * scale + offsetY;
        const currX = outline[j].x * scale + offsetX;
        const currY = outline[j].y * scale + offsetY;
        path.push([currX - prevX, currY - prevY]);
      }

      if (closed && outline.length > 2) {
        const lastX = outline[outline.length - 1].x * scale + offsetX;
        const lastY = outline[outline.length - 1].y * scale + offsetY;
        path.push([startX - lastX, startY - lastY]);
      }

      doc.lines(path, startX, startY, [1, 1], 'S', closed);
    }
  }
}

/**
 * Format scale for display (e.g., "1:100" or "2:1")
 */
function formatScale(scale: number): string {
  if (scale >= 1) {
    return `${scale}:1`;
  }
  const inverse = Math.round(1 / scale);
  return `1:${inverse}`;
}

/**
 * Render viewport title to PDF
 */
function renderViewportTitleToPdf(
  doc: jsPDF,
  vp: SheetViewport,
  drawingName: string,
  totalViewportsOnSheet: number
): void {
  // Check title visibility
  const titleVisibility = vp.titleVisibility ?? 'always';
  const shouldShowTitle =
    titleVisibility === 'always' ||
    (titleVisibility === 'whenMultiple' && totalViewportsOnSheet > 1);

  if (!shouldShowTitle) return;

  const showExtensionLine = vp.showExtensionLine ?? true;
  const showScale = vp.showScale ?? true;
  const title = vp.customTitle || drawingName;

  // Viewport position and dimensions in mm
  const vpX = vp.x;
  const vpBottomY = vp.y + vp.height;
  const vpWidth = vp.width;

  // Calculate extension line length
  const extensionLineLength = vp.extensionLineLength ?? vpWidth;

  // Vertical spacing (in mm)
  const lineY = vpBottomY + 2;
  const titleY = showExtensionLine ? lineY + 4 : vpBottomY + 4;
  const scaleY = titleY + 3;

  // Draw extension line (if enabled)
  if (showExtensionLine) {
    doc.setDrawColor(51, 51, 51); // #333333
    doc.setLineWidth(0.2);
    doc.line(vpX, lineY, vpX + extensionLineLength, lineY);
  }

  // Calculate text start position
  let textStartX = vpX;

  // Draw reference number in circle if present
  if (vp.referenceNumber) {
    const circleX = vpX + 3;
    const circleY = titleY - 1;
    const circleRadius = 2.5;

    // Draw circle
    doc.setDrawColor(51, 51, 51);
    doc.setLineWidth(0.3);
    doc.circle(circleX, circleY, circleRadius, 'S');

    // Draw reference number text centered in circle
    doc.setTextColor(51, 51, 51);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(vp.referenceNumber, circleX, circleY, { align: 'center', baseline: 'middle' });

    // Move text start position to after the circle
    textStartX = circleX + circleRadius + 2;
  }

  // Draw title
  doc.setTextColor(51, 51, 51);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, textStartX, titleY);

  // Draw scale (if enabled)
  if (showScale) {
    const scaleText = `Scale: ${formatScale(vp.scale)}`;
    doc.setTextColor(102, 102, 102); // #666666
    doc.setFontSize(7);
    doc.text(scaleText, textStartX, scaleY);
  }
}

/**
 * Render a sheet to PDF using vector primitives (with title block and viewports)
 */
async function renderSheetPageVector(
  doc: jsPDF,
  sheet: Sheet,
  allShapes: Shape[],
  allParametricShapes: ParametricShape[],
  settings: PrintSettings,
  customPatterns?: CustomHatchPattern[],
  drawings?: Drawing[],
): Promise<void> {
  const sheetPaper = PAPER_SIZES[sheet.paperSize];
  if (!sheetPaper) throw new Error(`Unknown paper size: ${sheet.paperSize}`);

  const sheetIsLandscape = sheet.orientation === 'landscape';
  const sheetWidthMM = sheetIsLandscape ? sheetPaper.height : sheetPaper.width;
  const sheetHeightMM = sheetIsLandscape ? sheetPaper.width : sheetPaper.height;

  // Check for SVG title block - render as raster image
  const svgTemplateId = (sheet.titleBlock as { svgTemplateId?: string }).svgTemplateId;
  let svgTemplate: ReturnType<typeof loadCustomSVGTemplates>[0] | undefined;

  if (svgTemplateId) {
    const svgTemplates = loadCustomSVGTemplates();
    svgTemplate = svgTemplates.find(t => t.id === svgTemplateId);

    if (svgTemplate) {
      // Render SVG title block as image (jsPDF can handle SVG directly in some cases)
      await renderSvgTitleBlockToPdf(
        doc,
        svgTemplate,
        sheet.titleBlock.fields,
        svgTemplate.isFullPage ? 0 : sheetWidthMM - svgTemplate.width - (sheet.titleBlock.x || 10),
        svgTemplate.isFullPage ? 0 : sheetHeightMM - svgTemplate.height - (sheet.titleBlock.y || 10),
        svgTemplate.isFullPage ? sheetWidthMM : svgTemplate.width,
        svgTemplate.isFullPage ? sheetHeightMM : svgTemplate.height
      );
    }
  }

  // Count visible viewports for "whenMultiple" title visibility
  const visibleViewports = sheet.viewports.filter(v => v.visible);
  const totalViewportsOnSheet = visibleViewports.length;

  // Render viewports using vector graphics
  for (const vp of sheet.viewports) {
    if (!vp.visible) continue;

    // Get the drawing for this viewport (needed for scale and name)
    const drawing = drawings?.find(d => d.id === vp.drawingId);

    // Get shapes for this viewport
    const vpShapes = allShapes.filter(s => s.drawingId === vp.drawingId && s.visible);
    const vpParametricShapes = allParametricShapes.filter(s => s.drawingId === vp.drawingId && s.visible);

    if (vpShapes.length > 0 || vpParametricShapes.length > 0) {
      // Save graphics state for clipping
      doc.saveGraphicsState();

      // Viewport dimensions (for calculating transforms, not for drawing boundary)
      const vpX = vp.x;
      const vpY = vp.y;
      const vpW = vp.width;
      const vpH = vp.height;

      // Note: We do NOT draw the viewport boundary rectangle - only the content inside

      const vpCenterX = vpX + vpW / 2;
      const vpCenterY = vpY + vpH / 2;
      const vpScale = vp.scale; // Already in mm

      const renderOpts: VectorRenderOptions = {
        scale: vpScale,
        offsetX: vpCenterX - vp.centerX * vpScale,
        offsetY: vpCenterY - vp.centerY * vpScale,
        appearance: settings.appearance,
        plotLineweights: settings.plotLineweights,
        minLineWidthMM: 0.1,
        customPatterns,
        drawingScale: drawing?.scale, // Pass drawing scale for proper text sizing
      };

      renderShapesToPdf(doc, vpShapes, renderOpts);

      // Render parametric shapes
      renderParametricShapesToPdf(doc, vpParametricShapes, {
        scale: vpScale,
        offsetX: vpCenterX - vp.centerX * vpScale,
        offsetY: vpCenterY - vp.centerY * vpScale,
        appearance: settings.appearance,
      });

      doc.restoreGraphicsState();
    }

    // Render viewport title (respects titleVisibility, showScale, showExtensionLine properties)
    const drawingName = drawing?.name || 'Untitled';
    renderViewportTitleToPdf(doc, vp, drawingName, totalViewportsOnSheet);
  }
}

/**
 * Helper to render SVG title block to PDF using vector graphics
 */
async function renderSvgTitleBlockToPdf(
  doc: jsPDF,
  template: ReturnType<typeof loadCustomSVGTemplates>[0],
  fields: { id: string; value: string }[],
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  const fieldValues: Record<string, string> = {};
  for (const field of fields) {
    fieldValues[field.id] = field.value || '';
  }

  const renderedSvg = renderSVGTitleBlock(template, fieldValues);

  // Parse SVG string into DOM element
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(renderedSvg, 'image/svg+xml');
  const svgElement = svgDoc.documentElement as unknown as SVGElement;

  // Check for parsing errors
  const parserError = svgDoc.querySelector('parsererror');
  if (parserError) {
    console.error('SVG parsing error:', parserError.textContent);
    return;
  }

  // Use svg2pdf.js to render SVG as vector graphics
  try {
    await svg2pdf(svgElement, doc, {
      x,
      y,
      width,
      height,
    });
  } catch (error) {
    console.error('Error rendering SVG title block to PDF:', error);
  }
}

export async function exportToPDF(options: {
  shapes: Shape[];
  sheets?: Sheet[];
  allShapes?: Shape[];
  allParametricShapes?: ParametricShape[];
  drawings?: Drawing[];
  settings: PrintSettings;
  projectName: string;
  activeSheet?: Sheet | null;
  customPatterns?: CustomHatchPattern[];
}): Promise<string | null> {
  const { shapes, sheets, allShapes, allParametricShapes = [], drawings, settings, projectName, activeSheet, customPatterns } = options;

  const paper = PAPER_SIZES[settings.paperSize];
  if (!paper) throw new Error(`Unknown paper size: ${settings.paperSize}`);

  const isLandscape = settings.orientation === 'landscape';
  const paperWidthMM = isLandscape ? paper.height : paper.width;
  const paperHeightMM = isLandscape ? paper.width : paper.height;

  const orientation = isLandscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [paperWidthMM, paperHeightMM],
  });

  if (settings.printRange === 'selectedSheets' && sheets && allShapes) {
    // Export selected sheets using vector rendering
    const selectedSheets = sheets.filter(s => settings.selectedSheetIds.includes(s.id));
    let firstPage = true;

    for (const sheet of selectedSheets) {
      const sheetPaper = PAPER_SIZES[sheet.paperSize];
      const sheetIsLandscape = sheet.orientation === 'landscape';
      const sheetWidthMM = sheetIsLandscape ? sheetPaper.height : sheetPaper.width;
      const sheetHeightMM = sheetIsLandscape ? sheetPaper.width : sheetPaper.height;
      const sheetOrientation = sheetIsLandscape ? 'landscape' : 'portrait';

      if (!firstPage) {
        doc.addPage([sheetWidthMM, sheetHeightMM], sheetOrientation);
      }
      firstPage = false;

      // Use vector rendering for sheet content
      await renderSheetPageVector(doc, sheet, allShapes, allParametricShapes, settings, customPatterns, drawings);
    }
  } else if (activeSheet && allShapes) {
    // Export current active sheet using vector rendering
    const sheetPaper = PAPER_SIZES[activeSheet.paperSize];
    const sheetIsLandscape = activeSheet.orientation === 'landscape';
    const sheetWidthMM = sheetIsLandscape ? sheetPaper.height : sheetPaper.width;
    const sheetHeightMM = sheetIsLandscape ? sheetPaper.width : sheetPaper.height;

    // Update doc page size to match sheet
    doc.internal.pageSize.width = sheetWidthMM;
    doc.internal.pageSize.height = sheetHeightMM;

    // Use vector rendering for sheet content
    await renderSheetPageVector(doc, activeSheet, allShapes, allParametricShapes, settings, customPatterns, drawings);
  } else {
    // Export drawing shapes only (no sheet) using vector rendering
    renderPageVector(doc, shapes, settings, paperWidthMM, paperHeightMM, customPatterns);
  }

  const pdfOutput = doc.output('arraybuffer');

  const filePath = await save({
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    title: 'Export PDF',
    defaultPath: `${projectName}.pdf`,
  });

  if (!filePath) return null;

  await writeFile(filePath, new Uint8Array(pdfOutput));
  return filePath;
}

/**
 * Generate a PDF for printing (saves to temp file, returns path)
 */
export async function generatePDFForPrint(options: {
  shapes: Shape[];
  sheets?: Sheet[];
  allShapes?: Shape[];
  allParametricShapes?: ParametricShape[];
  drawings?: Drawing[];
  settings: PrintSettings;
  projectName: string;
  activeSheet?: Sheet | null;
  customPatterns?: CustomHatchPattern[];
}): Promise<string> {
  const { shapes, sheets, allShapes, allParametricShapes = [], drawings, settings, projectName, activeSheet, customPatterns } = options;

  const paper = PAPER_SIZES[settings.paperSize];
  if (!paper) throw new Error(`Unknown paper size: ${settings.paperSize}`);

  const isLandscape = settings.orientation === 'landscape';
  const paperWidthMM = isLandscape ? paper.height : paper.width;
  const paperHeightMM = isLandscape ? paper.width : paper.height;

  const orientation = isLandscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [paperWidthMM, paperHeightMM],
  });

  if (settings.printRange === 'selectedSheets' && sheets && allShapes) {
    // Export selected sheets using vector rendering
    const selectedSheets = sheets.filter(s => settings.selectedSheetIds.includes(s.id));
    let firstPage = true;

    for (const sheet of selectedSheets) {
      const sheetPaper = PAPER_SIZES[sheet.paperSize];
      const sheetIsLandscape = sheet.orientation === 'landscape';
      const sheetWidthMM = sheetIsLandscape ? sheetPaper.height : sheetPaper.width;
      const sheetHeightMM = sheetIsLandscape ? sheetPaper.width : sheetPaper.height;
      const sheetOrientation = sheetIsLandscape ? 'landscape' : 'portrait';

      if (!firstPage) {
        doc.addPage([sheetWidthMM, sheetHeightMM], sheetOrientation);
      }
      firstPage = false;

      // Use vector rendering for sheet content
      await renderSheetPageVector(doc, sheet, allShapes, allParametricShapes, settings, customPatterns, drawings);
    }
  } else if (activeSheet && allShapes) {
    // Export current active sheet using vector rendering
    const sheetPaper = PAPER_SIZES[activeSheet.paperSize];
    const sheetIsLandscape = activeSheet.orientation === 'landscape';
    const sheetWidthMM = sheetIsLandscape ? sheetPaper.height : sheetPaper.width;
    const sheetHeightMM = sheetIsLandscape ? sheetPaper.width : sheetPaper.height;

    // Update doc page size to match sheet
    doc.internal.pageSize.width = sheetWidthMM;
    doc.internal.pageSize.height = sheetHeightMM;

    // Use vector rendering for sheet content
    await renderSheetPageVector(doc, activeSheet, allShapes, allParametricShapes, settings, customPatterns, drawings);
  } else {
    // Export drawing shapes only (no sheet) using vector rendering
    renderPageVector(doc, shapes, settings, paperWidthMM, paperHeightMM, customPatterns);
  }

  const pdfOutput = doc.output('arraybuffer');

  // Save to temp file
  const tempDirPath = await tempDir();
  const timestamp = Date.now();
  const tempFilePath = `${tempDirPath}${projectName}_print_${timestamp}.pdf`;

  await writeFile(tempFilePath, new Uint8Array(pdfOutput));
  return tempFilePath;
}
