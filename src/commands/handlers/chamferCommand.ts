import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point, LineShape } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const chamferCommand: CommandHandler = {
  name: 'CHAMFER',

  start: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: 'CHAMFER',
      phase: 'awaiting_value',
      prompt: 'CHAMFER (TRIM mode) Current chamfer Dist1 = 0.0000, Dist2 = 0.0000. Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
      options: ['Undo', 'Polyline', 'Distance', 'Angle', 'Trim', 'mEthod', 'Multiple'],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      data: { dist1: 0, dist2: 0, trim: true, multiple: false, method: 'distance' },
    };
  },

  handleInput: (
    state: CommandState,
    input: CommandInput,
    shapes: Shape[]
  ): CommandResult => {
    switch (state.phase) {
      case 'awaiting_value':
        if (input.type === 'option') {
          const opt = input.option.toLowerCase();

          if (opt === 'distance' || opt === 'd') {
            return {
              success: true,
              newState: {
                phase: 'awaiting_dist1',
                prompt: `Specify first chamfer distance <${state.data.dist1 || 0}>:`,
                options: [],
              },
            };
          }

          if (opt === 'angle' || opt === 'a') {
            return {
              success: true,
              newState: {
                phase: 'awaiting_angle_dist',
                prompt: `Specify chamfer length on the first line <${state.data.dist1 || 0}>:`,
                options: [],
                data: { ...state.data, method: 'angle' },
              },
            };
          }

          if (opt === 'trim' || opt === 't') {
            const currentTrim = state.data.trim ? 'Trim' : 'No trim';
            return {
              success: true,
              newState: {
                prompt: `Enter Trim mode option [Trim/No trim] <${currentTrim}>:`,
                options: ['Trim', 'No trim'],
                data: { ...state.data, awaitingTrimMode: true },
              },
            };
          }

          if (opt === 'no trim' || opt === 'n') {
            return {
              success: true,
              message: 'Trim mode: No trim',
              newState: {
                data: { ...state.data, trim: false, awaitingTrimMode: false },
                prompt: 'Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
                options: ['Undo', 'Polyline', 'Distance', 'Angle', 'Trim', 'mEthod', 'Multiple'],
              },
            };
          }

          if (opt === 'multiple' || opt === 'm') {
            return {
              success: true,
              message: 'Multiple mode ON',
              newState: {
                data: { ...state.data, multiple: true },
                prompt: 'Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
              },
            };
          }

          if (opt === 'method' || opt === 'e') {
            return {
              success: true,
              newState: {
                prompt: 'Enter trim method [Distance/Angle] <Distance>:',
                options: ['Distance', 'Angle'],
                data: { ...state.data, awaitingMethod: true },
              },
            };
          }
        }

        if (input.type === 'selection' && input.ids.length > 0) {
          const objectId = input.ids[0];
          const shape = shapes.find((s) => s.id === objectId);

          if (!shape || shape.type !== 'line') {
            return {
              success: false,
              message: 'Select a line.',
            };
          }

          return {
            success: true,
            newState: {
              selectedIds: [objectId],
              phase: 'selecting_second',
              prompt: 'Select second line or shift-select to apply corner or [Distance/Angle/mEthod]:',
              options: ['Distance', 'Angle', 'mEthod'],
              data: { ...state.data, firstObject: objectId, pickPoint1: input.point },
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
            },
          };
        }
        return { success: false };

      case 'awaiting_dist1':
        if (input.type === 'value') {
          const dist1 = Math.abs(input.value);
          return {
            success: true,
            newState: {
              phase: 'awaiting_dist2',
              prompt: `Specify second chamfer distance <${dist1}>:`,
              options: [],
              data: { ...state.data, dist1 },
            },
          };
        }
        if (input.type === 'enter') {
          return {
            success: true,
            newState: {
              phase: 'awaiting_dist2',
              prompt: `Specify second chamfer distance <${state.data.dist1 || 0}>:`,
              options: [],
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
            },
          };
        }
        return { success: false };

      case 'awaiting_dist2':
        if (input.type === 'value') {
          const dist2 = Math.abs(input.value);
          return {
            success: true,
            message: `Chamfer distances set to ${state.data.dist1}, ${dist2}`,
            newState: {
              phase: 'awaiting_value',
              prompt: 'Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
              options: ['Undo', 'Polyline', 'Distance', 'Angle', 'Trim', 'mEthod', 'Multiple'],
              data: { ...state.data, dist2 },
            },
          };
        }
        if (input.type === 'enter') {
          // Use dist1 as dist2
          const dist2 = state.data.dist1 || 0;
          return {
            success: true,
            message: `Chamfer distances set to ${state.data.dist1}, ${dist2}`,
            newState: {
              phase: 'awaiting_value',
              prompt: 'Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
              options: ['Undo', 'Polyline', 'Distance', 'Angle', 'Trim', 'mEthod', 'Multiple'],
              data: { ...state.data, dist2 },
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
            },
          };
        }
        return { success: false };

      case 'awaiting_angle_dist':
        if (input.type === 'value') {
          const dist1 = Math.abs(input.value);
          return {
            success: true,
            newState: {
              phase: 'awaiting_angle',
              prompt: 'Specify chamfer angle from the first line <0>:',
              options: [],
              data: { ...state.data, dist1 },
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
            },
          };
        }
        return { success: false };

      case 'awaiting_angle':
        if (input.type === 'value') {
          const angle = input.value;
          return {
            success: true,
            message: `Chamfer set to length ${state.data.dist1} at ${angle}°`,
            newState: {
              phase: 'awaiting_value',
              prompt: 'Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
              options: ['Undo', 'Polyline', 'Distance', 'Angle', 'Trim', 'mEthod', 'Multiple'],
              data: { ...state.data, angle },
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
            },
          };
        }
        return { success: false };

      case 'selecting_second':
        if (input.type === 'selection' && input.ids.length > 0) {
          const secondId = input.ids[0];
          const shape1 = shapes.find((s) => s.id === state.data.firstObject);
          const shape2 = shapes.find((s) => s.id === secondId);

          if (!shape1 || !shape2) {
            return { success: false, message: 'Object not found.' };
          }

          if (shape2.type !== 'line') {
            return {
              success: false,
              message: 'Select a line.',
            };
          }

          // Calculate chamfer
          const result = createChamfer(
            shape1 as LineShape,
            shape2 as LineShape,
            state.data.dist1 || 0,
            state.data.dist2 || 0,
            state.data.pickPoint1,
            input.point,
            state.data.trim
          );

          if (!result) {
            return {
              success: false,
              message: 'Cannot create chamfer between these lines.',
            };
          }

          const commandResult: CommandResult = {
            success: true,
            message: 'Chamfer created.',
            shapesToAdd: result.shapesToAdd,
            shapesToUpdate: result.shapesToUpdate,
          };

          if (state.data.multiple) {
            commandResult.newState = {
              selectedIds: [],
              phase: 'awaiting_value',
              prompt: 'Select first line or [Undo/Polyline/Distance/Angle/Trim/mEthod/Multiple]:',
              options: ['Undo', 'Polyline', 'Distance', 'Angle', 'Trim', 'mEthod', 'Multiple'],
              data: { ...state.data, firstObject: null, pickPoint1: null },
            };
            commandResult.continue = true;
          } else {
            commandResult.newState = {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
            };
          }

          return commandResult;
        }

        if (input.type === 'option') {
          const opt = input.option.toLowerCase();
          if (opt === 'distance' || opt === 'd') {
            return {
              success: true,
              newState: {
                phase: 'awaiting_dist1',
                prompt: `Specify first chamfer distance <${state.data.dist1 || 0}>:`,
                options: [],
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
              selectedIds: [],
            },
          };
        }
        return { success: false };

      default:
        return { success: false };
    }
  },

  getPreview: (
    _state: CommandState,
    _currentPoint: Point,
    _shapes: Shape[]
  ): Shape[] => {
    // Preview could show the potential chamfer line
    return [];
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

// Create chamfer between two lines
function createChamfer(
  line1: LineShape,
  line2: LineShape,
  dist1: number,
  dist2: number,
  pickPoint1: Point | undefined,
  pickPoint2: Point | undefined,
  trim: boolean
): {
  shapesToAdd: Shape[];
  shapesToUpdate?: { id: string; updates: Partial<Shape> }[];
} | null {
  // Find intersection point
  const intersection = findLineIntersection(line1, line2);
  if (!intersection) {
    return null;
  }

  // If distances are 0, just extend/trim lines to meet at corner
  if (dist1 === 0 && dist2 === 0) {
    const updates: { id: string; updates: Partial<Shape> }[] = [];

    const line1End = getCloserEnd(line1, pickPoint1 || intersection);
    const line2End = getCloserEnd(line2, pickPoint2 || intersection);

    if (trim) {
      updates.push({
        id: line1.id,
        updates: { [line1End]: intersection },
      });
      updates.push({
        id: line2.id,
        updates: { [line2End]: intersection },
      });
    }

    return {
      shapesToAdd: [],
      shapesToUpdate: updates,
    };
  }

  // Calculate chamfer points
  const line1End = getCloserEnd(line1, pickPoint1 || intersection);
  const line2End = getCloserEnd(line2, pickPoint2 || intersection);

  // Get direction from intersection along each line
  const dir1 = getDirectionFromIntersection(line1, intersection, line1End);
  const dir2 = getDirectionFromIntersection(line2, intersection, line2End);

  // Chamfer points on each line
  const chamferPoint1: Point = {
    x: intersection.x + dir1.x * dist1,
    y: intersection.y + dir1.y * dist1,
  };
  const chamferPoint2: Point = {
    x: intersection.x + dir2.x * dist2,
    y: intersection.y + dir2.y * dist2,
  };

  // Create chamfer line
  const chamferLine: LineShape = {
    id: generateId(),
    type: 'line',
    start: chamferPoint1,
    end: chamferPoint2,
    style: { ...line1.style },
    layerId: line1.layerId,
    visible: true,
    locked: false,
  };

  const result: {
    shapesToAdd: Shape[];
    shapesToUpdate?: { id: string; updates: Partial<Shape> }[];
  } = {
    shapesToAdd: [chamferLine],
  };

  if (trim) {
    result.shapesToUpdate = [
      { id: line1.id, updates: { [line1End]: chamferPoint1 } },
      { id: line2.id, updates: { [line2End]: chamferPoint2 } },
    ];
  }

  return result;
}

// Find intersection of two lines (extended if necessary)
function findLineIntersection(line1: LineShape, line2: LineShape): Point | null {
  const x1 = line1.start.x, y1 = line1.start.y;
  const x2 = line1.end.x, y2 = line1.end.y;
  const x3 = line2.start.x, y3 = line2.start.y;
  const x4 = line2.end.x, y4 = line2.end.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

// Get which end of line is closer to point
function getCloserEnd(line: LineShape, point: Point): 'start' | 'end' {
  const distToStart = Math.hypot(point.x - line.start.x, point.y - line.start.y);
  const distToEnd = Math.hypot(point.x - line.end.x, point.y - line.end.y);
  return distToStart < distToEnd ? 'start' : 'end';
}

// Get normalized direction from intersection point away along line
function getDirectionFromIntersection(
  line: LineShape,
  intersection: Point,
  closerEnd: 'start' | 'end'
): Point {
  // We want to go from intersection AWAY from the intersection toward the far end
  const farEnd = closerEnd === 'start' ? line.end : line.start;
  const dx = farEnd.x - intersection.x;
  const dy = farEnd.y - intersection.y;
  const len = Math.hypot(dx, dy);

  if (len === 0) return { x: 0, y: 0 };

  return { x: dx / len, y: dy / len };
}
