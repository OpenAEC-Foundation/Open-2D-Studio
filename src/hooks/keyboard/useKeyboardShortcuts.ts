import { useEffect } from 'react';
import { useAppStore } from '../../state/appStore';

// Common viewport scales (as ratios, e.g., 0.01 = 1:100)
const VIEWPORT_SCALES = [
  1,      // 1:1
  0.5,    // 1:2
  0.2,    // 1:5
  0.1,    // 1:10
  0.05,   // 1:20
  0.02,   // 1:50
  0.01,   // 1:100
  0.005,  // 1:200
  0.002,  // 1:500
  0.001,  // 1:1000
];

// Two-key shortcut sequences (two-key style)
const TWO_KEY_SHORTCUTS: Record<string, string> = {
  'md': 'select',
  'mv': 'move',
  'co': 'copy',
  'ro': 'rotate',
  'mm': 'mirror',
  're': 'scale',
  'tr': 'trim',
  'ex': 'extend',
  'of': 'offset',
  'fl': 'fillet',
  'li': 'line',
  'rc': 'rectangle',
  'ci': 'circle',
  'ar': 'arc',
  'pl': 'polyline',
  'el': 'ellipse',
  'sp': 'spline',
  'tx': 'text',
  'di': 'dimension',
  'dl': 'dimension-linear',
  'da': 'dimension-angular',
  'dr': 'dimension-radius',
  'dd': 'dimension-diameter',
  'se': 'section',  // Structural section
  'be': 'beam',     // Structural beam
  'im': 'image',    // Image import
};

const TWO_KEY_TIMEOUT = 750; // ms to wait for second key

