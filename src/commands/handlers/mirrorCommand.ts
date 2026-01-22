import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const mirrorCommand: CommandHandler = {
  name: 'MIRROR',

  start: (state: CommandState, selectedIds: string[]): CommandState => {
    if (selectedIds.length > 0) {
      return {
        ...state,
        activeCommand: 'MIRROR',
        phase: 'awaiting_point',
        prompt: 'MIRROR Specify first point of mirror line:',
        options: [],
        selectedIds: [...selectedIds],
        selectionComplete: true,
        basePoint: null,
        secondPoint: null,
        data: { deleteSource: false },
      };
    }

    return {
      ...state,
      activeCommand: 'MIRROR',
      phase: 'selecting',
      prompt: 'MIRROR Select objects:',
      options: [],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      secondPoint: null,
      data: { deleteSource: false },
    };
  },

  handleInput: (
    state: CommandState,
    input: CommandInput,
    shapes: Shape[]
  ): CommandResult => {
    switch (state.phase) {
      case 'selecting':
        if (input.type === 'selection') {
          const newSelection = [...new Set([...state.selectedIds, ...input.ids])];
          return {
            success: true,
            newState: {
              selectedIds: newSelection,
              prompt: `${newSelection.length} object(s) selected. Press Enter when done:`,
            },
          };
        }
        if (input.type === 'enter' && state.selectedIds.length > 0) {
          return {
            success: true,
            newState: {
              phase: 'awaiting_point',
              prompt: 'Specify first point of mirror line:',
              selectionComplete: true,
            },
          };
        }
        if (input.type === 'escape') {
          return {
            success: false,
            message: '*Cancel*',
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
            },
          };
        }
        return { success: false };

      case 'awaiting_point':
        if (input.type === 'point') {
          return {
            success: true,
            newState: {
              basePoint: input.point,
              phase: 'awaiting_second_point',
              prompt: 'Specify second point of mirror line:',
            },
          };
        }
        if (input.type === 'escape') {
          return {
            success: false,
            message: '*Cancel*',
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
            },
          };
        }
        return { success: false };

      case 'awaiting_second_point':
        if (input.type === 'point' && state.basePoint) {
          return {
            success: true,
            newState: {
              secondPoint: input.point,
              phase: 'awaiting_option',
              prompt: 'Erase source objects? [Yes/No] <N>:',
              options: ['Yes', 'No'],
            },
          };
        }
        if (input.type === 'escape') {
          return {
            success: false,
            message: '*Cancel*',
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
            },
          };
        }
        return { success: false };

      case 'awaiting_option':
        let deleteSource = false;

        if (input.type === 'option' || input.type === 'text') {
          const opt = (input.type === 'option' ? input.option : input.text).toLowerCase();
          if (opt === 'yes' || opt === 'y') {
            deleteSource = true;
          }
        }

        // Execute mirror
        if (state.basePoint && state.secondPoint) {
          // Create mirrored copies
          const shapesToAdd = state.selectedIds
            .map((id) => {
              const shape = shapes.find((s) => s.id === id);
              if (!shape) return null;
              return mirrorShapeCopy(shape, state.basePoint!, state.secondPoint!);
            })
            .filter(Boolean) as Shape[];

          const result: CommandResult = {
            success: true,
            message: `${shapesToAdd.length} object(s) mirrored.`,
            shapesToAdd,
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
              basePoint: null,
              secondPoint: null,
            },
          };

          if (deleteSource) {
            result.shapesToDelete = state.selectedIds;
            result.message = `${shapesToAdd.length} object(s) mirrored. Source objects deleted.`;
          }

          return result;
        }
        return { success: false };

      default:
        return { success: false };
    }
  },

  getPreview: (
    state: CommandState,
    currentPoint: Point,
    shapes: Shape[]
  ): Shape[] => {
    if (!state.basePoint) return [];

    // Use current point as second mirror line point for preview
    const mirrorPoint2 = state.phase === 'awaiting_second_point'
      ? currentPoint
      : state.secondPoint || currentPoint;

    return state.selectedIds
      .map((id) => {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return null;

        const mirrored = mirrorShapeCopy(shape, state.basePoint!, mirrorPoint2);
        return {
          ...mirrored,
          id: `preview-${id}`,
          style: { ...mirrored.style, strokeColor: '#00ff00' },
        };
      })
      .filter(Boolean) as Shape[];
  },

  cancel: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: null,
      phase: 'idle',
      prompt: 'Command:',
      selectedIds: [],
      basePoint: null,
      secondPoint: null,
    };
  },
};

// Helper to mirror a point across a line
function mirrorPoint(point: Point, lineP1: Point, lineP2: Point): Point {
  // Line direction
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return point;

  // Normalize
  const nx = dx / len;
  const ny = dy / len;

  // Vector from line point to the point
  const vx = point.x - lineP1.x;
  const vy = point.y - lineP1.y;

  // Project onto line
  const dot = vx * nx + vy * ny;
  const projX = lineP1.x + dot * nx;
  const projY = lineP1.y + dot * ny;

  // Mirror
  return {
    x: 2 * projX - point.x,
    y: 2 * projY - point.y,
  };
}

// Helper to mirror a shape
function mirrorShapeCopy(shape: Shape, lineP1: Point, lineP2: Point): Shape {
  const newId = generateId();

  switch (shape.type) {
    case 'line':
      return {
        ...shape,
        id: newId,
        start: mirrorPoint(shape.start, lineP1, lineP2),
        end: mirrorPoint(shape.end, lineP1, lineP2),
      };
    case 'rectangle': {
      // Mirror all four corners and recalculate
      const corners = [
        shape.topLeft,
        { x: shape.topLeft.x + shape.width, y: shape.topLeft.y },
        { x: shape.topLeft.x + shape.width, y: shape.topLeft.y + shape.height },
        { x: shape.topLeft.x, y: shape.topLeft.y + shape.height },
      ];
      const mirrored = corners.map((c) => mirrorPoint(c, lineP1, lineP2));

      // Find new bounding box
      const minX = Math.min(...mirrored.map((p) => p.x));
      const minY = Math.min(...mirrored.map((p) => p.y));
      const maxX = Math.max(...mirrored.map((p) => p.x));
      const maxY = Math.max(...mirrored.map((p) => p.y));

      return {
        ...shape,
        id: newId,
        topLeft: { x: minX, y: minY },
        width: maxX - minX,
        height: maxY - minY,
        // Note: rotation would need more complex handling
      };
    }
    case 'circle':
      return {
        ...shape,
        id: newId,
        center: mirrorPoint(shape.center, lineP1, lineP2),
      };
    case 'arc': {
      const newCenter = mirrorPoint(shape.center, lineP1, lineP2);
      // Mirror reverses the arc direction
      return {
        ...shape,
        id: newId,
        center: newCenter,
        startAngle: -shape.endAngle,
        endAngle: -shape.startAngle,
      };
    }
    case 'ellipse':
      return {
        ...shape,
        id: newId,
        center: mirrorPoint(shape.center, lineP1, lineP2),
        rotation: -shape.rotation,
      };
    case 'polyline':
      return {
        ...shape,
        id: newId,
        points: shape.points.map((p) => mirrorPoint(p, lineP1, lineP2)),
      };
    default:
      return { ...shape, id: newId };
  }
}
