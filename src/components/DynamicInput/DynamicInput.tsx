import { useAppStore } from '../../state/appStore';
import { getDistance, getAngle } from '../../utils/coordinateParser';

/**
 * DynamicInput - Tooltip that appears near the cursor
 * Shows coordinates, distance, and angle while drawing
 */
export function DynamicInput() {
  const {
    activeTool,
    drawingPoints,
    isDrawing,
    mousePosition,
    viewport,
    canvasSize,
  } = useAppStore();

  // Only show when drawing with certain tools
  const showDynamicInput =
    isDrawing &&
    drawingPoints.length > 0 &&
    (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle');

  if (!showDynamicInput) return null;

  // Convert screen position to world coordinates
  const worldX = (mousePosition.x - viewport.offsetX) / viewport.zoom;
  const worldY = (mousePosition.y - viewport.offsetY) / viewport.zoom;

  // Get last point for relative calculations
  const lastPoint = drawingPoints[drawingPoints.length - 1];
  const currentPoint = { x: worldX, y: worldY };

  // Calculate distance and angle from last point
  const distance = getDistance(lastPoint, currentPoint);
  const angle = getAngle(lastPoint, currentPoint);

  // Calculate relative offsets
  const deltaX = worldX - lastPoint.x;
  const deltaY = worldY - lastPoint.y;

  // Position the tooltip near the cursor (offset to not overlap)
  const tooltipX = Math.min(mousePosition.x + 20, canvasSize.width - 200);
  const tooltipY = Math.min(mousePosition.y + 20, canvasSize.height - 80);

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: tooltipX,
        top: tooltipY,
      }}
    >
      <div className="bg-cad-surface/95 border border-cad-accent rounded shadow-lg p-2 font-mono text-xs">
        {/* Absolute Coordinates */}
        <div className="flex items-center gap-2 text-cad-text">
          <span className="text-cad-text-dim w-8">X:</span>
          <span className="text-cad-accent font-semibold">{worldX.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-cad-text">
          <span className="text-cad-text-dim w-8">Y:</span>
          <span className="text-cad-accent font-semibold">{worldY.toFixed(2)}</span>
        </div>

        {/* Separator */}
        <div className="border-t border-cad-border my-1.5" />

        {/* Relative / Polar Info */}
        <div className="flex items-center gap-2 text-cad-text">
          <span className="text-cad-text-dim w-8">Dist:</span>
          <span className="text-green-400 font-semibold">{distance.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-cad-text">
          <span className="text-cad-text-dim w-8">Angle:</span>
          <span className="text-yellow-400 font-semibold">{angle.toFixed(1)}°</span>
        </div>

        {/* Delta values */}
        <div className="border-t border-cad-border my-1.5" />
        <div className="flex items-center gap-2 text-cad-text text-[10px]">
          <span className="text-cad-text-dim">ΔX:</span>
          <span>{deltaX.toFixed(2)}</span>
          <span className="text-cad-text-dim ml-2">ΔY:</span>
          <span>{deltaY.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
