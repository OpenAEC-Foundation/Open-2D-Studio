import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape, Point } from '../../types/geometry';
import { generateId } from '../../state/appStore';

export const copyCommand: CommandHandler = {
  name: 'COPY',

  start: (state: CommandState, selectedIds: string[]): CommandState => {
    if (selectedIds.length > 0) {
      return {
        ...state,
        activeCommand: 'COPY',
        phase: 'awaiting_point',
        prompt: 'COPY Specify base point or [Displacement/mOde]:',
        options: ['Displacement', 'mOde'],
        selectedIds: [...selectedIds],
        selectionComplete: true,
        basePoint: null,
        data: { multiple: true }, // Default to multiple mode
      };
    }

    return {
      ...state,
      activeCommand: 'COPY',
      phase: 'selecting',
      prompt: 'COPY Select objects:',
      options: [],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      data: { multiple: true },
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
              prompt: 'Specify base point or [Displacement/mOde]:',
              options: ['Displacement', 'mOde'],
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
              prompt: 'Specify second point or [Array] <use first point as displacement>:',
              options: ['Array'],
            },
          };
        }
        if (input.type === 'option') {
          const opt = input.option.toLowerCase();
          if (opt === 'displacement' || opt === 'd') {
            return {
              success: true,
              newState: {
                data: { ...state.data, useDisplacement: true },
                prompt: 'Specify displacement <0,0>:',
              },
            };
          }
          if (opt === 'mode' || opt === 'o') {
            const currentMode = state.data.multiple ? 'Multiple' : 'Single';
            return {
              success: true,
              newState: {
                prompt: `Enter a copy mode option [Single/Multiple] <${currentMode}>:`,
                options: ['Single', 'Multiple'],
                data: { ...state.data, awaitingMode: true },
              },
            };
          }
          if (opt === 'single' || opt === 's') {
            return {
              success: true,
              message: 'Copy mode: Single',
              newState: {
                data: { ...state.data, multiple: false, awaitingMode: false },
                prompt: 'Specify base point or [Displacement/mOde]:',
              },
            };
          }
          if (opt === 'multiple' || opt === 'm') {
            return {
              success: true,
              message: 'Copy mode: Multiple',
              newState: {
                data: { ...state.data, multiple: true, awaitingMode: false },
                prompt: 'Specify base point or [Displacement/mOde]:',
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

      case 'awaiting_second_point':
        if (input.type === 'point' && state.basePoint) {
          const dx = input.point.x - state.basePoint.x;
          const dy = input.point.y - state.basePoint.y;

          // Create copied shapes
          const shapesToAdd = state.selectedIds
            .map((id) => {
              const shape = shapes.find((s) => s.id === id);
              if (!shape) return null;

              return copyShape(shape, dx, dy);
            })
            .filter(Boolean) as Shape[];

          // If multiple mode, continue for more copies
          if (state.data.multiple) {
            return {
              success: true,
              message: `${shapesToAdd.length} object(s) copied.`,
              shapesToAdd,
              newState: {
                prompt: 'Specify second point or [Array/Exit/Undo] <Exit>:',
                options: ['Array', 'Exit', 'Undo'],
                data: { ...state.data, lastCopied: shapesToAdd.map((s) => s.id) },
              },
              continue: true,
            };
          }

          // Single mode - exit after one copy
          return {
            success: true,
            message: `${shapesToAdd.length} object(s) copied.`,
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
        if (input.type === 'option') {
          const opt = input.option.toLowerCase();
          if (opt === 'exit' || opt === 'e') {
            return {
              success: true,
              newState: {
                activeCommand: null,
                phase: 'idle',
                prompt: 'Command:',
                selectedIds: [],
                basePoint: null,
              },
            };
          }
          if (opt === 'undo' || opt === 'u') {
            // Undo last copy
            const lastCopied = state.data.lastCopied || [];
            return {
              success: true,
              message: 'Last copy undone.',
              shapesToDelete: lastCopied,
              newState: {
                data: { ...state.data, lastCopied: [] },
              },
            };
          }
        }
        if (input.type === 'enter') {
          // Exit on empty enter
          return {
            success: true,
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
              selectedIds: [],
              basePoint: null,
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

      default:
        return { success: false };
    }
  },

  getPreview: (
    state: CommandState,
    currentPoint: Point,
    shapes: Shape[]
  ): Shape[] => {
    if (state.phase !== 'awaiting_second_point' || !state.basePoint) {
      return [];
    }

    const dx = currentPoint.x - state.basePoint.x;
    const dy = currentPoint.y - state.basePoint.y;

    return state.selectedIds
      .map((id) => {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return null;

        const copied = copyShape(shape, dx, dy);
        return {
          ...copied,
          id: `preview-${id}`,
          style: { ...copied.style, strokeColor: '#00ff00' },
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

// Helper function to copy a shape with offset
function copyShape(shape: Shape, dx: number, dy: number): Shape {
  const newId = generateId();

  switch (shape.type) {
    case 'line':
      return {
        ...shape,
        id: newId,
        start: { x: shape.start.x + dx, y: shape.start.y + dy },
        end: { x: shape.end.x + dx, y: shape.end.y + dy },
      };
    case 'rectangle':
      return {
        ...shape,
        id: newId,
        topLeft: { x: shape.topLeft.x + dx, y: shape.topLeft.y + dy },
      };
    case 'circle':
      return {
        ...shape,
        id: newId,
        center: { x: shape.center.x + dx, y: shape.center.y + dy },
      };
    case 'arc':
      return {
        ...shape,
        id: newId,
        center: { x: shape.center.x + dx, y: shape.center.y + dy },
      };
    case 'ellipse':
      return {
        ...shape,
        id: newId,
        center: { x: shape.center.x + dx, y: shape.center.y + dy },
      };
    case 'polyline':
      return {
        ...shape,
        id: newId,
        points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    default:
      return { ...shape, id: newId };
  }
}
