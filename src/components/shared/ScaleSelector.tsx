/**
 * ScaleSelector - Component for selecting viewport scales
 *
 * Features:
 * - Common architectural scale presets
 * - Custom scale input
 * - Scale categories (detail, plan, site)
 */

import { useState, useCallback, useMemo } from 'react';

// Scale preset with display and category info
interface ScalePreset {
  value: number;
  display: string;
  category: 'detail' | 'plan' | 'site';
}

// All scale presets organized by category
const SCALE_PRESETS: ScalePreset[] = [
  { value: 1, display: '1:1', category: 'detail' },
  { value: 0.5, display: '1:2', category: 'plan' },
  { value: 0.2, display: '1:5', category: 'plan' },
  { value: 0.1, display: '1:10', category: 'plan' },
  { value: 0.05, display: '1:20', category: 'plan' },
  { value: 0.02, display: '1:50', category: 'plan' },
  { value: 0.01, display: '1:100', category: 'plan' },
  { value: 0.005, display: '1:200', category: 'plan' },
  { value: 0.002, display: '1:500', category: 'site' },
];

// Parse scale string to value
function parseScale(scaleStr: string): number | null {
  const match = scaleStr.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const numerator = parseFloat(match[1]);
  const denominator = parseFloat(match[2]);

  if (denominator === 0) return null;
  return numerator / denominator;
}

// Format scale value to display string
function formatScale(scale: number): string {
  if (scale >= 1) {
    if (Number.isInteger(scale)) {
      return `${scale}:1`;
    }
    return `${scale.toFixed(1)}:1`;
  }
  const inverse = 1 / scale;
  if (Number.isInteger(inverse)) {
    return `1:${inverse}`;
  }
  return `1:${Math.round(inverse)}`;
}

interface ScaleSelectorProps {
  /** Current scale value */
  value: number;
  /** Callback when scale changes */
  onChange: (scale: number) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Show category groups in dropdown */
  showCategories?: boolean;
  /** Allow custom scale input */
  allowCustom?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ScaleSelector({
  value,
  onChange,
  disabled = false,
  showCategories = true,
  allowCustom = true,
  className = '',
}: ScaleSelectorProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');

  // Check if current value matches a preset
  const currentPreset = useMemo(() => {
    return SCALE_PRESETS.find(preset => Math.abs(preset.value - value) < 0.0001);
  }, [value]);

  // Current display value
  const displayValue = currentPreset?.display || formatScale(value);

  // Handle preset selection
  const handlePresetSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;

    if (selectedValue === 'custom') {
      setIsCustomMode(true);
      setCustomInput(formatScale(value));
      return;
    }

    const preset = SCALE_PRESETS.find(p => p.display === selectedValue);
    if (preset) {
      onChange(preset.value);
    }
  }, [onChange, value]);

  // Handle custom input submit
  const handleCustomSubmit = useCallback(() => {
    const parsed = parseScale(customInput);
    if (parsed && parsed > 0) {
      onChange(parsed);
      setIsCustomMode(false);
    }
  }, [customInput, onChange]);

  // Handle custom input cancel
  const handleCustomCancel = useCallback(() => {
    setIsCustomMode(false);
    setCustomInput('');
  }, []);

  // Handle custom input key press
  const handleCustomKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomSubmit();
    } else if (e.key === 'Escape') {
      handleCustomCancel();
    }
  }, [handleCustomSubmit, handleCustomCancel]);

  // Custom input mode
  if (isCustomMode) {
    return (
      <div className={`flex gap-1 ${className}`}>
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          placeholder="e.g., 1:75"
          className="flex-1 px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text"
          autoFocus
        />
        <button
          onClick={handleCustomSubmit}
          className="px-2 py-1 text-xs bg-cad-accent text-white hover:bg-cad-accent/80"
          title="Apply"
        >
          OK
        </button>
        <button
          onClick={handleCustomCancel}
          className="px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text hover:bg-cad-hover"
          title="Cancel"
        >
          X
        </button>
      </div>
    );
  }

  // Normal dropdown mode
  return (
    <select
      value={currentPreset?.display || 'custom'}
      onChange={handlePresetSelect}
      disabled={disabled}
      className={`px-2 py-1 text-xs bg-cad-input border border-cad-border text-cad-text ${className}`}
    >
      {showCategories ? (
        <>
          <optgroup label="Detail Scales">
            {SCALE_PRESETS.filter(p => p.category === 'detail').map(preset => (
              <option key={preset.display} value={preset.display}>
                {preset.display}
              </option>
            ))}
          </optgroup>
          <optgroup label="Plan Scales">
            {SCALE_PRESETS.filter(p => p.category === 'plan').map(preset => (
              <option key={preset.display} value={preset.display}>
                {preset.display}
              </option>
            ))}
          </optgroup>
          <optgroup label="Site Scales">
            {SCALE_PRESETS.filter(p => p.category === 'site').map(preset => (
              <option key={preset.display} value={preset.display}>
                {preset.display}
              </option>
            ))}
          </optgroup>
          {allowCustom && (
            <optgroup label="Custom">
              {!currentPreset && (
                <option value="current" disabled>
                  {displayValue} (custom)
                </option>
              )}
              <option value="custom">Custom...</option>
            </optgroup>
          )}
        </>
      ) : (
        <>
          {SCALE_PRESETS.map(preset => (
            <option key={preset.display} value={preset.display}>
              {preset.display}
            </option>
          ))}
          {allowCustom && (
            <>
              {!currentPreset && (
                <option value="current" disabled>
                  {displayValue} (custom)
                </option>
              )}
              <option value="custom">Custom...</option>
            </>
          )}
        </>
      )}
    </select>
  );
}

// Export utilities for external use
export { SCALE_PRESETS, parseScale, formatScale };
export type { ScalePreset };
