import { useEffect } from 'react';
import { useAppStore, generateId } from '../state/appStore';
import type { LineShape, PolylineShape } from '../types/geometry';

/**
 * Hook to handle keyboard shortcuts for drawing operations (AutoCAD-style)
 * - Enter/Escape: End current drawing operation
 * - U: Undo last point
 * - C: Close shape (connect last point to first point)
 */
export function useDrawingKeyboard() {
  const {
    activeTool,
    drawingPoints,
    clearDrawingPoints,
    undoDrawingPoint,
    setDrawingPreview,
    addShape,
    activeLayerId,
    currentStyle,
    isDrawing,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when in drawing mode
      if (!isDrawing || drawingPoints.length === 0) return;

      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          // Cancel drawing operation
          e.preventDefault();
          clearDrawingPoints();
          setDrawingPreview(null);
          break;

        case 'Enter':
          // Finish drawing operation - create shape if applicable
          e.preventDefault();
          if (activeTool === 'polyline' && drawingPoints.length >= 2) {
            const polylineShape: PolylineShape = {
              id: generateId(),
              type: 'polyline',
              layerId: activeLayerId,
              style: { ...currentStyle },
              visible: true,
              locked: false,
              points: [...drawingPoints],
              closed: false,
            };
            addShape(polylineShape);
          }
          clearDrawingPoints();
          setDrawingPreview(null);
          break;

        case 'u':
        case 'U':
          // Undo last point
          e.preventDefault();
          undoDrawingPoint();
          break;

        case 'c':
        case 'C':
          // Close shape - works for line and polyline tools
          if (drawingPoints.length >= 2) {
            e.preventDefault();

            if (activeTool === 'line') {
              // Create closing line from last point to first point
              const firstPoint = drawingPoints[0];
              const lastPoint = drawingPoints[drawingPoints.length - 1];

              const dx = Math.abs(lastPoint.x - firstPoint.x);
              const dy = Math.abs(lastPoint.y - firstPoint.y);

              if (dx > 1 || dy > 1) {
                const lineShape: LineShape = {
                  id: generateId(),
                  type: 'line',
                  layerId: activeLayerId,
                  style: { ...currentStyle },
                  visible: true,
                  locked: false,
                  start: lastPoint,
                  end: firstPoint,
                };
                addShape(lineShape);
              }
            } else if (activeTool === 'polyline') {
              // Create closed polyline
              const polylineShape: PolylineShape = {
                id: generateId(),
                type: 'polyline',
                layerId: activeLayerId,
                style: { ...currentStyle },
                visible: true,
                locked: false,
                points: [...drawingPoints],
                closed: true,
              };
              addShape(polylineShape);
            }

            clearDrawingPoints();
            setDrawingPreview(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    drawingPoints,
    clearDrawingPoints,
    undoDrawingPoint,
    setDrawingPreview,
    addShape,
    activeLayerId,
    currentStyle,
    isDrawing,
  ]);
}
