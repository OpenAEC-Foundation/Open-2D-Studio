import { memo, useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../state/appStore';
import type { LineStyle, Shape, TextAlignment, TextVerticalAlignment, HatchPatternType } from '../../types/geometry';
import type { ParametricShape, ProfileParametricShape } from '../../types/parametric';
import { PROFILE_TEMPLATES } from '../../services/parametric/profileTemplates';
import { DrawingPropertiesPanel } from './DrawingPropertiesPanel';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

const inputClass = 'w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text';
const labelClass = 'block text-xs text-cad-text-dim mb-1';

function NumberField({ label, value, onChange, step = 1, min, max, readOnly }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; readOnly?: boolean;
}) {
  return (
    <div className="mb-2">
      <label className={labelClass}>{label}</label>
      <input type="number" step={step} min={min} max={max} readOnly={readOnly}
        value={Math.round(value * 1000) / 1000}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={inputClass} />
    </div>
  );
}

function TextField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2">
      <label className={labelClass}>{label}</label>
      <input type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass} />
    </div>
  );
}

function CheckboxField({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <input type="checkbox" checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-cad-accent" />
      <label className="text-xs text-cad-text">{label}</label>
    </div>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="mb-2">
      <label className={labelClass}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const NAMED_COLORS: { hex: string; name?: string }[] = [
  // Row 1: Primary + Secondary
  { hex: '#ff0000', name: 'Red' }, { hex: '#ff8000', name: 'Orange' }, { hex: '#ffff00', name: 'Yellow' }, { hex: '#00ff00', name: 'Green' },
  { hex: '#00ffff', name: 'Cyan' }, { hex: '#0000ff', name: 'Blue' }, { hex: '#8000ff', name: 'Violet' }, { hex: '#ff00ff', name: 'Magenta' },
  // Row 2: Dark variants
  { hex: '#800000', name: 'Maroon' }, { hex: '#804000', name: 'Brown' }, { hex: '#808000', name: 'Olive' }, { hex: '#008000', name: 'Dark Green' },
  { hex: '#008080', name: 'Teal' }, { hex: '#000080', name: 'Navy' }, { hex: '#400080', name: 'Indigo' }, { hex: '#800080', name: 'Purple' },
  // Row 3: Light variants
  { hex: '#ff9999', name: 'Light Red' }, { hex: '#ffcc99', name: 'Peach' }, { hex: '#ffff99', name: 'Light Yellow' }, { hex: '#99ff99', name: 'Light Green' },
  { hex: '#99ffff', name: 'Light Cyan' }, { hex: '#9999ff', name: 'Light Blue' }, { hex: '#cc99ff', name: 'Lavender' }, { hex: '#ff99ff', name: 'Light Pink' },
  // Row 4: Grays
  { hex: '#000000', name: 'Black' }, { hex: '#404040', name: 'Dark Gray' }, { hex: '#808080', name: 'Gray' }, { hex: '#a0a0a0', name: 'Medium Gray' },
  { hex: '#c0c0c0', name: 'Silver' }, { hex: '#d9d9d9', name: 'Light Gray' }, { hex: '#f0f0f0', name: 'Near White' }, { hex: '#ffffff', name: 'White' },
];

function ColorPalette({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="mb-2" ref={ref}>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2 relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-6 h-6 rounded-sm border border-cad-border cursor-pointer shrink-0 hover:border-cad-accent"
          style={{ backgroundColor: value }}
        />
        <input type="text" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text font-mono" />
        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-cad-surface border border-cad-border rounded shadow-lg p-2">
            <div className="grid grid-cols-8 gap-1">
              {NAMED_COLORS.map((c, i) => (
                <button
                  key={i}
                  title={c.name ? `${c.name}\n${c.hex}` : c.hex}
                  onClick={() => { onChange(c.hex); setOpen(false); }}
                  className={`w-5 h-5 rounded-sm border ${
                    value.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-cad-accent border-2'
                      : 'border-cad-border hover:border-cad-text'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-cad-border">
              <label className="block text-xs text-cad-text-dim mb-1">Custom Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={value}
                  onChange={(e) => { onChange(e.target.value); }}
                  className="w-8 h-8 rounded border border-cad-border cursor-pointer" />
                <input type="text" value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpen(false); }}
                  className="flex-1 bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text font-mono"
                  placeholder="#rrggbb" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ParametricShapeProperties({ shape }: { shape: ParametricShape }) {
  const updateProfileParameters = useAppStore(s => s.updateProfileParameters);
  const updateProfilePosition = useAppStore(s => s.updateProfilePosition);
  const updateProfileRotation = useAppStore(s => s.updateProfileRotation);

  if (shape.parametricType !== 'profile') {
    return <div className="text-xs text-cad-text-dim">Unknown parametric type</div>;
  }

  const profileShape = shape as ProfileParametricShape;
  const template = PROFILE_TEMPLATES[profileShape.profileType];

  const handleParameterChange = (paramId: string, value: number) => {
    updateProfileParameters(shape.id, { [paramId]: value });
  };

  return (
    <>
      <div className="mb-3 p-2 bg-cad-bg rounded border border-cad-border">
        <div className="text-xs font-semibold text-cad-accent mb-1">
          {template?.name || profileShape.profileType}
        </div>
        {profileShape.presetId && (
          <div className="text-xs text-cad-text-dim">
            Preset: {profileShape.presetId}
          </div>
        )}
        {profileShape.standard && (
          <div className="text-xs text-cad-text-dim">
            Standard: {profileShape.standard}
          </div>
        )}
      </div>

      {/* Position */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-cad-text mb-2">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={profileShape.position.x}
            onChange={(v) => updateProfilePosition(shape.id, { ...profileShape.position, x: v })}
            step={1}
          />
          <NumberField
            label="Y"
            value={profileShape.position.y}
            onChange={(v) => updateProfilePosition(shape.id, { ...profileShape.position, y: v })}
            step={1}
          />
        </div>
      </div>

      {/* Rotation */}
      <NumberField
        label="Rotation (deg)"
        value={profileShape.rotation * RAD2DEG}
        onChange={(v) => updateProfileRotation(shape.id, v * DEG2RAD)}
        step={1}
      />

      {/* Parameters */}
      {template && (
        <div className="mt-3 pt-3 border-t border-cad-border">
          <label className="block text-xs font-semibold text-cad-text mb-2">Parameters</label>
          {template.parameters.map((param) => (
            <NumberField
              key={param.id}
              label={`${param.label}${param.unit ? ` (${param.unit})` : ''}`}
              value={(profileShape.parameters[param.id] as number) || (param.defaultValue as number)}
              onChange={(v) => handleParameterChange(param.id, v)}
              step={param.step || 1}
              min={param.min}
              max={param.max}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Component for editing common properties when multiple shapes of the same type are selected
function MultiSelectShapeProperties({
  shapes,
  updateShape
}: {
  shapes: Shape[];
  updateShape: (id: string, updates: Partial<Shape>) => void;
}) {
  const updateAll = (updates: Record<string, unknown>) => {
    shapes.forEach(shape => updateShape(shape.id, updates as Partial<Shape>));
  };

  const shapeType = shapes[0]?.type;
  if (!shapeType) return null;

  // Get common value or return undefined if values differ
  const getCommonValue = <T,>(getter: (shape: Shape) => T): T | undefined => {
    const firstValue = getter(shapes[0]);
    const allSame = shapes.every(s => getter(s) === firstValue);
    return allSame ? firstValue : undefined;
  };

  switch (shapeType) {
    case 'text': {
      const textShapes = shapes as Extract<Shape, { type: 'text' }>[];
      const commonFontFamily = getCommonValue(s => (s as typeof textShapes[0]).fontFamily);
      const commonFontSize = getCommonValue(s => (s as typeof textShapes[0]).fontSize);
      const commonLineHeight = getCommonValue(s => (s as typeof textShapes[0]).lineHeight);
      const commonBold = getCommonValue(s => (s as typeof textShapes[0]).bold);
      const commonItalic = getCommonValue(s => (s as typeof textShapes[0]).italic);
      const commonUnderline = getCommonValue(s => (s as typeof textShapes[0]).underline);
      const commonColor = getCommonValue(s => (s as typeof textShapes[0]).color);
      const commonAlignment = getCommonValue(s => (s as typeof textShapes[0]).alignment);
      const commonVerticalAlignment = getCommonValue(s => (s as typeof textShapes[0]).verticalAlignment);

      return (
        <>
          <TextField
            label="Font Family"
            value={commonFontFamily ?? ''}
            onChange={(v) => updateAll({ fontFamily: v })}
          />
          <NumberField
            label="Font Size"
            value={commonFontSize ?? textShapes[0].fontSize}
            onChange={(v) => updateAll({ fontSize: v })}
            step={1}
            min={1}
          />
          <NumberField
            label="Line Height"
            value={commonLineHeight ?? textShapes[0].lineHeight}
            onChange={(v) => updateAll({ lineHeight: v })}
            step={0.1}
            min={0.5}
          />
          <div className="mb-2 flex items-center gap-3">
            <CheckboxField
              label="Bold"
              value={commonBold ?? false}
              onChange={(v) => updateAll({ bold: v })}
            />
            <CheckboxField
              label="Italic"
              value={commonItalic ?? false}
              onChange={(v) => updateAll({ italic: v })}
            />
            <CheckboxField
              label="Underline"
              value={commonUnderline ?? false}
              onChange={(v) => updateAll({ underline: v })}
            />
          </div>
          <ColorPalette
            label="Text Color"
            value={commonColor ?? textShapes[0].color}
            onChange={(v) => updateAll({ color: v })}
          />
          <SelectField
            label="Alignment"
            value={commonAlignment ?? 'left'}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' }
            ] as { value: TextAlignment; label: string }[]}
            onChange={(v) => updateAll({ alignment: v })}
          />
          <SelectField
            label="Vertical Alignment"
            value={commonVerticalAlignment ?? 'top'}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' }
            ] as { value: TextVerticalAlignment; label: string }[]}
            onChange={(v) => updateAll({ verticalAlignment: v })}
          />
        </>
      );
    }

    case 'circle': {
      const circleShapes = shapes as Extract<Shape, { type: 'circle' }>[];
      const commonRadius = getCommonValue(s => (s as typeof circleShapes[0]).radius);
      return (
        <>
          <NumberField
            label="Radius"
            value={commonRadius ?? circleShapes[0].radius}
            onChange={(v) => updateAll({ radius: v })}
            step={0.1}
            min={0.1}
          />
        </>
      );
    }

    case 'rectangle': {
      const rectShapes = shapes as Extract<Shape, { type: 'rectangle' }>[];
      const commonWidth = getCommonValue(s => (s as typeof rectShapes[0]).width);
      const commonHeight = getCommonValue(s => (s as typeof rectShapes[0]).height);
      const commonRotation = getCommonValue(s => (s as typeof rectShapes[0]).rotation);
      return (
        <>
          <NumberField
            label="Width"
            value={commonWidth ?? rectShapes[0].width}
            onChange={(v) => updateAll({ width: v })}
            step={0.1}
            min={0.1}
          />
          <NumberField
            label="Height"
            value={commonHeight ?? rectShapes[0].height}
            onChange={(v) => updateAll({ height: v })}
            step={0.1}
            min={0.1}
          />
          <NumberField
            label="Rotation (deg)"
            value={(commonRotation ?? rectShapes[0].rotation) * RAD2DEG}
            onChange={(v) => updateAll({ rotation: v * DEG2RAD })}
            step={1}
          />
        </>
      );
    }

    case 'hatch': {
      const hatchShapes = shapes as Extract<Shape, { type: 'hatch' }>[];
      const commonPatternType = getCommonValue(s => (s as typeof hatchShapes[0]).patternType);
      const commonPatternAngle = getCommonValue(s => (s as typeof hatchShapes[0]).patternAngle);
      const commonPatternScale = getCommonValue(s => (s as typeof hatchShapes[0]).patternScale);
      const commonFillColor = getCommonValue(s => (s as typeof hatchShapes[0]).fillColor);
      const commonBackgroundColor = getCommonValue(s => (s as typeof hatchShapes[0]).backgroundColor);
      return (
        <>
          <SelectField
            label="Pattern Type"
            value={commonPatternType ?? 'solid'}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'hatch', label: 'Hatch' },
              { value: 'crosshatch', label: 'Crosshatch' },
              { value: 'dots', label: 'Dots' },
              { value: 'custom', label: 'Custom' },
            ] as { value: HatchPatternType; label: string }[]}
            onChange={(v) => updateAll({ patternType: v })}
          />
          <NumberField
            label="Pattern Angle (deg)"
            value={commonPatternAngle ?? 0}
            onChange={(v) => updateAll({ patternAngle: v })}
            step={15}
          />
          <NumberField
            label="Pattern Scale"
            value={commonPatternScale ?? 1}
            onChange={(v) => updateAll({ patternScale: v })}
            step={0.1}
            min={0.1}
          />
          <ColorPalette
            label="Fill Color"
            value={commonFillColor ?? hatchShapes[0].fillColor}
            onChange={(v) => updateAll({ fillColor: v })}
          />
          {commonPatternType !== 'solid' && (
            <ColorPalette
              label="Background Color"
              value={commonBackgroundColor ?? 'transparent'}
              onChange={(v) => updateAll({ backgroundColor: v })}
            />
          )}
        </>
      );
    }

    // For other shape types, no additional common properties to edit
    default:
      return null;
  }
}

function ShapeProperties({ shape, updateShape }: { shape: Shape; updateShape: (id: string, updates: Partial<Shape>) => void }) {
  const update = (updates: Record<string, unknown>) => updateShape(shape.id, updates as Partial<Shape>);

  switch (shape.type) {
    case 'text':
      return (
        <>
          <div className="mb-2">
            <label className={labelClass}>Text</label>
            <textarea value={shape.text} rows={3}
              onChange={(e) => update({ text: e.target.value })}
              className={inputClass + ' resize-y'} />
          </div>
          <TextField label="Font Family" value={shape.fontFamily} onChange={(v) => update({ fontFamily: v })} />
          <NumberField label="Font Size" value={shape.fontSize} onChange={(v) => update({ fontSize: v })} step={1} min={1} />
          <NumberField label="Line Height" value={shape.lineHeight} onChange={(v) => update({ lineHeight: v })} step={0.1} min={0.5} />
          <div className="mb-2 flex items-center gap-3">
            <CheckboxField label="Bold" value={shape.bold} onChange={(v) => update({ bold: v })} />
            <CheckboxField label="Italic" value={shape.italic} onChange={(v) => update({ italic: v })} />
            <CheckboxField label="Underline" value={shape.underline} onChange={(v) => update({ underline: v })} />
          </div>
          <div className="mb-2">
            <label className={labelClass}>Text Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={shape.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-8 h-8 rounded border border-cad-border cursor-pointer" />
              <input type="text" value={shape.color}
                onChange={(e) => update({ color: e.target.value })}
                className="flex-1 bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text font-mono" />
            </div>
          </div>
          <SelectField label="Alignment" value={shape.alignment}
            options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] as { value: TextAlignment; label: string }[]}
            onChange={(v) => update({ alignment: v })} />
          <SelectField label="Vertical Alignment" value={shape.verticalAlignment}
            options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }] as { value: TextVerticalAlignment; label: string }[]}
            onChange={(v) => update({ verticalAlignment: v })} />
          <NumberField label="Rotation (deg)" value={shape.rotation * RAD2DEG} onChange={(v) => update({ rotation: v * DEG2RAD })} step={1} />
          <NumberField label="Position X" value={shape.position.x} onChange={(v) => update({ position: { ...shape.position, x: v } })} step={0.1} />
          <NumberField label="Position Y" value={shape.position.y} onChange={(v) => update({ position: { ...shape.position, y: v } })} step={0.1} />
        </>
      );

    case 'line':
      return (
        <>
          <NumberField label="Start X" value={shape.start.x} onChange={(v) => update({ start: { ...shape.start, x: v } })} step={0.1} />
          <NumberField label="Start Y" value={shape.start.y} onChange={(v) => update({ start: { ...shape.start, y: v } })} step={0.1} />
          <NumberField label="End X" value={shape.end.x} onChange={(v) => update({ end: { ...shape.end, x: v } })} step={0.1} />
          <NumberField label="End Y" value={shape.end.y} onChange={(v) => update({ end: { ...shape.end, y: v } })} step={0.1} />
        </>
      );

    case 'rectangle':
      return (
        <>
          <NumberField label="Top-Left X" value={shape.topLeft.x} onChange={(v) => update({ topLeft: { ...shape.topLeft, x: v } })} step={0.1} />
          <NumberField label="Top-Left Y" value={shape.topLeft.y} onChange={(v) => update({ topLeft: { ...shape.topLeft, y: v } })} step={0.1} />
          <NumberField label="Width" value={shape.width} onChange={(v) => update({ width: v })} step={0.1} min={0.1} />
          <NumberField label="Height" value={shape.height} onChange={(v) => update({ height: v })} step={0.1} min={0.1} />
          <NumberField label="Rotation (deg)" value={shape.rotation * RAD2DEG} onChange={(v) => update({ rotation: v * DEG2RAD })} step={1} />
        </>
      );

    case 'circle':
      return (
        <>
          <NumberField label="Center X" value={shape.center.x} onChange={(v) => update({ center: { ...shape.center, x: v } })} step={0.1} />
          <NumberField label="Center Y" value={shape.center.y} onChange={(v) => update({ center: { ...shape.center, y: v } })} step={0.1} />
          <NumberField label="Radius" value={shape.radius} onChange={(v) => update({ radius: v })} step={0.1} min={0.1} />
        </>
      );

    case 'arc':
      return (
        <>
          <NumberField label="Center X" value={shape.center.x} onChange={(v) => update({ center: { ...shape.center, x: v } })} step={0.1} />
          <NumberField label="Center Y" value={shape.center.y} onChange={(v) => update({ center: { ...shape.center, y: v } })} step={0.1} />
          <NumberField label="Radius" value={shape.radius} onChange={(v) => update({ radius: v })} step={0.1} min={0.1} />
          <NumberField label="Start Angle (deg)" value={shape.startAngle * RAD2DEG} onChange={(v) => update({ startAngle: v * DEG2RAD })} step={1} />
          <NumberField label="End Angle (deg)" value={shape.endAngle * RAD2DEG} onChange={(v) => update({ endAngle: v * DEG2RAD })} step={1} />
        </>
      );

    case 'ellipse':
      return (
        <>
          <NumberField label="Center X" value={shape.center.x} onChange={(v) => update({ center: { ...shape.center, x: v } })} step={0.1} />
          <NumberField label="Center Y" value={shape.center.y} onChange={(v) => update({ center: { ...shape.center, y: v } })} step={0.1} />
          <NumberField label="Radius X" value={shape.radiusX} onChange={(v) => update({ radiusX: v })} step={0.1} min={0.1} />
          <NumberField label="Radius Y" value={shape.radiusY} onChange={(v) => update({ radiusY: v })} step={0.1} min={0.1} />
          <NumberField label="Rotation (deg)" value={shape.rotation * RAD2DEG} onChange={(v) => update({ rotation: v * DEG2RAD })} step={1} />
        </>
      );

    case 'polyline':
      return (
        <>
          <CheckboxField label="Closed" value={shape.closed} onChange={(v) => update({ closed: v })} />
          <NumberField label="Point Count" value={shape.points.length} onChange={() => {}} readOnly />
        </>
      );

    case 'spline':
      return (
        <>
          <CheckboxField label="Closed" value={shape.closed} onChange={(v) => update({ closed: v })} />
          <NumberField label="Control Points" value={shape.points.length} onChange={() => {}} readOnly />
        </>
      );

    case 'hatch': {
      const { userPatterns, projectPatterns } = useAppStore.getState();
      const customPatterns = [...userPatterns, ...projectPatterns];

      return (
        <>
          <SelectField label="Pattern Type" value={shape.patternType}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'diagonal', label: 'Diagonal' },
              { value: 'crosshatch', label: 'Crosshatch' },
              { value: 'horizontal', label: 'Horizontal' },
              { value: 'vertical', label: 'Vertical' },
              { value: 'dots', label: 'Dots' },
              { value: 'custom', label: 'Custom' },
            ] as { value: HatchPatternType; label: string }[]}
            onChange={(v) => update({ patternType: v })} />
          {shape.patternType === 'custom' && (
            <SelectField
              label="Custom Pattern"
              value={shape.customPatternId || ''}
              options={[
                { value: '', label: '-- Select Pattern --' },
                ...customPatterns.map(p => ({ value: p.id, label: p.name })),
              ]}
              onChange={(v) => update({ customPatternId: v || undefined })}
            />
          )}
          {shape.patternType === 'custom' && customPatterns.length === 0 && (
            <div className="text-xs text-yellow-500 mb-2">
              No custom patterns. Create one in Pattern Manager.
            </div>
          )}
          <NumberField label="Pattern Angle (deg)" value={shape.patternAngle} onChange={(v) => update({ patternAngle: v })} step={1} />
          <NumberField label="Pattern Scale" value={shape.patternScale} onChange={(v) => update({ patternScale: v })} step={0.1} min={0.1} />
          <ColorPalette label="Fill Color" value={shape.fillColor} onChange={(v) => update({ fillColor: v })} />
          <ColorPalette label="Background Color" value={shape.backgroundColor || '#000000'} onChange={(v) => update({ backgroundColor: v })} />
          {shape.backgroundColor && (
            <button
              onClick={() => update({ backgroundColor: undefined })}
              className="text-xs text-cad-accent hover:underline -mt-1 mb-2">
              Clear background
            </button>
          )}
          <NumberField label="Boundary Points" value={shape.points.length} onChange={() => {}} readOnly />
        </>
      );
    }

    default:
      return (
        <div className="text-xs text-cad-text-dim">
          ID: {shape.id.slice(0, 8)}...
        </div>
      );
  }
}

export const PropertiesPanel = memo(function PropertiesPanel() {
  const selectedShapeIds = useAppStore(s => s.selectedShapeIds);
  const shapes = useAppStore(s => s.shapes);
  const parametricShapes = useAppStore(s => s.parametricShapes);
  const currentStyle = useAppStore(s => s.currentStyle);
  const setCurrentStyle = useAppStore(s => s.setCurrentStyle);
  const updateShape = useAppStore(s => s.updateShape);

  const selectedShapes = shapes.filter((s) => selectedShapeIds.includes(s.id));
  const selectedParametricShapes = parametricShapes.filter((s) => selectedShapeIds.includes(s.id));
  const hasSelection = selectedShapes.length > 0 || selectedParametricShapes.length > 0;
  const hasRegularShapeSelection = selectedShapes.length > 0;

  // Get common style from selection (or use current style)
  // For parametric shapes, use their style or fall back to current style
  const displayStyle = hasRegularShapeSelection
    ? selectedShapes[0].style
    : selectedParametricShapes.length > 0
      ? selectedParametricShapes[0].style
      : currentStyle;

  const handleColorChange = (color: string) => {
    if (hasRegularShapeSelection) {
      selectedShapes.forEach((shape) => {
        updateShape(shape.id, { style: { ...shape.style, strokeColor: color } });
      });
    } else {
      setCurrentStyle({ strokeColor: color });
    }
  };

  const handleWidthChange = (width: number) => {
    if (hasRegularShapeSelection) {
      selectedShapes.forEach((shape) => {
        updateShape(shape.id, { style: { ...shape.style, strokeWidth: width } });
      });
    } else {
      setCurrentStyle({ strokeWidth: width });
    }
  };

  const handleLineStyleChange = (lineStyle: LineStyle) => {
    if (hasRegularShapeSelection) {
      selectedShapes.forEach((shape) => {
        updateShape(shape.id, { style: { ...shape.style, lineStyle } });
      });
    } else {
      setCurrentStyle({ lineStyle });
    }
  };

  if (!hasSelection) {
    return (
      <div className="flex-1 overflow-auto">
        <DrawingPropertiesPanel showHeader={false} />
      </div>
    );
  }

  const totalSelected = selectedShapes.length + selectedParametricShapes.length;

  // If only parametric shapes selected, show parametric properties
  if (selectedParametricShapes.length > 0 && selectedShapes.length === 0) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-3">
          {/* Selection info */}
          <div className="text-xs text-cad-text-dim mb-4">
            {selectedParametricShapes.length} parametric shape{selectedParametricShapes.length > 1 ? 's' : ''} selected
          </div>

          {/* Parametric shape properties */}
          {selectedParametricShapes.length === 1 && (
            <ParametricShapeProperties shape={selectedParametricShapes[0]} />
          )}

          {selectedParametricShapes.length > 1 && (
            <div className="text-xs text-cad-text-dim">
              Select a single parametric shape to edit its properties.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-3">
        {/* Selection info */}
        <div className="text-xs text-cad-text-dim mb-4">
          {totalSelected} object{totalSelected > 1 ? 's' : ''} selected
          {selectedParametricShapes.length > 0 && selectedShapes.length > 0 && (
            <span className="block text-cad-text-dim">
              ({selectedShapes.length} shapes, {selectedParametricShapes.length} parametric)
            </span>
          )}
        </div>

        {/* Stroke Color */}
        <ColorPalette label="Stroke Color" value={displayStyle.strokeColor} onChange={handleColorChange} />

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

        {/* Shape-specific properties - single selection */}
        {selectedShapes.length === 1 && selectedParametricShapes.length === 0 && (
          <div className="mt-4 pt-4 border-t border-cad-border">
            <h4 className="text-xs font-semibold text-cad-text mb-2">
              {selectedShapes[0].type.charAt(0).toUpperCase() +
                selectedShapes[0].type.slice(1)}{' '}
              Properties
            </h4>
            <ShapeProperties shape={selectedShapes[0]} updateShape={updateShape} />
          </div>
        )}

        {/* Shape-specific properties - multi-selection of same type */}
        {selectedShapes.length > 1 && selectedParametricShapes.length === 0 && (() => {
          const firstType = selectedShapes[0].type;
          const allSameType = selectedShapes.every(s => s.type === firstType);
          if (!allSameType) return null;

          return (
            <div className="mt-4 pt-4 border-t border-cad-border">
              <h4 className="text-xs font-semibold text-cad-text mb-2">
                {firstType.charAt(0).toUpperCase() + firstType.slice(1)} Properties
                <span className="font-normal text-cad-text-dim ml-1">({selectedShapes.length} selected)</span>
              </h4>
              <MultiSelectShapeProperties shapes={selectedShapes} updateShape={updateShape} />
            </div>
          );
        })()}
      </div>
    </div>
  );
});
