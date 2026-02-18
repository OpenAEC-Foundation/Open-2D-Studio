/**
 * useBoxSelection - Handles window/crossing box selection
 */

import { useCallback, useRef, useMemo } from 'react';
import { useAppStore, type SelectionBox } from '../../state/appStore';
import type { Point, Shape, TextShape, BlockDefinition } from '../../types/geometry';
import { getShapeBounds, getTextBounds, screenToWorld } from '../../engine/geometry/GeometryUtils';
import type { SelectedGrip } from '../../state/slices/selectionSlice';

/** Shape types that have start/end endpoints which can be grip-selected. */
const LINE_LIKE_TYPES = ['line', 'beam', 'wall', 'gridline', 'level', 'section-callout'];

/**
 * Test if a line segment intersects an axis-aligned rectangle.
 * Uses Liang-Barsky algorithm.
 */
function lineSegmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  minX: number, minY: number, maxX: number, maxY: number
): boolean {
  // Check if either endpoint is inside the rect
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;

  const dx = x2 - x1;
  const dy = y2 - y1;

  // Check intersection with each edge of the rectangle
  const edges = [
    { ex1: minX, ey1: minY, ex2: maxX, ey2: minY }, // bottom
    { ex1: maxX, ey1: minY, ex2: maxX, ey2: maxY }, // right
    { ex1: minX, ey1: maxY, ex2: maxX, ey2: maxY }, // top
    { ex1: minX, ey1: minY, ex2: minX, ey2: maxY }, // left
  ];

  for (const edge of edges) {
    const edx = edge.ex2 - edge.ex1;
    const edy = edge.ey2 - edge.ey1;
    const denom = dx * edy - dy * edx;
    if (Math.abs(denom) < 1e-10) continue; // parallel

    const t = ((edge.ex1 - x1) * edy - (edge.ey1 - y1) * edx) / denom;
    const u = ((edge.ex1 - x1) * dy - (edge.ey1 - y1) * dx) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }

  return false;
}

interface Edge { x1: number; y1: number; x2: number; y2: number; }

/**
 * Decompose a shape into line segment edges for precise intersection testing.
 */
