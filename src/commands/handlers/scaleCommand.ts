import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const scaleCommand: CommandHandler = {
  name: 'SCALE',

  start: (state: CommandState, selectedIds: string[]): CommandState => {
    if (selectedIds.length > 0) {
      return {
        ...state,
        activeCommand: 'SCALE',
        phase: 'awaiting_point',
        prompt: 'SCALE Specify base point:',
        options: [],
        selectedIds: [...selectedIds],
        selectionComplete: true,
        basePoint: null,
        data: { copy: false },
      };
    }

    return {
      ...state,
      activeCommand: 'SCALE',
      phase: 'selecting',
      prompt: 'SCALE Select objects:',
      options: [],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      data: { copy: false },
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
              prompt: 'Specify base point:',
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
              phase: 'awaiting_value',
              prompt: 'Specify scale factor or [Copy/Reference] <1>:',
              options: ['Copy', 'Reference'],
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

      case 'awaiting_value':
        if (input.type === 'value' && state.basePoint) {
          const scaleFactor = input.value;

          if (scaleFactor === 0) {
            return {
              success: false,
              message: 'Scale factor cannot be zero.',
            };
          }

          if (state.data.copy) {
            // Create scaled copies
            const shapesToAdd = state.selectedIds
              .map((id) => {
                const shape = shapes.find((s) => s.id === id);
                if (!shape) return null;
                return scaleShapeCopy(shape, state.basePoint!, scaleFactor);
              })
              .filter(Boolean) as Shape[];

            return {
              success: true,
              message: `${shapesToAdd.length} object(s) copied and scaled by ${scaleFactor}.`,
              shapesToAdd,
              newState: {
                activeCommand: null,
                phase: 'idle',
                prompt: 'Command:',
                selectedIds: [],
                basePoint: null,
              },
            };
          }

          // Scale in place
          const shapesToUpdate = state.selectedIds
            .map((id) => {
              const shape = shapes.find((s) => s.id === id);
              if (!shape) return null;

              return {
                id,
                updates: scaleShape(shape, state.basePoint!, scaleFactor),
              };
            })
            .filter(Boolean) as { id: string; updates: Partial<Shape> }[];

          return {
            success: true,
            message: `${state.selectedIds.length} object(s) scaled by ${scaleFactor}.`,
            shapesToUpdate,
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
              basePoint: null,
            },
          };
        }

        if (input.type === 'point' && state.basePoint) {
          // Calculate scale factor from distance
          const originalDist = state.data.originalDistance || 1;
          const dx = input.point.x - state.basePoint.x;
          const dy = input.point.y - state.basePoint.y;
          const newDist = Math.sqrt(dx * dx + dy * dy);
          const scaleFactor = newDist / originalDist;

          if (state.data.copy) {
            const shapesToAdd = state.selectedIds
              .map((id) => {
                const shape = shapes.find((s) => s.id === id);
                if (!shape) return null;
                return scaleShapeCopy(shape, state.basePoint!, scaleFactor);
              })
              .filter(Boolean) as Shape[];

            return {
              success: true,
              message: `${shapesToAdd.length} object(s) copied and scaled by ${scaleFactor.toFixed(2)}.`,
              shapesToAdd,
              newState: {
                activeCommand: null,
                phase: 'idle',
                prompt: 'Command:',
                selectedIds: [],
                basePoint: null,
              },
            };
          }

          const shapesToUpdate = state.selectedIds
            .map((id) => {
              const shape = shapes.find((s) => s.id === id);
              if (!shape) return null;

              return {
                id,
                updates: scaleShape(shape, state.basePoint!, scaleFactor),
              };
            })
            .filter(Boolean) as { id: string; updates: Partial<Shape> }[];

          return {
            success: true,
            message: `${state.selectedIds.length} object(s) scaled by ${scaleFactor.toFixed(2)}.`,
            shapesToUpdate,
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
              basePoint: null,
            },
          };
        }

        if (input.type === 'option') {
          const opt = input.option.toLowerCase();
          if (opt === 'copy' || opt === 'c') {
            return {
              success: true,
              message: 'Copy mode ON',
              newState: {
                data: { ...state.data, copy: true },
                prompt: 'Specify scale factor or [Copy/Reference] <1>:',
              },
            };
          }
          if (opt === 'reference' || opt === 'r') {
            return {
              success: true,
              newState: {
                data: { ...state.data, useReference: true },
                prompt: 'Specify reference length <1>:',
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
    state: CommandState,
    currentPoint: Point,
    shapes: Shape[]
  ): Shape[] => {
    if (state.phase !== 'awaiting_value' || !state.basePoint) {
      return [];
    }

    // Calculate scale factor from distance to base point
    const dx = currentPoint.x - state.basePoint.x;
    const dy = currentPoint.y - state.basePoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scaleFactor = Math.max(0.1, dist / 100); // Use 100 as reference

    return state.selectedIds
      .map((id) => {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return null;

        const scaled = scaleShapeCopy(shape, state.basePoint!, scaleFactor);
        return {
          ...scaled,
          id: `preview-${id}`,
          style: { ...scaled.style, strokeColor: '#00ff00' },
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
    };
  },
};

// Helper to scale a point from a center
function scalePoint(point: Point, center: Point, factor: number): Point {
  return {
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  };
}

// Helper to scale shape in place
function scaleShape(shape: Shape, center: Point, factor: number): Partial<Shape> {
  switch (shape.type) {
    case 'line':
      return {
        start: scalePoint(shape.start, center, factor),
        end: scalePoint(shape.end, center, factor),
      };
    case 'rectangle': {
      const newTopLeft = scalePoint(shape.topLeft, center, factor);
      return {
        topLeft: newTopLeft,
        width: shape.width * factor,
        height: shape.height * factor,
      };
    }
    case 'circle':
      return {
        center: scalePoint(shape.center, center, factor),
        radius: shape.radius * factor,
      };
    case 'arc':
      return {
        center: scalePoint(shape.center, center, factor),
        radius: shape.radius * factor,
      };
    case 'ellipse':
      return {
        center: scalePoint(shape.center, center, factor),
        radiusX: shape.radiusX * factor,
        radiusY: shape.radiusY * factor,
      };
    case 'polyline':
      return {
        points: shape.points.map((p) => scalePoint(p, center, factor)),
      };
    default:
      return {};
  }
}

// Helper to create a scaled copy
function scaleShapeCopy(shape: Shape, center: Point, factor: number): Shape {
  const newId = generateId();
  const updates = scaleShape(shape, center, factor);
  return { ...shape, ...updates, id: newId } as Shape;
}
