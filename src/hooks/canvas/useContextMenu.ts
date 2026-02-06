/**
 * useContextMenu - Manages right-click context menu state and items
 */

import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../../state/appStore';
import type { ContextMenuEntry } from '../../components/shared/ContextMenu';
import type { Point } from '../../types/geometry';
import type { ToolType } from '../../state/slices/types';

// Tool display names for "Repeat [Tool]" menu item
const TOOL_DISPLAY_NAMES: Record<ToolType, string> = {
  'select': 'Select',
  'pan': 'Pan',
  'line': 'Line',
  'rectangle': 'Rectangle',
  'circle': 'Circle',
  'arc': 'Arc',
  'polyline': 'Polyline',
  'ellipse': 'Ellipse',
  'spline': 'Spline',
  'text': 'Text',
  'dimension': 'Dimension',
  'filled-region': 'Filled Region',
  'insulation': 'Insulation',
  'hatch': 'Hatch',
  'detail-component': 'Detail Component',
  'beam': 'Beam',
  'move': 'Move',
  'copy': 'Copy',
  'rotate': 'Rotate',
  'scale': 'Scale',
  'mirror': 'Mirror',
  'trim': 'Trim',
  'extend': 'Extend',
  'fillet': 'Fillet',
  'chamfer': 'Chamfer',
  'offset': 'Offset',
  'array': 'Array',
  'sheet-text': 'Sheet Text',
  'sheet-leader': 'Sheet Leader',
  'sheet-dimension': 'Sheet Dimension',
  'sheet-callout': 'Sheet Callout',
  'sheet-revision-cloud': 'Revision Cloud',
};

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

