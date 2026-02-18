/**
 * QuickAccessBar - Slim bar below the ribbon content area with quick actions.
 *
 * Always visible. Contains a "Continue" button that repeats the last
 * drawing/modify tool (same as pressing Enter when in select mode).
 *
 * When the Trim or Extend tool is active, shows a "Multiple" checkbox
 * that allows the user to trim/extend multiple elements without the
 * tool resetting to select after each operation.
 */

import { memo } from 'react';
import { RotateCw } from 'lucide-react';
import { useAppStore } from '../../../state/appStore';
import type { ToolType } from '../../../types/geometry';

// Display names for the "Continue" button label
const TOOL_DISPLAY_NAMES: Partial<Record<ToolType, string>> = {
  line: 'Line',
  rectangle: 'Rectangle',
  circle: 'Circle',
  arc: 'Arc',
  polyline: 'Polyline',
  ellipse: 'Ellipse',
  spline: 'Spline',
  text: 'Text',
  leader: 'Leader',
  dimension: 'Dimension',
  'filled-region': 'Filled Region',
  hatch: 'Hatch',
  beam: 'Beam',
  gridline: 'Grid Line',
  level: 'Level',
  pile: 'Pile',
  wall: 'Wall',
  slab: 'Slab',
  'section-callout': 'Section Callout',
  label: 'Label',
  image: 'Image',
  move: 'Move',
  copy: 'Copy',
  rotate: 'Rotate',
  scale: 'Scale',
  mirror: 'Mirror',
  trim: 'Trim',
  extend: 'Extend',
  fillet: 'Fillet',
  chamfer: 'Chamfer',
  offset: 'Offset',
  array: 'Array',
  'trim-walls': 'Wall/Beam/Duct Join',
};

/** Tools that show the "Multiple" checkbox in the quick access bar */
const MULTIPLE_TOOLS: ToolType[] = ['trim', 'extend'];

export const QuickAccessBar = memo(function QuickAccessBar() {
  const lastTool = useAppStore((s) => s.lastTool);
  const repeatLastTool = useAppStore((s) => s.repeatLastTool);
  const activeTool = useAppStore((s) => s.activeTool);
  const modifyMultiple = useAppStore((s) => s.modifyMultiple);
  const setModifyMultiple = useAppStore((s) => s.setModifyMultiple);

  const toolName = lastTool ? (TOOL_DISPLAY_NAMES[lastTool] || lastTool) : null;
  const isEnabled = lastTool !== null;

  const showMultiple = MULTIPLE_TOOLS.includes(activeTool);
  const activeToolName = TOOL_DISPLAY_NAMES[activeTool] || activeTool;

  return (
    <>
      <button
        className={`quick-access-btn ${isEnabled ? '' : 'disabled'}`}
        onClick={isEnabled ? repeatLastTool : undefined}
        disabled={!isEnabled}
        title={isEnabled ? `Continue ${toolName} (Enter)` : 'No previous tool to continue'}
      >
        <RotateCw size={10} />
        <span>Continue{toolName ? ` ${toolName}` : ''}</span>
      </button>

      {/* Multiple checkbox for Trim/Extend tools */}
      {showMultiple && (
        <>
          <span className="quick-access-separator" />
          <span className="quick-access-tool-label">{activeToolName}:</span>
          <label
            className="quick-access-checkbox"
            title="When checked, continue trimming/extending without resetting to Select after each operation"
          >
            <input
              type="checkbox"
              checked={modifyMultiple}
              onChange={(e) => setModifyMultiple(e.target.checked)}
            />
            <span>Multiple</span>
          </label>
        </>
      )}
    </>
  );
});