function getShapeEdges(shape: Shape, drawingScale?: number): Edge[] {
  switch (shape.type) {
    case 'line':
      return [{ x1: shape.start.x, y1: shape.start.y, x2: shape.end.x, y2: shape.end.y }];

    case 'rectangle': {
      const { topLeft: tl, width, height, rotation } = shape;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      // 4 corners rotated around topLeft
      const corners = [
        { x: tl.x, y: tl.y },
        { x: tl.x + width * cos, y: tl.y + width * sin },
        { x: tl.x + width * cos - height * sin, y: tl.y + width * sin + height * cos },
        { x: tl.x - height * sin, y: tl.y + height * cos },
      ];
      return [
        { x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y },
        { x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y },
        { x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y },
        { x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y },
      ];
    }

    case 'circle': {
      // Approximate circle with 32 segments
      const { center, radius } = shape;
      const segments = 32;
      const edges: Edge[] = [];
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        edges.push({
          x1: center.x + radius * Math.cos(a1), y1: center.y + radius * Math.sin(a1),
          x2: center.x + radius * Math.cos(a2), y2: center.y + radius * Math.sin(a2),
        });
      }
      return edges;
    }

    case 'arc': {
      const { center, radius, startAngle, endAngle } = shape;
      const segments = 32;
      let start = startAngle;
      let end = endAngle;
      if (end < start) end += Math.PI * 2;
      const edges: Edge[] = [];
      for (let i = 0; i < segments; i++) {
        const a1 = start + (i / segments) * (end - start);
        const a2 = start + ((i + 1) / segments) * (end - start);
        edges.push({
          x1: center.x + radius * Math.cos(a1), y1: center.y + radius * Math.sin(a1),
          x2: center.x + radius * Math.cos(a2), y2: center.y + radius * Math.sin(a2),
        });
      }
      return edges;
    }

    case 'ellipse': {
      const { center, radiusX, radiusY, rotation } = shape;
      const segments = 32;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const edges: Edge[] = [];
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        const px1 = radiusX * Math.cos(a1), py1 = radiusY * Math.sin(a1);
        const px2 = radiusX * Math.cos(a2), py2 = radiusY * Math.sin(a2);
        edges.push({
          x1: center.x + px1 * cos - py1 * sin, y1: center.y + px1 * sin + py1 * cos,
          x2: center.x + px2 * cos - py2 * sin, y2: center.y + px2 * sin + py2 * cos,
        });
      }
      return edges;
    }

    case 'polyline': {
      const edges: Edge[] = [];
      for (let i = 0; i < shape.points.length - 1; i++) {
        edges.push({
          x1: shape.points[i].x, y1: shape.points[i].y,
          x2: shape.points[i + 1].x, y2: shape.points[i + 1].y,
        });
      }
      if (shape.closed && shape.points.length >= 3) {
        const last = shape.points[shape.points.length - 1];
        const first = shape.points[0];
        edges.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y });
      }
      return edges;
    }

    case 'spline': {
      const edges: Edge[] = [];
      for (let i = 0; i < shape.points.length - 1; i++) {
        edges.push({
          x1: shape.points[i].x, y1: shape.points[i].y,
          x2: shape.points[i + 1].x, y2: shape.points[i + 1].y,
        });
      }
      return edges;
    }

    case 'gridline': {
      // Only use the core start-to-end segment for selection testing.
      // Gridlines are rendered with long extensions beyond start/end, but
      // cross-selection should only match the main segment to avoid
      // selecting gridlines that are far from the selection box.
      const gl = shape as import('../../types/geometry').GridlineShape;
      return [{ x1: gl.start.x, y1: gl.start.y, x2: gl.end.x, y2: gl.end.y }];
    }

    case 'level': {
      // Same as gridline: only the core start-to-end line, not visual extensions.
      const lv = shape as import('../../types/geometry').LevelShape;
      return [{ x1: lv.start.x, y1: lv.start.y, x2: lv.end.x, y2: lv.end.y }];
    }

    case 'text': {
      // Get text bounds and rotation
      const textShape = shape as TextShape;
      const rawTextBounds = getTextBounds(textShape, drawingScale);
      if (!rawTextBounds) return [];

      const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const rotation = textShape.rotation || 0;
      const pos = textShape.position;

      if (rotation === 0) {
        // Unrotated text - use bounds directly
        const corners = [
          { x: rawTextBounds.minX, y: rawTextBounds.minY },
          { x: rawTextBounds.maxX, y: rawTextBounds.minY },
          { x: rawTextBounds.maxX, y: rawTextBounds.maxY },
          { x: rawTextBounds.minX, y: rawTextBounds.maxY },
        ];
        edges.push(
          { x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y },
          { x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y },
          { x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y },
          { x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y },
        );
      } else {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const localCorners = [
          { x: rawTextBounds.minX, y: rawTextBounds.minY },
          { x: rawTextBounds.maxX, y: rawTextBounds.minY },
          { x: rawTextBounds.maxX, y: rawTextBounds.maxY },
          { x: rawTextBounds.minX, y: rawTextBounds.maxY },
        ];

        const rotatedCorners = localCorners.map(c => {
          const dx = c.x - pos.x;
          const dy = c.y - pos.y;
          return {
            x: pos.x + dx * cos - dy * sin,
            y: pos.y + dx * sin + dy * cos,
          };
        });

        edges.push(
          { x1: rotatedCorners[0].x, y1: rotatedCorners[0].y, x2: rotatedCorners[1].x, y2: rotatedCorners[1].y },
          { x1: rotatedCorners[1].x, y1: rotatedCorners[1].y, x2: rotatedCorners[2].x, y2: rotatedCorners[2].y },
          { x1: rotatedCorners[2].x, y1: rotatedCorners[2].y, x2: rotatedCorners[3].x, y2: rotatedCorners[3].y },
          { x1: rotatedCorners[3].x, y1: rotatedCorners[3].y, x2: rotatedCorners[0].x, y2: rotatedCorners[0].y },
        );
      }

      // Add leader line edges for box selection
      if (textShape.leaderPoints && textShape.leaderPoints.length > 0) {
        const underlineY = rawTextBounds.maxY;
        const underlineLeft = rawTextBounds.minX;
        const underlineRight = rawTextBounds.maxX;

        // Underline edge
        edges.push({ x1: underlineLeft, y1: underlineY, x2: underlineRight, y2: underlineY });

        for (const arrowTip of textShape.leaderPoints) {
          const distToLeft = Math.hypot(arrowTip.x - underlineLeft, arrowTip.y - underlineY);
          const distToRight = Math.hypot(arrowTip.x - underlineRight, arrowTip.y - underlineY);
          const connectEnd = distToLeft < distToRight
            ? { x: underlineLeft, y: underlineY }
            : { x: underlineRight, y: underlineY };
          edges.push({ x1: connectEnd.x, y1: connectEnd.y, x2: arrowTip.x, y2: arrowTip.y });
        }
      }
      if (textShape.leaders) {
        for (const leader of textShape.leaders) {
          for (let i = 0; i < leader.points.length - 1; i++) {
            edges.push({
              x1: leader.points[i].x, y1: leader.points[i].y,
              x2: leader.points[i + 1].x, y2: leader.points[i + 1].y,
            });
          }
        }
      }

      return edges;
    }

    default:
      return [];
  }
}

