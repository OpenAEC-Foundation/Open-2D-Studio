import { useEffect } from 'react';
import { useAppStore } from '../state/appStore';

export function useKeyboardShortcuts() {
  const {
    setActiveTool,
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
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Tool shortcuts (single keys)
      if (!ctrl && !shift) {
        switch (key) {
          case 'v':
          case 'escape':
            setActiveTool('select');
            break;
          case 'h':
            setActiveTool('pan');
            break;
          case 'l':
            setActiveTool('line');
            break;
          case 'r':
            setActiveTool('rectangle');
            break;
          case 'c':
            setActiveTool('circle');
            break;
          case 'delete':
          case 'backspace':
            if (selectedShapeIds.length > 0) {
              deleteSelectedShapes();
            }
            break;
          case 'g':
            toggleGrid();
            break;
          case 's':
            if (!ctrl) {
              toggleSnap();
            }
            break;
          case 'f':
            zoomToFit();
            break;
          case '=':
          case '+':
            zoomIn();
            break;
          case '-':
            zoomOut();
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
          case 'd':
            e.preventDefault();
            deselectAll();
            break;
          case 's':
            e.preventDefault();
            // TODO: Save file
            console.log('Save');
            break;
          case 'o':
            e.preventDefault();
            // TODO: Open file
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
        }
      }

      // Ctrl+Shift shortcuts
      if (ctrl && shift) {
        switch (key) {
          case 'z':
            e.preventDefault();
            redo();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setActiveTool,
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
  ]);
}
