import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point, LineShape, ArcShape } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const filletCommand: CommandHandler = {
  name: 'FILLET',

  start: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: 'FILLET',
      phase: 'awaiting_value',
      prompt: 'FILLET Current settings: Mode = TRIM, Radius = 0.0000. Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
      options: ['Undo', 'Polyline', 'Radius', 'Trim', 'Multiple'],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      data: { radius: 0, trim: true, multiple: false },
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

          if (opt === 'radius' || opt === 'r') {
            return {
              success: true,
              newState: {
                phase: 'awaiting_radius',
                prompt: `Specify fillet radius <${state.data.radius || 0}>:`,
                options: [],
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
                prompt: 'Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
                options: ['Undo', 'Polyline', 'Radius', 'Trim', 'Multiple'],
              },
            };
          }

          if (opt === 'trim') {
            return {
              success: true,
              message: 'Trim mode: Trim',
              newState: {
                data: { ...state.data, trim: true, awaitingTrimMode: false },
                prompt: 'Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
                options: ['Undo', 'Polyline', 'Radius', 'Trim', 'Multiple'],
              },
            };
          }

          if (opt === 'multiple' || opt === 'm') {
            return {
              success: true,
              message: 'Multiple mode ON',
              newState: {
                data: { ...state.data, multiple: true },
                prompt: 'Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
              },
            };
          }
        }

        if (input.type === 'selection' && input.ids.length > 0) {
          const objectId = input.ids[0];
          const shape = shapes.find((s) => s.id === objectId);

          if (!shape || !canFillet(shape)) {
            return {
              success: false,
              message: 'Cannot fillet this type of object. Select a line, arc, or polyline.',
            };
          }

          return {
            success: true,
            newState: {
              selectedIds: [objectId],
              phase: 'selecting_second',
              prompt: 'Select second object or shift-select to apply corner or [Radius]:',
              options: ['Radius'],
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

      case 'awaiting_radius':
        if (input.type === 'value') {
          const radius = Math.abs(input.value);
          return {
            success: true,
            message: `Fillet radius set to ${radius}`,
            newState: {
              phase: 'awaiting_value',
              prompt: 'Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
              options: ['Undo', 'Polyline', 'Radius', 'Trim', 'Multiple'],
              data: { ...state.data, radius },
            },
          };
        }
        if (input.type === 'enter') {
          // Keep current radius
          return {
            success: true,
            newState: {
              phase: 'awaiting_value',
              prompt: 'Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
              options: ['Undo', 'Polyline', 'Radius', 'Trim', 'Multiple'],
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

          if (!canFillet(shape2)) {
            return {
              success: false,
              message: 'Cannot fillet this type of object.',
            };
          }

          // Calculate fillet
          const radius = state.data.radius || 0;
          const result = createFillet(
            shape1,
            shape2,
            radius,
            state.data.pickPoint1,
            input.point,
            state.data.trim
          );

          if (!result) {
            return {
              success: false,
              message: 'Cannot create fillet between these objects.',
            };
          }

          const commandResult: CommandResult = {
            success: true,
            message: radius > 0 ? 'Fillet created.' : 'Corner created.',
            shapesToAdd: result.shapesToAdd,
            shapesToUpdate: result.shapesToUpdate,
            shapesToDelete: result.shapesToDelete,
          };

          if (state.data.multiple) {
            commandResult.newState = {
              selectedIds: [],
              phase: 'awaiting_value',
              prompt: 'Select first object or [Undo/Polyline/Radius/Trim/Multiple]:',
              options: ['Undo', 'Polyline', 'Radius', 'Trim', 'Multiple'],
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
          if (opt === 'radius' || opt === 'r') {
            return {
              success: true,
              newState: {
                phase: 'awaiting_radius',
                prompt: `Specify fillet radius <${state.data.radius || 0}>:`,
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
    // Preview could show the potential fillet arc
    // For now, we don't show preview
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

// Check if shape can be filleted
function canFillet(shape: Shape): boolean {
  return ['line', 'arc', 'polyline'].includes(shape.type);
}

// Create fillet between two lines
function createFillet(
  shape1: Shape,
  shape2: Shape,
  radius: number,
  pickPoint1: Point | undefined,
  pickPoint2: Point | undefined,
  trim: boolean
): {
  shapesToAdd: Shape[];
  shapesToUpdate?: { id: string; updates: Partial<Shape> }[];
  shapesToDelete?: string[];
} | null {
  // For now, handle line-to-line fillet
  if (shape1.type === 'line' && shape2.type === 'line') {
    const line1 = shape1 as LineShape;
    const line2 = shape2 as LineShape;

    // Find intersection point
    const intersection = findLineIntersection(line1, line2);
    if (!intersection) {
      return null;
    }

    // If radius is 0, just extend/trim lines to meet at corner
    if (radius === 0) {
      const updates: { id: string; updates: Partial<Shape> }[] = [];

      // Determine which ends to modify based on pick points
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

    // Calculate fillet with radius
    const filletResult = calculateFilletArc(line1, line2, radius, intersection, pickPoint1, pickPoint2);
    if (!filletResult) {
      return null;
    }

    const result: {
      shapesToAdd: Shape[];
      shapesToUpdate?: { id: string; updates: Partial<Shape> }[];
      shapesToDelete?: string[];
    } = {
      shapesToAdd: [filletResult.arc],
    };

    if (trim) {
      result.shapesToUpdate = [
        { id: line1.id, updates: { [filletResult.line1End]: filletResult.tangent1 } },
        { id: line2.id, updates: { [filletResult.line2End]: filletResult.tangent2 } },
      ];
    }

    return result;
  }

  return null;
}

// Find intersection of two lines
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

// Calculate fillet arc between two lines
function calculateFilletArc(
  line1: LineShape,
  line2: LineShape,
  radius: number,
  intersection: Point,
  pickPoint1: Point | undefined,
  pickPoint2: Point | undefined
): {
  arc: ArcShape;
  tangent1: Point;
  tangent2: Point;
  line1End: 'start' | 'end';
  line2End: 'start' | 'end';
} | null {
  // Get direction vectors
  const dir1 = normalizeVector({
    x: line1.end.x - line1.start.x,
    y: line1.end.y - line1.start.y,
  });
  const dir2 = normalizeVector({
    x: line2.end.x - line2.start.x,
    y: line2.end.y - line2.start.y,
  });

  // Determine which ends to use
  const line1End = getCloserEnd(line1, pickPoint1 || intersection);
  const line2End = getCloserEnd(line2, pickPoint2 || intersection);

  // Adjust direction vectors to point toward intersection
  const adjustedDir1 = line1End === 'end' ? dir1 : { x: -dir1.x, y: -dir1.y };
  const adjustedDir2 = line2End === 'end' ? dir2 : { x: -dir2.x, y: -dir2.y };

  // Calculate bisector direction (toward fillet center)
  const bisector = normalizeVector({
    x: adjustedDir1.x + adjustedDir2.x,
    y: adjustedDir1.y + adjustedDir2.y,
  });

  // Angle between lines
  const dot = adjustedDir1.x * adjustedDir2.x + adjustedDir1.y * adjustedDir2.y;
  const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;

  if (Math.abs(halfAngle) < 1e-10) {
    return null; // Lines are parallel
  }

  // Distance from intersection to fillet center
  const centerDist = radius / Math.sin(halfAngle);

  // Fillet center (on opposite side of bisector)
  const center: Point = {
    x: intersection.x - bisector.x * centerDist,
    y: intersection.y - bisector.y * centerDist,
  };

  // Distance from intersection to tangent points
  const tangentDist = radius / Math.tan(halfAngle);

  // Tangent points
  const tangent1: Point = {
    x: intersection.x - adjustedDir1.x * tangentDist,
    y: intersection.y - adjustedDir1.y * tangentDist,
  };
  const tangent2: Point = {
    x: intersection.x - adjustedDir2.x * tangentDist,
    y: intersection.y - adjustedDir2.y * tangentDist,
  };

  // Calculate start and end angles for arc
  const startAngle = Math.atan2(tangent1.y - center.y, tangent1.x - center.x);
  const endAngle = Math.atan2(tangent2.y - center.y, tangent2.x - center.x);

  const arc: ArcShape = {
    id: generateId(),
    type: 'arc',
    center,
    radius,
    startAngle,
    endAngle,
    style: { ...line1.style },
    layerId: line1.layerId,
    visible: true,
    locked: false,
  };

  return {
    arc,
    tangent1,
    tangent2,
    line1End,
    line2End,
  };
}

function normalizeVector(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
