import { useState, useCallback, useEffect } from 'react';
import { X, Printer, FileDown } from 'lucide-react';
import { useAppStore } from '../../state/appStore';
import type { Shape, Point } from '../../types/geometry';

// Paper sizes in mm
const PAPER_SIZES: Record<string, { width: number; height: number; label: string }> = {
  'A4': { width: 210, height: 297, label: 'A4 (210 x 297 mm)' },
  'A3': { width: 297, height: 420, label: 'A3 (297 x 420 mm)' },
  'A2': { width: 420, height: 594, label: 'A2 (420 x 594 mm)' },
  'A1': { width: 594, height: 841, label: 'A1 (594 x 841 mm)' },
  'A0': { width: 841, height: 1189, label: 'A0 (841 x 1189 mm)' },
  'Letter': { width: 216, height: 279, label: 'Letter (8.5 x 11 in)' },
  'Legal': { width: 216, height: 356, label: 'Legal (8.5 x 14 in)' },
  'Tabloid': { width: 279, height: 432, label: 'Tabloid (11 x 17 in)' },
};

const PLOT_SCALES: Record<string, number> = {
  'Fit': 0,  // Special case - fit to paper
  '1:1': 1,
  '1:2': 0.5,
  '1:5': 0.2,
  '1:10': 0.1,
  '1:20': 0.05,
  '1:50': 0.02,
  '1:100': 0.01,
  '2:1': 2,
  '5:1': 5,
  '10:1': 10,
};

export type PlotArea = 'display' | 'extents' | 'window';
export type Orientation = 'portrait' | 'landscape';

export interface PrintSettings {
  paperSize: string;
  orientation: Orientation;
  plotArea: PlotArea;
  windowStart?: Point;
  windowEnd?: Point;
  scale: string;
  customScale?: number;
  centerPlot: boolean;
  offsetX: number;
  offsetY: number;
  plotLineweights: boolean;
}

interface PrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintDialog({ isOpen, onClose }: PrintDialogProps) {
  const { shapes, viewport, canvasSize } = useAppStore();

  const [settings, setSettings] = useState<PrintSettings>({
    paperSize: 'A4',
    orientation: 'landscape',
    plotArea: 'extents',
    scale: 'Fit',
    centerPlot: true,
    offsetX: 0,
    offsetY: 0,
    plotLineweights: true,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Calculate bounding box of all shapes
  const calculateExtents = useCallback((): { minX: number; minY: number; maxX: number; maxY: number } | null => {
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
          for (const point of shape.points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          }
          break;
      }
    }

    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, [shapes]);

  // Get plot area bounds
  const getPlotBounds = useCallback(() => {
    switch (settings.plotArea) {
      case 'extents':
        return calculateExtents();
      case 'display':
        // Current viewport in world coordinates
        return {
          minX: -viewport.offsetX / viewport.zoom,
          minY: -viewport.offsetY / viewport.zoom,
          maxX: (canvasSize.width - viewport.offsetX) / viewport.zoom,
          maxY: (canvasSize.height - viewport.offsetY) / viewport.zoom,
        };
      case 'window':
        if (settings.windowStart && settings.windowEnd) {
          return {
            minX: Math.min(settings.windowStart.x, settings.windowEnd.x),
            minY: Math.min(settings.windowStart.y, settings.windowEnd.y),
            maxX: Math.max(settings.windowStart.x, settings.windowEnd.x),
            maxY: Math.max(settings.windowStart.y, settings.windowEnd.y),
          };
        }
        return calculateExtents();
      default:
        return calculateExtents();
    }
  }, [settings.plotArea, settings.windowStart, settings.windowEnd, calculateExtents, viewport, canvasSize]);

  // Draw shape on canvas
  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape, scale: number, offsetX: number, offsetY: number) => {
    ctx.strokeStyle = shape.style.strokeColor;
    ctx.lineWidth = settings.plotLineweights ? shape.style.strokeWidth * scale : 1;

    // Set line style
    switch (shape.style.lineStyle) {
      case 'dashed':
        ctx.setLineDash([8 * scale, 4 * scale]);
        break;
      case 'dotted':
        ctx.setLineDash([2 * scale, 2 * scale]);
        break;
      case 'dashdot':
        ctx.setLineDash([8 * scale, 4 * scale, 2 * scale, 4 * scale]);
        break;
      default:
        ctx.setLineDash([]);
    }

    const tx = (x: number) => (x * scale) + offsetX;
    const ty = (y: number) => (y * scale) + offsetY;

    switch (shape.type) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(tx(shape.start.x), ty(shape.start.y));
        ctx.lineTo(tx(shape.end.x), ty(shape.end.y));
        ctx.stroke();
        break;

      case 'rectangle':
        ctx.beginPath();
        ctx.rect(tx(shape.topLeft.x), ty(shape.topLeft.y), shape.width * scale, shape.height * scale);
        ctx.stroke();
        break;

      case 'circle':
        ctx.beginPath();
        ctx.arc(tx(shape.center.x), ty(shape.center.y), shape.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'arc':
        ctx.beginPath();
        ctx.arc(tx(shape.center.x), ty(shape.center.y), shape.radius * scale, shape.startAngle, shape.endAngle);
        ctx.stroke();
        break;

      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(
          tx(shape.center.x),
          ty(shape.center.y),
          shape.radiusX * scale,
          shape.radiusY * scale,
          shape.rotation,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        break;

      case 'polyline':
        if (shape.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(tx(shape.points[0].x), ty(shape.points[0].y));
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(tx(shape.points[i].x), ty(shape.points[i].y));
          }
          if (shape.closed) {
            ctx.closePath();
          }
          ctx.stroke();
        }
        break;
    }
  };

