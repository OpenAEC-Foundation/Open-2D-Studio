import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const rotateCommand: CommandHandler = {
  name: 'ROTATE',

  start: (state: CommandState, selectedIds: string[]): CommandState => {
    if (selectedIds.length > 0) {
      return {
        ...state,
        activeCommand: 'ROTATE',
        phase: 'awaiting_point',
        prompt: 'ROTATE Specify base point:',
        options: [],
        selectedIds: [...selectedIds],
        selectionComplete: true,
        basePoint: null,
        data: { copy: false },
      };
    }

    return {
      ...state,
      activeCommand: 'ROTATE',
      phase: 'selecting',
      prompt: 'ROTATE Select objects:',
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
              prompt: 'Specify rotation angle or [Copy/Reference] <0>:',
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
          const angleDeg = input.value;
          const angleRad = (angleDeg * Math.PI) / 180;

          if (state.data.copy) {
            // Create rotated copies
            const shapesToAdd = state.selectedIds
              .map((id) => {
                const shape = shapes.find((s) => s.id === id);
                if (!shape) return null;
                return rotateShapeCopy(shape, state.basePoint!, angleRad);
              })
              .filter(Boolean) as Shape[];

            return {
              success: true,
              message: `${shapesToAdd.length} object(s) copied and rotated ${angleDeg}°.`,
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

          // Rotate in place
          const shapesToUpdate = state.selectedIds
            .map((id) => {
              const shape = shapes.find((s) => s.id === id);
              if (!shape) return null;

              return {
                id,
                updates: rotateShape(shape, state.basePoint!, angleRad),
              };
            })
            .filter(Boolean) as { id: string; updates: Partial<Shape> }[];

          return {
            success: true,
            message: `${state.selectedIds.length} object(s) rotated ${angleDeg}°.`,
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
          // Calculate angle from base point to clicked point
          const dx = input.point.x - state.basePoint.x;
          const dy = input.point.y - state.basePoint.y;
          const angleRad = Math.atan2(-dy, dx); // Negative Y for screen coords
          const angleDeg = (angleRad * 180) / Math.PI;

          if (state.data.copy) {
            const shapesToAdd = state.selectedIds
              .map((id) => {
                const shape = shapes.find((s) => s.id === id);
                if (!shape) return null;
                return rotateShapeCopy(shape, state.basePoint!, angleRad);
              })
              .filter(Boolean) as Shape[];

            return {
              success: true,
              message: `${shapesToAdd.length} object(s) copied and rotated ${angleDeg.toFixed(1)}°.`,
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
                updates: rotateShape(shape, state.basePoint!, angleRad),
              };
            })
            .filter(Boolean) as { id: string; updates: Partial<Shape> }[];

          return {
            success: true,
            message: `${state.selectedIds.length} object(s) rotated ${angleDeg.toFixed(1)}°.`,
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
                prompt: 'Specify rotation angle or [Copy/Reference] <0>:',
              },
            };
          }
          if (opt === 'reference' || opt === 'r') {
            return {
              success: true,
              newState: {
                data: { ...state.data, useReference: true },
                prompt: 'Specify the reference angle <0>:',
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

    // Calculate angle from base point to current point
    const dx = currentPoint.x - state.basePoint.x;
    const dy = currentPoint.y - state.basePoint.y;
    const angleRad = Math.atan2(-dy, dx);

    return state.selectedIds
      .map((id) => {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return null;

        const rotated = rotateShapeCopy(shape, state.basePoint!, angleRad);
        return {
          ...rotated,
          id: `preview-${id}`,
          style: { ...rotated.style, strokeColor: '#00ff00' },
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

// Helper to rotate a point around a center
function rotatePoint(point: Point, center: Point, angleRad: number): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// Helper to rotate shape in place
function rotateShape(shape: Shape, center: Point, angleRad: number): Partial<Shape> {
  switch (shape.type) {
    case 'line':
      return {
        start: rotatePoint(shape.start, center, angleRad),
        end: rotatePoint(shape.end, center, angleRad),
      };
    case 'rectangle': {
      // For rectangles, we need to convert to polyline or just rotate the topLeft and add rotation
      const rotatedTopLeft = rotatePoint(shape.topLeft, center, angleRad);
      const currentRotation = shape.rotation || 0;
      return {
        topLeft: rotatedTopLeft,
        rotation: currentRotation + angleRad,
      };
    }
    case 'circle':
      return {
        center: rotatePoint(shape.center, center, angleRad),
      };
    case 'arc': {
      const newCenter = rotatePoint(shape.center, center, angleRad);
      return {
        center: newCenter,
        startAngle: shape.startAngle + angleRad,
        endAngle: shape.endAngle + angleRad,
      };
    }
    case 'ellipse': {
      const newCenter = rotatePoint(shape.center, center, angleRad);
      return {
        center: newCenter,
        rotation: (shape.rotation || 0) + angleRad,
      };
    }
    case 'polyline':
      return {
        points: shape.points.map((p) => rotatePoint(p, center, angleRad)),
      };
    default:
      return {};
  }
}

// Helper to create a rotated copy
function rotateShapeCopy(shape: Shape, center: Point, angleRad: number): Shape {
  const newId = generateId();
  const updates = rotateShape(shape, center, angleRad);
  return { ...shape, ...updates, id: newId } as Shape;
}
