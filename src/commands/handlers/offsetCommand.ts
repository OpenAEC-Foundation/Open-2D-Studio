import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point, LineShape, CircleShape } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const offsetCommand: CommandHandler = {
  name: 'OFFSET',

  start: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: 'OFFSET',
      phase: 'awaiting_value',
      prompt: 'OFFSET Specify offset distance or [Through/Erase/Layer] <Through>:',
      options: ['Through', 'Erase', 'Layer'],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      data: { distance: null, through: false, erase: false },
    };
  },

  handleInput: (
    state: CommandState,
    input: CommandInput,
    shapes: Shape[]
  ): CommandResult => {
    switch (state.phase) {
      case 'awaiting_value':
        if (input.type === 'value') {
          return {
            success: true,
            newState: {
              phase: 'selecting',
              prompt: 'Select object to offset or [Exit/Undo]:',
              options: ['Exit', 'Undo'],
              data: { ...state.data, distance: input.value },
            },
          };
        }
        if (input.type === 'option') {
          const opt = input.option.toLowerCase();
          if (opt === 'through' || opt === 't') {
            return {
              success: true,
              newState: {
                data: { ...state.data, through: true },
                phase: 'selecting',
                prompt: 'Select object to offset or [Exit/Undo]:',
                options: ['Exit', 'Undo'],
              },
            };
          }
          if (opt === 'erase' || opt === 'e') {
            return {
              success: true,
              message: 'Erase source object after offsetting: Yes',
              newState: {
                data: { ...state.data, erase: true },
                prompt: 'OFFSET Specify offset distance or [Through/Erase/Layer]:',
              },
            };
          }
        }
        if (input.type === 'escape') {
          return {
            success: false,
            message: '*Cancel*',
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
            },
          };
        }
        return { success: false };

      case 'selecting':
        if (input.type === 'selection' && input.ids.length > 0) {
          const objectId = input.ids[0]; // Only offset one object at a time
          const shape = shapes.find((s) => s.id === objectId);

          if (!shape || !canOffset(shape)) {
            return {
              success: false,
              message: 'Cannot offset this type of object.',
            };
          }

          if (state.data.through) {
            return {
              success: true,
              newState: {
                selectedIds: [objectId],
                phase: 'awaiting_point',
                prompt: 'Specify through point:',
                options: [],
              },
            };
          }

          return {
            success: true,
            newState: {
              selectedIds: [objectId],
              phase: 'awaiting_point',
              prompt: 'Specify point on side to offset:',
              options: [],
            },
          };
        }
        if (input.type === 'option') {
          const opt = input.option.toLowerCase();
          if (opt === 'exit' || opt === 'e') {
            return {
              success: true,
              newState: {
                activeCommand: null,
                phase: 'idle',
                prompt: 'Command:',
              },
            };
          }
          if (opt === 'undo' || opt === 'u') {
            // Undo last offset
            const lastCreated = state.data.lastCreated;
            if (lastCreated) {
              return {
                success: true,
                message: 'Last offset undone.',
                shapesToDelete: [lastCreated],
                newState: {
                  data: { ...state.data, lastCreated: null },
                },
              };
            }
          }
        }
        if (input.type === 'escape') {
          return {
            success: false,
            message: '*Cancel*',
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
            },
          };
        }
        return { success: false };

      case 'awaiting_point':
        if (input.type === 'point' && state.selectedIds.length > 0) {
          const objectId = state.selectedIds[0];
          const shape = shapes.find((s) => s.id === objectId);

          if (!shape) {
            return { success: false, message: 'Object not found.' };
          }

          let distance = state.data.distance;

          // If "through" mode, calculate distance from point to object
          if (state.data.through) {
            distance = calculateDistanceToShape(input.point, shape);
          }

          // Determine which side to offset based on pick point
          const side = determineSide(input.point, shape);

          // Create offset shape
          const offsetShape = createOffsetShape(shape, distance, side);

          if (!offsetShape) {
            return { success: false, message: 'Cannot create offset.' };
          }

          const result: CommandResult = {
            success: true,
            message: 'Offset created.',
            shapesToAdd: [offsetShape],
            newState: {
              selectedIds: [],
              phase: 'selecting',
              prompt: 'Select object to offset or [Exit/Undo]:',
              options: ['Exit', 'Undo'],
              data: { ...state.data, lastCreated: offsetShape.id },
            },
            continue: true,
          };

          if (state.data.erase) {
            result.shapesToDelete = [objectId];
          }

          return result;
        }
        if (input.type === 'escape') {
          return {
            success: true,
            newState: {
              selectedIds: [],
              phase: 'selecting',
              prompt: 'Select object to offset or [Exit/Undo]:',
              options: ['Exit', 'Undo'],
            },
          };
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
    if (state.phase !== 'awaiting_point' || state.selectedIds.length === 0) {
      return [];
    }

    const shape = shapes.find((s) => s.id === state.selectedIds[0]);
    if (!shape) return [];

    let distance = state.data.distance;
    if (state.data.through) {
      distance = calculateDistanceToShape(currentPoint, shape);
    }

    const side = determineSide(currentPoint, shape);
    const offsetShape = createOffsetShape(shape, distance, side);

    if (!offsetShape) return [];

    return [{
      ...offsetShape,
      id: `preview-offset`,
      style: { ...offsetShape.style, strokeColor: '#00ff00' },
    }];
  },

  cancel: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: null,
      phase: 'idle',
      prompt: 'Command:',
      selectedIds: [],
    };
  },
};