  // Generate preview
  const generatePreview = useCallback(() => {
    const bounds = getPlotBounds();
    if (!bounds) return;

    const paper = PAPER_SIZES[settings.paperSize];
    const isLandscape = settings.orientation === 'landscape';
    const paperWidth = isLandscape ? paper.height : paper.width;
    const paperHeight = isLandscape ? paper.width : paper.height;

    // Preview canvas (scaled down for display)
    const previewScale = 0.5;
    const canvas = document.createElement('canvas');
    canvas.width = paperWidth * previewScale;
    canvas.height = paperHeight * previewScale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate scale to fit content
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;

    let plotScale: number;
    if (settings.scale === 'Fit') {
      const scaleX = (paperWidth - 20) / contentWidth;  // 10mm margin
      const scaleY = (paperHeight - 20) / contentHeight;
      plotScale = Math.min(scaleX, scaleY);
    } else if (settings.customScale) {
      plotScale = settings.customScale;
    } else {
      plotScale = PLOT_SCALES[settings.scale] || 1;
    }

    // Apply preview scale
    plotScale *= previewScale;

    // Calculate offset
    let offsetX: number, offsetY: number;
    if (settings.centerPlot) {
      offsetX = (canvas.width - contentWidth * plotScale) / 2 - bounds.minX * plotScale;
      offsetY = (canvas.height - contentHeight * plotScale) / 2 - bounds.minY * plotScale;
    } else {
      offsetX = settings.offsetX * previewScale - bounds.minX * plotScale;
      offsetY = settings.offsetY * previewScale - bounds.minY * plotScale;
    }

    // Draw all visible shapes
    for (const shape of shapes) {
      if (!shape.visible) continue;
      drawShape(ctx, shape, plotScale, offsetX, offsetY);
    }

    // Draw border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    setPreviewUrl(canvas.toDataURL());
  }, [shapes, settings, getPlotBounds]);

  // Update preview when settings change
  useEffect(() => {
    if (isOpen) {
      generatePreview();
    }
  }, [isOpen, settings, generatePreview]);

