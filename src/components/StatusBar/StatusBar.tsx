import { useAppStore } from '../../state/appStore';

export function StatusBar() {
  const {
    mousePosition,
    viewport,
    activeTool,
    gridSize,
    snapEnabled,
    selectedShapeIds,
    shapes,
  } = useAppStore();

  // Convert screen position to world position
  const worldX = (mousePosition.x - viewport.offsetX) / viewport.zoom;
  const worldY = (mousePosition.y - viewport.offsetY) / viewport.zoom;

  return (
    <div className="h-6 bg-cad-surface border-t border-cad-border flex items-center px-3 text-xs text-cad-text-dim gap-6">
      {/* Coordinates */}
      <div className="flex items-center gap-2">
        <span>X:</span>
        <span className="text-cad-text font-mono w-20">{worldX.toFixed(2)}</span>
        <span>Y:</span>
        <span className="text-cad-text font-mono w-20">{worldY.toFixed(2)}</span>
      </div>

      {/* Zoom level */}
      <div className="flex items-center gap-2">
        <span>Zoom:</span>
        <span className="text-cad-text font-mono">{(viewport.zoom * 100).toFixed(0)}%</span>
      </div>

      {/* Grid size */}
      <div className="flex items-center gap-2">
        <span>Grid:</span>
        <span className="text-cad-text font-mono">{gridSize}</span>
      </div>

      {/* Snap status */}
      <div className="flex items-center gap-2">
        <span>Snap:</span>
        <span className={`font-mono ${snapEnabled ? 'text-green-400' : 'text-cad-text-dim'}`}>
          {snapEnabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Active tool */}
      <div className="flex items-center gap-2">
        <span>Tool:</span>
        <span className="text-cad-accent font-mono uppercase">{activeTool}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Selection count */}
      <div className="flex items-center gap-2">
        <span>Selected:</span>
        <span className="text-cad-text font-mono">{selectedShapeIds.length}</span>
      </div>

      {/* Total objects */}
      <div className="flex items-center gap-2">
        <span>Objects:</span>
        <span className="text-cad-text font-mono">{shapes.length}</span>
      </div>
    </div>
  );
}