/**
 * Test if a shape's actual geometry intersects or is contained in a rectangle (for crossing selection).
 * Falls back to bounding box overlap for shapes where edge decomposition isn't available.
 */
function shapeCrossesRect(shape: Shape, minX: number, minY: number, maxX: number, maxY: number, drawingScale?: number, blockDefinitions?: Map<string, BlockDefinition>): boolean {
  const bounds = getShapeBounds(shape, drawingScale, blockDefinitions);
  if (!bounds) return false;

  // Quick reject: if bounding boxes don't overlap at all, no intersection possible
  if (bounds.maxX < minX || bounds.minX > maxX || bounds.maxY < minY || bounds.minY > maxY) {
    return false;
  }

  // Helper: get edges of a shape as line segments for precise crossing test
  const edges = getShapeEdges(shape, drawingScale);
  if (edges.length > 0) {
    // Check if any edge crosses the selection rectangle
    for (const edge of edges) {
      if (lineSegmentIntersectsRect(edge.x1, edge.y1, edge.x2, edge.y2, minX, minY, maxX, maxY)) {
        return true;
      }
    }
    return false;
  }

  // For shapes without edge decomposition, bounding box overlap is sufficient
  return true;
}

interface SelectionState {
  isSelecting: boolean;
  startPoint: Point;
  justFinishedBoxSelection: boolean;
}