export function useContextMenu() {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const {
    selectedShapeIds,
    shapes,
    lastTool,
    // Actions
    deleteSelectedShapes,
    copySelectedShapes,
    cutSelectedShapes,
    pasteShapes,
    hasClipboardContent,
    selectAll,
    setActiveTool,
    repeatLastTool,
    hideSelectedShapes,
    showAllShapes,
    isolateSelectedShapes,
    lockSelectedShapes,
    unlockSelectedShapes,
    unlockAllShapes,
    groupSelectedShapes,
    ungroupSelectedShapes,
    bringToFront,
    bringForward,
    sendBackward,
    sendToBack,
    zoomToSelection,
    zoomToFit,
  } = useAppStore();

  const openMenu = useCallback((x: number, y: number) => {
    setMenuState({ isOpen: true, x, y });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Check if selected shapes have groups
  const hasGroupedShapes = useMemo(() => {
    const selected = shapes.filter(s => selectedShapeIds.includes(s.id));
    return selected.some(s => s.groupId);
  }, [shapes, selectedShapeIds]);

  // Build menu items based on context
  const getMenuItems = useCallback((clickedOnShape: boolean, pastePosition?: Point): ContextMenuEntry[] => {
    const hasSelection = selectedShapeIds.length > 0;
    const hasClipboard = hasClipboardContent();
    const canGroup = selectedShapeIds.length >= 2;

    // "Repeat [Tool]" item at the top when lastTool exists
    const repeatItem: ContextMenuEntry[] = lastTool ? [
      {
        id: 'repeat',
        label: `Repeat ${TOOL_DISPLAY_NAMES[lastTool] || lastTool}`,
        shortcut: 'Enter',
        action: repeatLastTool,
      },
      { type: 'divider' },
    ] : [];

    // Menu when shapes are selected or clicked on a shape
    if (hasSelection || clickedOnShape) {
      const items: ContextMenuEntry[] = [
        ...repeatItem,
        {
          id: 'delete',
          label: 'Delete',
          shortcut: 'Del',
          action: deleteSelectedShapes,
          disabled: !hasSelection,
        },
        { type: 'divider' },
        {
          id: 'copy',
          label: 'Copy',
          shortcut: 'Ctrl+C',
          action: copySelectedShapes,
          disabled: !hasSelection,
        },
        {
          id: 'cut',
          label: 'Cut',
          shortcut: 'Ctrl+X',
          action: cutSelectedShapes,
          disabled: !hasSelection,
        },
        {
          id: 'paste',
          label: 'Paste',
          shortcut: 'Ctrl+V',
          action: () => pasteShapes(pastePosition),
          disabled: !hasClipboard,
        },
        { type: 'divider' },
        {
          id: 'move',
          label: 'Move',
          shortcut: 'MV',
          action: () => setActiveTool('move'),
          disabled: !hasSelection,
        },
        {
          id: 'rotate',
          label: 'Rotate',
          shortcut: 'RO',
          action: () => setActiveTool('rotate'),
          disabled: !hasSelection,
        },
        {
          id: 'scale',
          label: 'Scale',
          shortcut: 'RE',
          action: () => setActiveTool('scale'),
          disabled: !hasSelection,
        },
        {
          id: 'mirror',
          label: 'Mirror',
          shortcut: 'MM',
          action: () => setActiveTool('mirror'),
          disabled: !hasSelection,
        },
        { type: 'divider' },
        {
          id: 'select-all',
          label: 'Select All',
          shortcut: 'Ctrl+A',
          action: selectAll,
        },
        { type: 'divider' },
        {
          id: 'group',
          label: 'Group',
          shortcut: 'Ctrl+G',
          action: groupSelectedShapes,
          disabled: !canGroup,
        },
        {
          id: 'ungroup',
          label: 'Ungroup',
          shortcut: 'Ctrl+Shift+G',
          action: ungroupSelectedShapes,
          disabled: !hasGroupedShapes,
        },
        { type: 'divider' },
        {
          id: 'bring-to-front',
          label: 'Bring to Front',
          action: bringToFront,
          disabled: !hasSelection,
        },
        {
          id: 'bring-forward',
          label: 'Bring Forward',
          action: bringForward,
          disabled: !hasSelection,
        },
        {
          id: 'send-backward',
          label: 'Send Backward',
          action: sendBackward,
          disabled: !hasSelection,
        },
        {
          id: 'send-to-back',
          label: 'Send to Back',
          action: sendToBack,
          disabled: !hasSelection,
        },
        { type: 'divider' },
        {
          id: 'hide',
          label: 'Hide',
          shortcut: 'H',
          action: hideSelectedShapes,
          disabled: !hasSelection,
        },
        {
          id: 'show-all',
          label: 'Show All',
          shortcut: 'Shift+H',
          action: showAllShapes,
        },
        {
          id: 'isolate',
          label: 'Isolate',
          shortcut: 'I',
          action: isolateSelectedShapes,
          disabled: !hasSelection,
        },
        { type: 'divider' },
        {
          id: 'lock',
          label: 'Lock',
          shortcut: 'L',
          action: lockSelectedShapes,
          disabled: !hasSelection,
        },
        {
          id: 'unlock',
          label: 'Unlock',
          shortcut: 'Shift+L',
          action: unlockSelectedShapes,
          disabled: !hasSelection,
        },
        { type: 'divider' },
        {
          id: 'zoom-to-selection',
          label: 'Zoom to Selection',
          action: zoomToSelection,
          disabled: !hasSelection,
        },
      ];

      return items;
    }

    // Menu when clicking empty space
    return [
      ...repeatItem,
      {
        id: 'paste',
        label: 'Paste',
        shortcut: 'Ctrl+V',
        action: () => pasteShapes(pastePosition),
        disabled: !hasClipboard,
      },
      { type: 'divider' },
      {
        id: 'select-all',
        label: 'Select All',
        shortcut: 'Ctrl+A',
        action: selectAll,
      },
      { type: 'divider' },
      {
        id: 'show-all',
        label: 'Show All Hidden',
        action: showAllShapes,
      },
      {
        id: 'unlock-all',
        label: 'Unlock All',
        action: unlockAllShapes,
      },
      { type: 'divider' },
      {
        id: 'zoom-to-fit',
        label: 'Zoom to Fit',
        action: zoomToFit,
      },
    ];
  }, [
    selectedShapeIds,
    hasClipboardContent,
    hasGroupedShapes,
    lastTool,
    deleteSelectedShapes,
    copySelectedShapes,
    cutSelectedShapes,
    pasteShapes,
    selectAll,
    setActiveTool,
    repeatLastTool,
    hideSelectedShapes,
    showAllShapes,
    isolateSelectedShapes,
    lockSelectedShapes,
    unlockSelectedShapes,
    unlockAllShapes,
    groupSelectedShapes,
    ungroupSelectedShapes,
    bringToFront,
    bringForward,
    sendBackward,
    sendToBack,
    zoomToSelection,
    zoomToFit,
  ]);

  return {
    menuState,
    openMenu,
    closeMenu,
    getMenuItems,
  };
}