  // Export to PDF
  const exportToPDF = async () => {
    setIsExporting(true);

    try {
      const bounds = getPlotBounds();
      if (!bounds) {
        alert('No content to print');
        setIsExporting(false);
        return;
      }

      const paper = PAPER_SIZES[settings.paperSize];
      const isLandscape = settings.orientation === 'landscape';
      const paperWidthMM = isLandscape ? paper.height : paper.width;
      const paperHeightMM = isLandscape ? paper.width : paper.height;

      // Convert mm to pixels at 96 DPI (standard screen DPI)
      // 1 inch = 25.4 mm, 1 inch = 96 pixels
      const mmToPx = 96 / 25.4;
      const paperWidthPx = paperWidthMM * mmToPx;
      const paperHeightPx = paperHeightMM * mmToPx;

      // Create high-res canvas
      const canvas = document.createElement('canvas');
      canvas.width = paperWidthPx * 2;  // 2x for better quality
      canvas.height = paperHeightPx * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Scale context for high-res
      ctx.scale(2, 2);

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, paperWidthPx, paperHeightPx);

      // Calculate scale
      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;

      let plotScale: number;
      if (settings.scale === 'Fit') {
        const marginPx = 10 * mmToPx;  // 10mm margin
        const scaleX = (paperWidthPx - marginPx * 2) / contentWidth;
        const scaleY = (paperHeightPx - marginPx * 2) / contentHeight;
        plotScale = Math.min(scaleX, scaleY);
      } else if (settings.customScale) {
        plotScale = settings.customScale * mmToPx;
      } else {
        plotScale = (PLOT_SCALES[settings.scale] || 1) * mmToPx;
      }

      // Calculate offset
      let offsetX: number, offsetY: number;
      if (settings.centerPlot) {
        offsetX = (paperWidthPx - contentWidth * plotScale) / 2 - bounds.minX * plotScale;
        offsetY = (paperHeightPx - contentHeight * plotScale) / 2 - bounds.minY * plotScale;
      } else {
        offsetX = settings.offsetX * mmToPx - bounds.minX * plotScale;
        offsetY = settings.offsetY * mmToPx - bounds.minY * plotScale;
      }

      // Draw all visible shapes
      for (const shape of shapes) {
        if (!shape.visible) continue;
        drawShape(ctx, shape, plotScale, offsetX, offsetY);
      }

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Failed to generate PDF');
          setIsExporting(false);
          return;
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drawing-${Date.now()}.png`;  // PNG for now, PDF requires library
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsExporting(false);
        onClose();
      }, 'image/png');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error as Error).message);
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cad-surface border border-cad-border rounded-lg shadow-2xl w-[700px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cad-border">
          <h2 className="text-lg font-semibold text-cad-text flex items-center gap-2">
            <Printer size={20} />
            Plot / Print
          </h2>
          <button
            onClick={onClose}
            className="text-cad-text-dim hover:text-cad-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex">
          {/* Settings Panel */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Paper Size */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-cad-text">Paper Size</label>
              <select
                value={settings.paperSize}
                onChange={(e) => setSettings({ ...settings, paperSize: e.target.value })}
                className="w-full bg-cad-bg border border-cad-border rounded px-3 py-2 text-cad-text focus:outline-none focus:border-cad-accent"
              >
                {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-cad-text">Drawing Orientation</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="orientation"
                    checked={settings.orientation === 'portrait'}
                    onChange={() => setSettings({ ...settings, orientation: 'portrait' })}
                    className="accent-cad-accent"
                  />
                  <span className="text-sm text-cad-text">Portrait</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="orientation"
                    checked={settings.orientation === 'landscape'}
                    onChange={() => setSettings({ ...settings, orientation: 'landscape' })}
                    className="accent-cad-accent"
                  />
                  <span className="text-sm text-cad-text">Landscape</span>
                </label>
              </div>
            </div>

            {/* Plot Area */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-cad-text">Plot Area</label>
              <select
                value={settings.plotArea}
                onChange={(e) => setSettings({ ...settings, plotArea: e.target.value as PlotArea })}
                className="w-full bg-cad-bg border border-cad-border rounded px-3 py-2 text-cad-text focus:outline-none focus:border-cad-accent"
              >
                <option value="extents">Extents</option>
                <option value="display">Display</option>
                <option value="window">Window</option>
              </select>
              {settings.plotArea === 'window' && !settings.windowStart && (
                <p className="text-xs text-yellow-500">Use PLOT command with Window option to define plot window</p>
              )}
            </div>

            {/* Plot Scale */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-cad-text">Plot Scale</label>
              <select
                value={settings.scale}
                onChange={(e) => setSettings({ ...settings, scale: e.target.value })}
                className="w-full bg-cad-bg border border-cad-border rounded px-3 py-2 text-cad-text focus:outline-none focus:border-cad-accent"
              >
                {Object.keys(PLOT_SCALES).map((scale) => (
                  <option key={scale} value={scale}>{scale === 'Fit' ? 'Fit to Paper' : scale}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
              {settings.scale === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={settings.customScale || 1}
                    onChange={(e) => setSettings({ ...settings, customScale: parseFloat(e.target.value) || 1 })}
                    className="w-20 bg-cad-bg border border-cad-border rounded px-2 py-1 text-cad-text focus:outline-none focus:border-cad-accent"
                    step="0.1"
                    min="0.01"
                  />
                  <span className="text-sm text-cad-text-dim">mm = 1 unit</span>
                </div>
              )}
            </div>

            {/* Plot Offset */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-cad-text">Plot Offset</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-cad-text-dim">X:</span>
                  <input
                    type="number"
                    value={settings.offsetX}
                    onChange={(e) => setSettings({ ...settings, offsetX: parseFloat(e.target.value) || 0, centerPlot: false })}
                    disabled={settings.centerPlot}
                    className="w-20 bg-cad-bg border border-cad-border rounded px-2 py-1 text-cad-text focus:outline-none focus:border-cad-accent disabled:opacity-50"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-sm text-cad-text-dim">Y:</span>
                  <input
                    type="number"
                    value={settings.offsetY}
                    onChange={(e) => setSettings({ ...settings, offsetY: parseFloat(e.target.value) || 0, centerPlot: false })}
                    disabled={settings.centerPlot}
                    className="w-20 bg-cad-bg border border-cad-border rounded px-2 py-1 text-cad-text focus:outline-none focus:border-cad-accent disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.centerPlot}
                  onChange={(e) => setSettings({ ...settings, centerPlot: e.target.checked })}
                  className="accent-cad-accent"
                />
                <span className="text-sm text-cad-text">Center the plot</span>
              </label>
            </div>

            {/* Plot Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-cad-text">Plot Options</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.plotLineweights}
                  onChange={(e) => setSettings({ ...settings, plotLineweights: e.target.checked })}
                  className="accent-cad-accent"
                />
                <span className="text-sm text-cad-text">Plot object lineweights</span>
              </label>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-64 p-4 border-l border-cad-border bg-cad-bg/50">
            <label className="text-sm font-medium text-cad-text mb-2 block">Preview</label>
            <div className="bg-white rounded border border-cad-border overflow-hidden aspect-[1/1.414] flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Print preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-cad-text-dim text-sm">No preview</span>
              )}
            </div>
            <p className="text-xs text-cad-text-dim mt-2 text-center">
              {PAPER_SIZES[settings.paperSize]?.label} - {settings.orientation}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-cad-border">
          <button
            onClick={generatePreview}
            className="px-4 py-2 text-sm text-cad-text hover:bg-cad-border rounded transition-colors"
          >
            Refresh Preview
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-cad-text hover:bg-cad-border rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={exportToPDF}
            disabled={isExporting}
            className="px-4 py-2 text-sm bg-cad-accent text-white rounded hover:bg-cad-accent/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <FileDown size={16} />
            {isExporting ? 'Exporting...' : 'Export to PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