export function useKeyboardShortcuts() {
  const {
    setActiveTool,
    setDimensionMode,
    deleteSelectedShapes,
    selectAll,
    deselectAll,
    zoomIn,
    zoomOut,
    zoomToFit,
    toggleGrid,
    toggleSnap,
    selectedShapeIds,
    undo,
    redo,
    setPrintDialogOpen,
    printDialogOpen,
    // Tool state
    activeTool,
    lastTool,
    repeatLastTool,
    isDrawing,
    // Placement state
    isPlacing,
    placementScale,
    cancelPlacement,
    setPlacementScale,
    // Sheet mode state
    editorMode,
    activeSheetId,
    viewportEditState,
    deleteSheetViewport,
    // Document management
    createNewDocument,
    closeDocument,
    switchDocument,
    activeDocumentId,
    documentOrder,
    // Dialogs
    openSectionDialog,
    openBeamDialog,
    setFindReplaceDialogOpen,
    findReplaceDialogOpen,
    // Clipboard
    copySelectedShapes,
    cutSelectedShapes,
    pasteShapes,
    // Visibility
    hideSelectedShapes,
    showAllShapes,
    isolateSelectedShapes,
    // Locking
    lockSelectedShapes,
    unlockSelectedShapes,
    // Grouping
    groupSelectedShapes,
    ungroupSelectedShapes,
  } = useAppStore();

  useEffect(() => {
    let pendingKey = '';
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPending = () => {
      pendingKey = '';
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields or textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Handle placement mode shortcuts first
      if (isPlacing) {
        switch (key) {
          case 'escape':
            e.preventDefault();
            cancelPlacement();
            clearPending();
            return;
          case '=':
          case '+': {
            e.preventDefault();
            const currentIndex = VIEWPORT_SCALES.indexOf(placementScale);
            if (currentIndex > 0) {
              setPlacementScale(VIEWPORT_SCALES[currentIndex - 1]);
            } else if (currentIndex === -1) {
              const closerIndex = VIEWPORT_SCALES.findIndex(s => s <= placementScale);
              if (closerIndex > 0) {
                setPlacementScale(VIEWPORT_SCALES[closerIndex - 1]);
              }
            }
            return;
          }
          case '-': {
            e.preventDefault();
            const currentIndex = VIEWPORT_SCALES.indexOf(placementScale);
            if (currentIndex >= 0 && currentIndex < VIEWPORT_SCALES.length - 1) {
              setPlacementScale(VIEWPORT_SCALES[currentIndex + 1]);
            } else if (currentIndex === -1) {
              const closerIndex = VIEWPORT_SCALES.findIndex(s => s < placementScale);
              if (closerIndex >= 0) {
                setPlacementScale(VIEWPORT_SCALES[closerIndex]);
              }
            }
            return;
          }
        }
      }

      // Two-key sequence handling (two-key style)
      if (!ctrl && !shift && key.length === 1 && key >= 'a' && key <= 'z') {
        if (pendingKey) {
          // Second key of a two-key sequence
          const combo = pendingKey + key;
          clearPending();
          const tool = TWO_KEY_SHORTCUTS[combo];
          if (tool) {
            e.preventDefault();
            if (tool.startsWith('dimension-')) {
              const mode = tool.replace('dimension-', '') as any;
              setDimensionMode(mode);
              setActiveTool('dimension');
            } else if (tool === 'section') {
              // Section opens a dialog, not a tool
              if (editorMode === 'drawing') {
                openSectionDialog();
              }
            } else if (tool === 'beam') {
              // Beam opens a dialog, not a tool
              if (editorMode === 'drawing') {
                openBeamDialog();
              }
            } else {
              setActiveTool(tool as any);
            }
            return;
          }
          // Invalid combo — fall through to single-key handling for the second key
        }

        // Check if this key could be the start of a two-key combo
        const possibleCombos = Object.keys(TWO_KEY_SHORTCUTS).filter(k => k[0] === key);
        if (possibleCombos.length > 0) {
          pendingKey = key;
          pendingTimer = setTimeout(() => {
            // Timer expired — no second key, so execute single-key action
            const saved = pendingKey;
            clearPending();
            executeSingleKey(saved);
          }, TWO_KEY_TIMEOUT);
          return;
        }

        // Single-letter shortcuts that don't start any two-key combo
        executeSingleKey(key);
        return;
      }

      // Non-letter keys or modifiers: clear pending and handle immediately
      if (pendingKey && (ctrl || shift || key.length !== 1 || key < 'a' || key > 'z')) {
        clearPending();
      }

      // Escape always works immediately (but not when print dialog is open)
      if (key === 'escape') {
        if (printDialogOpen) return;
        clearPending();
        setActiveTool('select');
        return;
      }

      // Non-tool single keys
      if (!ctrl && !shift) {
        switch (key) {
          case 'delete':
          case 'backspace':
            if (editorMode === 'sheet' && viewportEditState.selectedViewportId && activeSheetId) {
              deleteSheetViewport(activeSheetId, viewportEditState.selectedViewportId);
            } else if (selectedShapeIds.length > 0) {
              deleteSelectedShapes();
            }
            break;
          case '=':
          case '+':
            zoomIn();
            break;
          case '-':
            zoomOut();
            break;
          case 'enter':
          case ' ':
            // Repeat last tool when in select mode and not drawing
            if (activeTool === 'select' && !isDrawing && lastTool) {
              e.preventDefault();
              repeatLastTool();
            }
            break;
        }
      }

      // Ctrl shortcuts
      if (ctrl && !shift) {
        switch (key) {
          case 'a':
            e.preventDefault();
            selectAll();
            break;
          case 'c':
            e.preventDefault();
            copySelectedShapes();
            break;
          case 'x':
            e.preventDefault();
            cutSelectedShapes();
            break;
          case 'v':
            e.preventDefault();
            pasteShapes();
            break;
          case 'g':
            e.preventDefault();
            groupSelectedShapes();
            break;
          case 'd':
            e.preventDefault();
            deselectAll();
            break;
          case 'n':
            e.preventDefault();
            createNewDocument();
            break;
          case 'w':
            e.preventDefault();
            closeDocument(activeDocumentId);
            break;
          case 's':
            e.preventDefault();
            console.log('Save');
            break;
          case 'o':
            e.preventDefault();
            console.log('Open');
            break;
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'p':
            e.preventDefault();
            setPrintDialogOpen(true);
            break;
          case 'h':
            e.preventDefault();
            setFindReplaceDialogOpen(true);
            break;
          case 'tab': {
            e.preventDefault();
            const currentIdx = documentOrder.indexOf(activeDocumentId);
            const nextIdx = (currentIdx + 1) % documentOrder.length;
            switchDocument(documentOrder[nextIdx]);
            break;
          }
        }
      }

      // Ctrl+Shift shortcuts
      if (ctrl && shift) {
        switch (key) {
          case 'z':
            e.preventDefault();
            redo();
            break;
          case 'g':
            e.preventDefault();
            ungroupSelectedShapes();
            break;
          case 'tab': {
            e.preventDefault();
            const currentIdx = documentOrder.indexOf(activeDocumentId);
            const prevIdx = (currentIdx - 1 + documentOrder.length) % documentOrder.length;
            switchDocument(documentOrder[prevIdx]);
            break;
          }
        }
      }

      // Shift shortcuts (without Ctrl)
      if (!ctrl && shift) {
        switch (key) {
          case 'h':
            e.preventDefault();
            showAllShapes();
            break;
          case 'l':
            e.preventDefault();
            unlockSelectedShapes();
            break;
        }
      }
    };

    /**
     * Execute a single-key shortcut when the two-key timer expires.
     * These are legacy single-letter shortcuts that also serve as
     * first letters of two-key combos.
     */
    function executeSingleKey(k: string) {
      // Single-letter shortcuts for tools, visibility and locking
      switch (k) {
        case 'g':
          setActiveTool('move');
          break;
        case 'h':
          hideSelectedShapes();
          break;
        case 'i':
          isolateSelectedShapes();
          break;
        case 'l':
          lockSelectedShapes();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPending();
    };
  }, [
    setActiveTool,
    setDimensionMode,
    deleteSelectedShapes,
    selectAll,
    deselectAll,
    zoomIn,
    zoomOut,
    zoomToFit,
    toggleGrid,
    toggleSnap,
    selectedShapeIds,
    undo,
    redo,
    setPrintDialogOpen,
    printDialogOpen,
    activeTool,
    lastTool,
    repeatLastTool,
    isDrawing,
    isPlacing,
    placementScale,
    cancelPlacement,
    setPlacementScale,
    editorMode,
    activeSheetId,
    viewportEditState,
    deleteSheetViewport,
    createNewDocument,
    closeDocument,
    switchDocument,
    activeDocumentId,
    documentOrder,
    openSectionDialog,
    openBeamDialog,
    setFindReplaceDialogOpen,
    findReplaceDialogOpen,
    copySelectedShapes,
    cutSelectedShapes,
    pasteShapes,
    hideSelectedShapes,
    showAllShapes,
    isolateSelectedShapes,
    lockSelectedShapes,
    unlockSelectedShapes,
    groupSelectedShapes,
    ungroupSelectedShapes,
  ]);
}