export function useBoxSelection() {
  const selectionState = useRef<SelectionState>({
    isSelecting: false,
    startPoint: { x: 0, y: 0 },
    justFinishedBoxSelection: false,
  });

  const {
    viewport,
    shapes,
    parametricShapes,
    activeTool,
    selectShapes,
    setSelectionBox,
    setSelectedGrip,
    editorMode,
    activeDrawingId,
    drawings,
    blockDefinitions: blockDefinitionsArray,
  } = useAppStore();

  // Get the active drawing's scale for text hit detection
  const activeDrawingScale = useMemo(() => {
    const drawing = drawings.find(d => d.id === activeDrawingId);
    return drawing?.scale ?? 0.02; // Default to 1:50
  }, [drawings, activeDrawingId]);

  // Build Map for efficient block definition lookups
  const blockDefinitionsMap = useMemo(() => {
    const map = new Map<string, BlockDefinition>();
    for (const def of blockDefinitionsArray) map.set(def.id, def);
    return map;
  }, [blockDefinitionsArray]);

  /**
   * Start box selection
   */
  const startBoxSelection = useCallback(
    (screenPos: Point) => {
      selectionState.current = {
        isSelecting: true,
        startPoint: screenPos,
        justFinishedBoxSelection: false,
      };
    },
    []
  );

  /**
   * Check if should start box selection (clicking on empty space in select mode)
   */
  const shouldStartBoxSelection = useCallback(
    (hasShapeAtPoint: boolean): boolean => {
      if (editorMode !== 'drawing') return false;
      if (hasShapeAtPoint) return false;
      return activeTool === 'select';
    },
    [editorMode, activeTool]
  );

  /**
   * Update box selection during drag
   */
  const updateBoxSelection = useCallback(
    (screenPos: Point) => {
      if (!selectionState.current.isSelecting) return;

      const startPoint = selectionState.current.startPoint;
      // Determine mode based on direction: left-to-right = window, right-to-left = crossing
      const mode = screenPos.x >= startPoint.x ? 'window' : 'crossing';

      setSelectionBox({
        start: startPoint,
        end: screenPos,
        mode,
      });
    },
    [setSelectionBox]
  );

  /**
   * Get shapes within selection box
   */
  const getShapesInSelectionBox = useCallback(
    (box: SelectionBox): string[] => {
      const startWorld = screenToWorld(box.start.x, box.start.y, viewport);
      const endWorld = screenToWorld(box.end.x, box.end.y, viewport);

      const minX = Math.min(startWorld.x, endWorld.x);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxY = Math.max(startWorld.y, endWorld.y);

      const selectedIds: string[] = [];

      // Check regular shapes
      for (const shape of shapes) {
        if (!shape.visible || shape.locked) continue;
        if (shape.drawingId !== activeDrawingId) continue;  // Only select shapes in active drawing

        const bounds = getShapeBounds(shape, activeDrawingScale, blockDefinitionsMap);
        if (!bounds) continue;

        if (box.mode === 'window') {
          // Window selection: all geometry must be inside the box
          // Use edge decomposition for precise check on rotated shapes
          const edges = getShapeEdges(shape);
          let allInside = true;
          if (edges.length > 0) {
            for (const edge of edges) {
              if (edge.x1 < minX || edge.x1 > maxX || edge.y1 < minY || edge.y1 > maxY ||
                  edge.x2 < minX || edge.x2 > maxX || edge.y2 < minY || edge.y2 > maxY) {
                allInside = false;
                break;
              }
            }
          } else {
            // Fallback to bounding box
            allInside = bounds.minX >= minX && bounds.maxX <= maxX &&
                        bounds.minY >= minY && bounds.maxY <= maxY;
          }
          if (allInside) {
            selectedIds.push(shape.id);
          }
        } else {
          // Crossing selection: shape can be inside or crossing
          // Use precise geometry test to avoid false positives from bounding box overlap
          if (shapeCrossesRect(shape, minX, minY, maxX, maxY, activeDrawingScale, blockDefinitionsMap)) {
            selectedIds.push(shape.id);
          }
        }
      }

      // Check parametric shapes
      for (const shape of parametricShapes) {
        if (!shape.visible || shape.locked) continue;
        if (shape.drawingId !== activeDrawingId) continue;

        const bounds = shape.generatedGeometry?.bounds;
        if (!bounds) continue;

        if (box.mode === 'window') {
          // Window selection: entire shape must be inside
          const allInside = bounds.minX >= minX && bounds.maxX <= maxX &&
                           bounds.minY >= minY && bounds.maxY <= maxY;
          if (allInside) {
            selectedIds.push(shape.id);
          }
        } else {
          // Crossing selection: bounds overlap is sufficient
          const overlaps = !(bounds.maxX < minX || bounds.minX > maxX ||
                            bounds.maxY < minY || bounds.minY > maxY);
          if (overlaps) {
            selectedIds.push(shape.id);
          }
        }
      }

      return selectedIds;
    },
    [viewport, shapes, parametricShapes, activeDrawingId, activeDrawingScale, blockDefinitionsMap]
  );

  /**
   * End box selection
   * @param addToSelection - if true (Ctrl or Shift held), add to existing selection
   */
  const endBoxSelection = useCallback(
    (screenPos: Point, addToSelection: boolean): boolean => {
      if (!selectionState.current.isSelecting) return false;

      const startPoint = selectionState.current.startPoint;

      // Check if it was a drag (not just a click)
      const dx = Math.abs(screenPos.x - startPoint.x);
      const dy = Math.abs(screenPos.y - startPoint.y);

      const wasBoxSelection = dx > 5 || dy > 5;

      if (wasBoxSelection) {
        const mode = screenPos.x >= startPoint.x ? 'window' : 'crossing';
        const box: SelectionBox = {
          start: startPoint,
          end: screenPos,
          mode,
        };

        const selectedIds = getShapesInSelectionBox(box);

        // --- Endpoint grip detection ---
        // After determining which shapes are selected, check if only one endpoint
        // of a line-like shape (beam/wall/line/gridline/level) is inside the box.
        // If so, activate grip selection on that endpoint for stretch editing.
        const startWorld = screenToWorld(box.start.x, box.start.y, viewport);
        const endWorld = screenToWorld(box.end.x, box.end.y, viewport);
        const boxMinX = Math.min(startWorld.x, endWorld.x);
        const boxMaxX = Math.max(startWorld.x, endWorld.x);
        const boxMinY = Math.min(startWorld.y, endWorld.y);
        const boxMaxY = Math.max(startWorld.y, endWorld.y);

        const isInsideBox = (p: Point) =>
          p.x >= boxMinX && p.x <= boxMaxX && p.y >= boxMinY && p.y <= boxMaxY;

        let gripToSelect: SelectedGrip | null = null;

        // Only detect endpoint grips for crossing selection (right-to-left drag)
        // where exactly one line-like shape is involved and only one endpoint is inside
        if (mode === 'crossing' && selectedIds.length === 1) {
          const selectedShape = shapes.find(s => s.id === selectedIds[0]);
          if (selectedShape && LINE_LIKE_TYPES.includes(selectedShape.type)) {
            const s = selectedShape as any;
            const startInside = isInsideBox(s.start);
            const endInside = isInsideBox(s.end);

            if (startInside && !endInside) {
              gripToSelect = { shapeId: selectedShape.id, gripIndex: 0 };
            } else if (endInside && !startInside) {
              gripToSelect = { shapeId: selectedShape.id, gripIndex: 1 };
            }
            // If both endpoints are inside, the whole shape is selected — no grip selection
          }
        }

        if (addToSelection) {
          // Toggle selection (Ctrl or Shift held)
          // - Objects in box that are already selected → remove them
          // - Objects in box that are not selected → add them
          const currentSelection = useAppStore.getState().selectedShapeIds;
          const newSelection = currentSelection.filter(id => !selectedIds.includes(id));
          const toAdd = selectedIds.filter(id => !currentSelection.includes(id));
          selectShapes([...newSelection, ...toAdd]);
          // Clear grip selection when using additive selection
          setSelectedGrip(null);
        } else {
          // Replace selection
          selectShapes(selectedIds);
          // Set grip selection if endpoint was detected
          setSelectedGrip(gripToSelect);
        }

        selectionState.current.justFinishedBoxSelection = true;
      } else {
        selectionState.current.justFinishedBoxSelection = false;
      }

      selectionState.current.isSelecting = false;
      setSelectionBox(null);

      return wasBoxSelection;
    },
    [getShapesInSelectionBox, selectShapes, setSelectionBox, setSelectedGrip, viewport, shapes]
  );

  /**
   * Check if box selection is in progress
   */
  const isSelecting = useCallback(() => selectionState.current.isSelecting, []);

  /**
   * Check if just finished box selection (to prevent click handler)
   */
  const justFinishedBoxSelection = useCallback(() => {
    const result = selectionState.current.justFinishedBoxSelection;
    selectionState.current.justFinishedBoxSelection = false;
    return result;
  }, []);

  return {
    startBoxSelection,
    shouldStartBoxSelection,
    updateBoxSelection,
    endBoxSelection,
    getShapesInSelectionBox,
    isSelecting,
    justFinishedBoxSelection,
  };
}
