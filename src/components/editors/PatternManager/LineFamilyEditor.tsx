/**
 * LineFamilyEditor - Component for editing individual line family properties
 */

import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { LineFamily } from '../../../types/hatch';

interface LineFamilyEditorProps {
  family: LineFamily;
  index: number;
  onChange: (updated: LineFamily) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function LineFamilyEditor({
  family,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: LineFamilyEditorProps) {
  const [expanded, setExpanded] = useState(true);

  const handleChange = <K extends keyof LineFamily>(key: K, value: LineFamily[K]) => {
    onChange({ ...family, [key]: value });
  };

  const handleDashPatternChange = (value: string) => {
    if (!value.trim()) {
      handleChange('dashPattern', undefined);
      return;
    }

    // Parse comma-separated values
    const parts = value.split(',').map(s => s.trim());
    const numbers = parts.map(s => parseFloat(s)).filter(n => !isNaN(n));

    if (numbers.length > 0) {
      handleChange('dashPattern', numbers);
    }
  };

  const dashPatternString = family.dashPattern?.join(', ') || '';

  return (
    <div className="border border-cad-border rounded bg-cad-bg/50 mb-2">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-cad-surface border-b border-cad-border">
        <button
          className="p-0.5 hover:bg-cad-hover rounded cursor-grab"
          title="Drag to reorder"
        >
          <GripVertical size={12} className="text-cad-text-dim" />
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 hover:bg-cad-hover rounded"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <span className="text-xs font-medium flex-1">
          Line {index + 1}: {family.angle}° @ {family.deltaY}px
        </span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 hover:bg-cad-hover rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-0.5 hover:bg-cad-hover rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-0.5 hover:bg-red-500/20 hover:text-red-400 rounded"
            title="Delete line family"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Row 1: Angle and Spacing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
                Angle (degrees)
              </label>
              <input
                type="number"
                value={family.angle}
                onChange={(e) => handleChange('angle', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent"
                step={15}
              />
            </div>
            <div>
              <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
                Spacing (deltaY)
              </label>
              <input
                type="number"
                value={family.deltaY}
                onChange={(e) => handleChange('deltaY', parseFloat(e.target.value) || 1)}
                className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent"
                min={1}
                step={1}
              />
            </div>
          </div>

          {/* Row 2: Origin */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
                Origin X
              </label>
              <input
                type="number"
                value={family.originX}
                onChange={(e) => handleChange('originX', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent"
                step={1}
              />
            </div>
            <div>
              <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
                Origin Y
              </label>
              <input
                type="number"
                value={family.originY}
                onChange={(e) => handleChange('originY', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent"
                step={1}
              />
            </div>
          </div>

          {/* Row 3: Offset (stagger) */}
          <div>
            <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
              Offset / Stagger (deltaX)
            </label>
            <input
              type="number"
              value={family.deltaX}
              onChange={(e) => handleChange('deltaX', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent"
              step={1}
            />
            <p className="text-[10px] text-cad-text-dim mt-0.5">
              Horizontal shift between rows (for brick patterns)
            </p>
          </div>

          {/* Row 4: Dash Pattern */}
          <div>
            <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
              Dash Pattern
            </label>
            <input
              type="text"
              value={dashPatternString}
              onChange={(e) => handleDashPatternChange(e.target.value)}
              placeholder="Empty = continuous line"
              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent font-mono"
            />
            <p className="text-[10px] text-cad-text-dim mt-0.5">
              Comma-separated: positive = dash, negative = gap, 0 = dot
            </p>
          </div>

          {/* Row 5: Stroke Width */}
          <div>
            <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
              Stroke Width (optional)
            </label>
            <input
              type="number"
              value={family.strokeWidth || ''}
              onChange={(e) => handleChange('strokeWidth', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Default"
              className="w-full px-2 py-1 text-xs bg-cad-input border border-cad-border rounded focus:outline-none focus:border-cad-accent"
              min={0.1}
              step={0.5}
            />
          </div>

          {/* Visual angle picker + Quick Angles */}
          <div>
            <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
              Angle
            </label>
            <div className="flex items-center gap-3">
              {/* Clickable angle circle */}
              <div className="relative flex-shrink-0">
                <svg
                  width={56}
                  height={56}
                  viewBox="-28 -28 56 56"
                  className="cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dx = e.clientX - cx;
                    const dy = -(e.clientY - cy); // flip Y for math coords
                    let deg = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
                    if (deg < 0) deg += 360;
                    // Snap to nearest 15 degrees
                    deg = Math.round(deg / 15) * 15;
                    if (deg >= 360) deg -= 360;
                    handleChange('angle', deg);
                  }}
                >
                  <circle cx={0} cy={0} r={24} fill="none" stroke="currentColor" strokeWidth={1} className="text-cad-border" />
                  {/* Tick marks at 0, 45, 90, 135 */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
                    const rad = a * Math.PI / 180;
                    return (
                      <line key={a} x1={Math.cos(rad) * 21} y1={-Math.sin(rad) * 21} x2={Math.cos(rad) * 24} y2={-Math.sin(rad) * 24}
                        stroke="currentColor" strokeWidth={1} className="text-cad-text-dim" />
                    );
                  })}
                  {/* Current angle indicator line */}
                  <line
                    x1={0} y1={0}
                    x2={Math.cos(family.angle * Math.PI / 180) * 20}
                    y2={-Math.sin(family.angle * Math.PI / 180) * 20}
                    stroke="currentColor" strokeWidth={2} className="text-cad-accent"
                    strokeLinecap="round"
                  />
                  <circle cx={0} cy={0} r={2} fill="currentColor" className="text-cad-accent" />
                </svg>
              </div>
              {/* Quick angle buttons */}
              <div className="flex flex-wrap gap-1 flex-1">
                {[0, 30, 45, 60, 90, 120, 135, 150].map(angle => (
                  <button
                    key={angle}
                    onClick={() => handleChange('angle', angle)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      family.angle === angle
                        ? 'bg-cad-accent border-cad-accent text-white'
                        : 'bg-cad-input border-cad-border hover:border-cad-text-dim'
                    }`}
                  >
                    {angle}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dash pattern presets */}
          <div>
            <label className="text-[10px] text-cad-text-dim uppercase tracking-wide block mb-1">
              Dash Presets
            </label>
            <div className="flex flex-wrap gap-1 mb-1">
              {([
                { label: 'Solid', pattern: undefined },
                { label: 'Dashed', pattern: [6, -4] },
                { label: 'Dotted', pattern: [0] },
                { label: 'Dash-Dot', pattern: [6, -3, 0, -3] },
              ] as { label: string; pattern: number[] | undefined }[]).map(preset => {
                const isActive = JSON.stringify(family.dashPattern) === JSON.stringify(preset.pattern);
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleChange('dashPattern', preset.pattern)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      isActive
                        ? 'bg-cad-accent border-cad-accent text-white'
                        : 'bg-cad-input border-cad-border hover:border-cad-text-dim'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Default line family for new entries
 */
export function createDefaultLineFamily(): LineFamily {
  return {
    angle: 45,
    originX: 0,
    originY: 0,
    deltaX: 0,
    deltaY: 10,
  };
}
