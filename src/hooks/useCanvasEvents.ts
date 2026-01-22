import { useCallback, useRef } from 'react';
import { useAppStore, generateId, type SelectionBox } from '../state/appStore';
import type { Point, LineShape, RectangleShape, CircleShape, PolylineShape, Shape } from '../types/geometry';

interface PanState {
  isPanning: boolean;
  startPoint: Point;
  button: number;
}

interface SelectionState {
  isSelecting: boolean;
  startPoint: Point;
  justFinishedBoxSelection: boolean;
}

export function useCanvasEvents(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const panState = useRef<PanState>({
    isPanning: false,
    startPoint: { x: 0, y: 0 },
    button: 0,
  });

  const selectionState = useRef<SelectionState>({
    isSelecting: false,
    startPoint: { x: 0, y: 0 },
    justFinishedBoxSelection: false,
  });

  const {
    viewport,
    setViewport,
    activeTool,
    addShape,
    currentStyle,
    activeLayerId,
    shapes,
    selectShape,
    selectShapes,
    deselectAll,
    snapEnabled,
    gridSize,
    setDrawingPreview,
    drawingPoints,
    addDrawingPoint,
    clearDrawingPoints,
    setSelectionBox,
    hasActiveModifyCommand,
    commandIsSelecting,
    setPendingCommandPoint,
    setPendingCommandSelection,
  } = useAppStore();

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      return {
        x: (screenX - viewport.offsetX) / viewport.zoom,
        y: (screenY - viewport.offsetY) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Snap point to grid if enabled
  const snapToGrid = useCallback(
    (point: Point): Point => {
      if (!snapEnabled) return point;
      return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };
    },
    [snapEnabled, gridSize]
  );

  // Get mouse position from event
  const getMousePos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [canvasRef]
  );

  // Find shape at point
  const findShapeAtPoint = useCallback(
    (worldPoint: Point): string | null => {
      // Search in reverse order (top shapes first)
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!shape.visible) continue;

        if (isPointNearShape(worldPoint, shape)) {
          return shape.id;
        }
      }
      return null;
    },
    [shapes]
  );

  // Create a line shape
  const createLine = useCallback(
    (start: Point, end: Point) => {
      const lineShape: LineShape = {
        id: generateId(),
        type: 'line',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        start,
        end,
      };
      addShape(lineShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  // Create a rectangle shape
  const createRectangle = useCallback(
    (start: Point, end: Point) => {
      const width = end.x - start.x;
      const height = end.y - start.y;
      const rectShape: RectangleShape = {
        id: generateId(),
        type: 'rectangle',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        topLeft: {
          x: width > 0 ? start.x : end.x,
          y: height > 0 ? start.y : end.y,
        },
        width: Math.abs(width),
        height: Math.abs(height),
        rotation: 0,
      };
      addShape(rectShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  // Create a circle shape
  const createCircle = useCallback(
    (center: Point, radiusPoint: Point) => {
      const dx = radiusPoint.x - center.x;
      const dy = radiusPoint.y - center.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const circleShape: CircleShape = {
        id: generateId(),
        type: 'circle',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        center,
        radius,
      };
      addShape(circleShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  // Create a polyline shape
  const createPolyline = useCallback(
    (points: Point[], closed: boolean = false) => {
      if (points.length < 2) return;
      const polylineShape: PolylineShape = {
        id: generateId(),
        type: 'polyline',
        layerId: activeLayerId,
        style: { ...currentStyle },
        visible: true,
        locked: false,
        points: [...points],
        closed,
      };
      addShape(polylineShape);
    },
    [activeLayerId, currentStyle, addShape]
  );

  // Handle mouse down (for panning and box selection)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const screenPos = getMousePos(e);

      // Middle mouse button or pan tool - start panning
      if (e.button === 1 || (e.button === 0 && activeTool === 'pan')) {
        panState.current = {
          isPanning: true,
          startPoint: screenPos,
          button: e.button,
        };
        return;
      }

      // Left click in select mode or during command selection phase - check if clicking on empty space to start box selection
      if (e.button === 0 && (activeTool === 'select' || (hasActiveModifyCommand && commandIsSelecting))) {
        const worldPos = screenToWorld(screenPos.x, screenPos.y);
        const shapeId = findShapeAtPoint(worldPos);

        if (!shapeId) {
          // Clicking on empty space - start box selection
          selectionState.current = {
            isSelecting: true,
            startPoint: screenPos,
            justFinishedBoxSelection: false,
          };
          // Don't deselect yet - will deselect if it's just a click (not a drag)
        }
      }
    },
    [getMousePos, activeTool, screenToWorld, findShapeAtPoint, hasActiveModifyCommand, commandIsSelecting]
  );

  // Handle click (for drawing - AutoCAD style)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Ignore if it was a pan operation
      if (panState.current.isPanning) return;

      // Ignore if we just finished a box selection
      if (selectionState.current.justFinishedBoxSelection) {
        selectionState.current.justFinishedBoxSelection = false;
        return;
      }

      // Only handle left click
      if (e.button !== 0) return;

      const screenPos = getMousePos(e);
      const worldPos = screenToWorld(screenPos.x, screenPos.y);
      const snappedPos = snapToGrid(worldPos);

      // If there's an active modify command in selection phase, try to select shapes
      if (hasActiveModifyCommand && commandIsSelecting) {
        const shapeId = findShapeAtPoint(worldPos);
        if (shapeId) {
          setPendingCommandSelection([shapeId]);
        }
        return;
      }

      // If there's an active modify command (not in selection phase), send point to command system
      if (hasActiveModifyCommand) {
        setPendingCommandPoint(snappedPos);
        return;
      }

      switch (activeTool) {
        case 'select': {
          const shapeId = findShapeAtPoint(worldPos);
          if (shapeId) {
            selectShape(shapeId, e.shiftKey);
          } else {
            deselectAll();
          }
          break;
        }

        case 'line': {
          if (drawingPoints.length === 0) {
            // First click - set start point
            addDrawingPoint(snappedPos);
          } else {
            // Subsequent clicks - create line from last point to this point
            const lastPoint = drawingPoints[drawingPoints.length - 1];
            const dx = Math.abs(snappedPos.x - lastPoint.x);
            const dy = Math.abs(snappedPos.y - lastPoint.y);

            // Only create if there's actual distance
            if (dx > 1 || dy > 1) {
              createLine(lastPoint, snappedPos);
              // Continue drawing from this point
              addDrawingPoint(snappedPos);
            }
          }
          break;
        }

        case 'rectangle': {
          if (drawingPoints.length === 0) {
            // First click - set first corner
            addDrawingPoint(snappedPos);
          } else {
            // Second click - create rectangle and finish
            const startPoint = drawingPoints[0];
            const dx = Math.abs(snappedPos.x - startPoint.x);
            const dy = Math.abs(snappedPos.y - startPoint.y);

            if (dx > 1 || dy > 1) {
              createRectangle(startPoint, snappedPos);
            }
            clearDrawingPoints();
            setDrawingPreview(null);
          }
          break;
        }

        case 'circle': {
          if (drawingPoints.length === 0) {
            // First click - set center
            addDrawingPoint(snappedPos);
          } else {
            // Second click - set radius point and create circle
            const center = drawingPoints[0];
            const dx = Math.abs(snappedPos.x - center.x);
            const dy = Math.abs(snappedPos.y - center.y);

            if (dx > 1 || dy > 1) {
              createCircle(center, snappedPos);
            }
            clearDrawingPoints();
            setDrawingPreview(null);
          }
          break;
        }

        case 'polyline': {
          // Add point to polyline - continues until user presses Enter/Escape or right-clicks
          addDrawingPoint(snappedPos);
          break;
        }

        case 'pan':
          // Pan tool doesn't use click for drawing
          break;

        default:
          break;
      }
    },
    [
      getMousePos,
      screenToWorld,
      snapToGrid,
      activeTool,
      findShapeAtPoint,
      selectShape,
      deselectAll,
      drawingPoints,
      addDrawingPoint,
      clearDrawingPoints,
      createLine,
      createRectangle,
      createCircle,
      createPolyline,
      setDrawingPreview,
      hasActiveModifyCommand,
      commandIsSelecting,
      setPendingCommandPoint,
      setPendingCommandSelection,
    ]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const screenPos = getMousePos(e);
      const worldPos = screenToWorld(screenPos.x, screenPos.y);
      const snappedPos = snapToGrid(worldPos);

      // Handle panning
      if (panState.current.isPanning) {
        const delta = {
          x: screenPos.x - panState.current.startPoint.x,
          y: screenPos.y - panState.current.startPoint.y,
        };
        panState.current.startPoint = screenPos;

        setViewport({
          offsetX: viewport.offsetX + delta.x,
          offsetY: viewport.offsetY + delta.y,
        });
        return;
      }

      // Handle box selection
      if (selectionState.current.isSelecting) {
        const startPoint = selectionState.current.startPoint;
        // Determine mode based on direction: left-to-right = window, right-to-left = crossing
        const mode = screenPos.x >= startPoint.x ? 'window' : 'crossing';

        setSelectionBox({
          start: startPoint,
          end: screenPos,
          mode,
        });
        return;
      }

      // Update drawing preview (rubber band) when in drawing mode
      if (drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];

        switch (activeTool) {
          case 'line':
            setDrawingPreview({
              type: 'line',
              start: lastPoint,
              end: snappedPos,
            });
            break;

          case 'rectangle':
            setDrawingPreview({
              type: 'rectangle',
              start: drawingPoints[0],
              end: snappedPos,
            });
            break;

          case 'circle': {
            const dx = snappedPos.x - drawingPoints[0].x;
            const dy = snappedPos.y - drawingPoints[0].y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            setDrawingPreview({
              type: 'circle',
              center: drawingPoints[0],
              radius,
            });
            break;
          }

          case 'polyline':
            setDrawingPreview({
              type: 'polyline',
              points: drawingPoints,
              currentPoint: snappedPos,
            });
            break;
        }
      }
    },
    [
      getMousePos,
      screenToWorld,
      snapToGrid,
      activeTool,
      setViewport,
      viewport,
      setDrawingPreview,
      drawingPoints,
      setSelectionBox,
    ]
  );

  // Get shapes within selection box
  const getShapesInSelectionBox = useCallback(
    (box: SelectionBox): string[] => {
      const startWorld = screenToWorld(box.start.x, box.start.y);
      const endWorld = screenToWorld(box.end.x, box.end.y);

      const minX = Math.min(startWorld.x, endWorld.x);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxY = Math.max(startWorld.y, endWorld.y);

      const selectedIds: string[] = [];

      for (const shape of shapes) {
        if (!shape.visible || shape.locked) continue;

        const bounds = getShapeBounds(shape);
        if (!bounds) continue;

        if (box.mode === 'window') {
          // Window selection: shape must be completely inside
          if (
            bounds.minX >= minX &&
            bounds.maxX <= maxX &&
            bounds.minY >= minY &&
            bounds.maxY <= maxY
          ) {
            selectedIds.push(shape.id);
          }
        } else {
          // Crossing selection: shape can be inside or crossing
          if (
            bounds.maxX >= minX &&
            bounds.minX <= maxX &&
            bounds.maxY >= minY &&
            bounds.minY <= maxY
          ) {
            selectedIds.push(shape.id);
          }
        }
      }

      return selectedIds;
    },
    [screenToWorld, shapes]
  );

  // Handle mouse up (for ending pan and box selection)
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // End panning
      panState.current.isPanning = false;

      // End box selection
      if (selectionState.current.isSelecting) {
        const screenPos = getMousePos(e);
        const startPoint = selectionState.current.startPoint;

        // Check if it was a drag (not just a click)
        const dx = Math.abs(screenPos.x - startPoint.x);
        const dy = Math.abs(screenPos.y - startPoint.y);

        if (dx > 5 || dy > 5) {
          // It was a drag - perform box selection
          const mode = screenPos.x >= startPoint.x ? 'window' : 'crossing';
          const box: SelectionBox = {
            start: startPoint,
            end: screenPos,
            mode,
          };

          const selectedIds = getShapesInSelectionBox(box);

          // If in command selection phase, send selection to command system
          if (hasActiveModifyCommand && commandIsSelecting) {
            if (selectedIds.length > 0) {
              setPendingCommandSelection(selectedIds);
            }
          } else if (e.shiftKey) {
            // Add to current selection
            const currentSelection = useAppStore.getState().selectedShapeIds;
            const newSelection = [...new Set([...currentSelection, ...selectedIds])];
            selectShapes(newSelection);
          } else {
            // Replace selection
            selectShapes(selectedIds);
          }

          // Mark that we just finished a box selection (to prevent handleClick from deselecting)
          selectionState.current.justFinishedBoxSelection = true;
        } else {
          // It was just a click on empty space - will be handled by handleClick
          selectionState.current.justFinishedBoxSelection = false;
        }

        selectionState.current.isSelecting = false;
        setSelectionBox(null);
      }
    },
    [getMousePos, getShapesInSelectionBox, selectShapes, deselectAll, setSelectionBox, hasActiveModifyCommand, commandIsSelecting, setPendingCommandSelection]
  );

  // Handle right-click (context menu) - finish drawing
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent browser context menu

      // If drawing, finish the current drawing operation
      if (drawingPoints.length > 0) {
        // For polyline, create the shape with collected points
        if (activeTool === 'polyline' && drawingPoints.length >= 2) {
          createPolyline(drawingPoints, false);
        }
        clearDrawingPoints();
        setDrawingPreview(null);
      }
    },
    [drawingPoints, clearDrawingPoints, setDrawingPreview, activeTool, createPolyline]
  );

  // Handle mouse wheel (zoom)
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const screenPos = getMousePos(e);

      // Zoom factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.01), 100);

      // Zoom towards cursor position
      const worldX = (screenPos.x - viewport.offsetX) / viewport.zoom;
      const worldY = (screenPos.y - viewport.offsetY) / viewport.zoom;

      const newOffsetX = screenPos.x - worldX * newZoom;
      const newOffsetY = screenPos.y - worldY * newZoom;

      setViewport({
        zoom: newZoom,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    },
    [getMousePos, viewport, setViewport]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleClick,
    handleContextMenu,
  };
}

