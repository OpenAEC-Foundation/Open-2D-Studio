import { useAppStore } from '../../state/appStore';
import type { LineStyle } from '../../types/geometry';

export function PropertiesPanel() {
  const { selectedShapeIds, shapes, currentStyle, setCurrentStyle, updateShape } =
    useAppStore();

  const selectedShapes = shapes.filter((s) => selectedShapeIds.includes(s.id));
  const hasSelection = selectedShapes.length > 0;

  // Get common style from selection (or use current style)
  const displayStyle = hasSelection ? selectedShapes[0].style : currentStyle;

  const handleColorChange = (color: string) => {
    if (hasSelection) {
      selectedShapes.forEach((shape) => {
        updateShape(shape.id, { style: { ...shape.style, strokeColor: color } });
      });
    } else {
      setCurrentStyle({ strokeColor: color });
    }
  };

  const handleWidthChange = (width: number) => {
    if (hasSelection) {
      selectedShapes.forEach((shape) => {
        updateShape(shape.id, { style: { ...shape.style, strokeWidth: width } });
      });
    } else {
      setCurrentStyle({ strokeWidth: width });
    }
  };

  const handleLineStyleChange = (lineStyle: LineStyle) => {
    if (hasSelection) {
      selectedShapes.forEach((shape) => {
        updateShape(shape.id, { style: { ...shape.style, lineStyle } });
      });
    } else {
      setCurrentStyle({ lineStyle });
    }
  };

  return (
    <div className="flex-1 border-b border-cad-border overflow-auto">
      <div className="p-3">
        <h3 className="text-sm font-semibold text-cad-text mb-3">Properties</h3>

        {/* Selection info */}
        <div className="text-xs text-cad-text-dim mb-4">
          {hasSelection
            ? `${selectedShapes.length} object${selectedShapes.length > 1 ? 's' : ''} selected`
            : 'No selection'}
        </div>

        {/* Stroke Color */}
        <div className="mb-3">
          <label className="block text-xs text-cad-text-dim mb-1">Stroke Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={displayStyle.strokeColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-8 h-8 rounded border border-cad-border cursor-pointer"
            />
            <input
              type="text"
              value={displayStyle.strokeColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="flex-1 bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text font-mono"
            />
          </div>
        </div>

        {/* Stroke Width */}
        <div className="mb-3">
          <label className="block text-xs text-cad-text-dim mb-1">Stroke Width</label>
          <input
            type="number"
            min="0.5"
            max="20"
            step="0.5"
            value={displayStyle.strokeWidth}
            onChange={(e) => handleWidthChange(parseFloat(e.target.value) || 1)}
            className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text"
          />
        </div>

        {/* Line Style */}
        <div className="mb-3">
          <label className="block text-xs text-cad-text-dim mb-1">Line Style</label>
          <select
            value={displayStyle.lineStyle}
            onChange={(e) => handleLineStyleChange(e.target.value as LineStyle)}
            className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="dashdot">Dash-Dot</option>
          </select>
        </div>

        {/* Shape-specific properties */}
        {hasSelection && selectedShapes.length === 1 && (
          <div className="mt-4 pt-4 border-t border-cad-border">
            <h4 className="text-xs font-semibold text-cad-text mb-2">
              {selectedShapes[0].type.charAt(0).toUpperCase() +
                selectedShapes[0].type.slice(1)}{' '}
              Properties
            </h4>
            <div className="text-xs text-cad-text-dim">
              ID: {selectedShapes[0].id.slice(0, 8)}...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