// Check if shape can be offset
function canOffset(shape: Shape): boolean {
  return ['line', 'circle', 'arc', 'polyline'].includes(shape.type);
}

// Calculate distance from point to shape
function calculateDistanceToShape(point: Point, shape: Shape): number {
  switch (shape.type) {
    case 'line': {
      const line = shape as LineShape;
      return pointToLineDistance(point, line.start, line.end);
    }
    case 'circle': {
      const circle = shape as CircleShape;
      const dx = point.x - circle.center.x;
      const dy = point.y - circle.center.y;
      return Math.abs(Math.sqrt(dx * dx + dy * dy) - circle.radius);
    }
    default:
      return 10; // Default distance
  }
}

// Determine which side of the shape the point is on
function determineSide(point: Point, shape: Shape): number {
  switch (shape.type) {
    case 'line': {
      const line = shape as LineShape;
      // Cross product to determine side
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const px = point.x - line.start.x;
      const py = point.y - line.start.y;
      const cross = dx * py - dy * px;
      return cross >= 0 ? 1 : -1;
    }
    case 'circle': {
      const circle = shape as CircleShape;
      const dx = point.x - circle.center.x;
      const dy = point.y - circle.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist > circle.radius ? 1 : -1; // 1 = outside, -1 = inside
    }
    default:
      return 1;
  }
}

// Point to line distance
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = Math.max(0, Math.min(1,
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len)
  ));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

// Create offset shape
function createOffsetShape(shape: Shape, distance: number, side: number): Shape | null {
  const newId = generateId();

  switch (shape.type) {
    case 'line': {
      const line = shape as LineShape;
      // Calculate perpendicular direction
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len === 0) return null;

      // Perpendicular unit vector
      const px = -dy / len * side;
      const py = dx / len * side;

      return {
        ...line,
        id: newId,
        start: {
          x: line.start.x + px * distance,
          y: line.start.y + py * distance,
        },
        end: {
          x: line.end.x + px * distance,
          y: line.end.y + py * distance,
        },
      };
    }
    case 'circle': {
      const circle = shape as CircleShape;
      const newRadius = circle.radius + distance * side;

      if (newRadius <= 0) return null;

      return {
        ...circle,
        id: newId,
        radius: newRadius,
      };
    }
    case 'arc': {
      const arc = shape;
      const newRadius = arc.radius + distance * side;

      if (newRadius <= 0) return null;

      return {
        ...arc,
        id: newId,
        radius: newRadius,
      };
    }
    default:
      return null;
  }
}