// Helper function to check if a point is near a shape
function isPointNearShape(point: Point, shape: any, tolerance: number = 5): boolean {
  switch (shape.type) {
    case 'line':
      return isPointNearLine(point, shape.start, shape.end, tolerance);
    case 'rectangle':
      return isPointInRectangle(point, shape);
    case 'circle':
      return isPointNearCircle(point, shape.center, shape.radius, tolerance);
    default:
      return false;
  }
}

function isPointNearLine(
  point: Point,
  start: Point,
  end: Point,
  tolerance: number
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2) <= tolerance;
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length)
    )
  );

  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  const distance = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

  return distance <= tolerance;
}

function isPointInRectangle(point: Point, rect: RectangleShape): boolean {
  return (
    point.x >= rect.topLeft.x &&
    point.x <= rect.topLeft.x + rect.width &&
    point.y >= rect.topLeft.y &&
    point.y <= rect.topLeft.y + rect.height
  );
}

function isPointNearCircle(
  point: Point,
  center: Point,
  radius: number,
  tolerance: number
): boolean {
  const distance = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
  return Math.abs(distance - radius) <= tolerance || distance <= radius;
}

// Get bounding box of a shape
interface ShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function getShapeBounds(shape: Shape): ShapeBounds | null {
  switch (shape.type) {
    case 'line':
      return {
        minX: Math.min(shape.start.x, shape.end.x),
        minY: Math.min(shape.start.y, shape.end.y),
        maxX: Math.max(shape.start.x, shape.end.x),
        maxY: Math.max(shape.start.y, shape.end.y),
      };
    case 'rectangle':
      return {
        minX: shape.topLeft.x,
        minY: shape.topLeft.y,
        maxX: shape.topLeft.x + shape.width,
        maxY: shape.topLeft.y + shape.height,
      };
    case 'circle':
      return {
        minX: shape.center.x - shape.radius,
        minY: shape.center.y - shape.radius,
        maxX: shape.center.x + shape.radius,
        maxY: shape.center.y + shape.radius,
      };
    case 'arc':
      // For arc, use center +/- radius as approximation
      return {
        minX: shape.center.x - shape.radius,
        minY: shape.center.y - shape.radius,
        maxX: shape.center.x + shape.radius,
        maxY: shape.center.y + shape.radius,
      };
    case 'ellipse':
      return {
        minX: shape.center.x - shape.radiusX,
        minY: shape.center.y - shape.radiusY,
        maxX: shape.center.x + shape.radiusX,
        maxY: shape.center.y + shape.radiusY,
      };
    case 'polyline':
      if (shape.points.length === 0) return null;
      const xs = shape.points.map((p) => p.x);
      const ys = shape.points.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    default:
      return null;
  }
}
