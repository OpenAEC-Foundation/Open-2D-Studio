import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape } from '../../types/geometry';

export const eraseCommand: CommandHandler = {
  name: 'ERASE',

  start: (state: CommandState, selectedIds: string[]): CommandState => {
    // If objects are already selected, use them
    if (selectedIds.length > 0) {
      return {
        ...state,
        activeCommand: 'ERASE',
        phase: 'selecting',
        prompt: `${selectedIds.length} object(s) selected. Press Enter to erase or select more:`,
        options: [],
        selectedIds: [...selectedIds],
        selectionComplete: false,
      };
    }

    return {
      ...state,
      activeCommand: 'ERASE',
      phase: 'selecting',
      prompt: 'ERASE Select objects:',
      options: [],
      selectedIds: [],
      selectionComplete: false,
    };
  },

  handleInput: (
    state: CommandState,
    input: CommandInput,
    _shapes: Shape[]
  ): CommandResult => {
    switch (input.type) {
      case 'selection':
        // Add to selection
        const newSelection = [...new Set([...state.selectedIds, ...input.ids])];
        return {
          success: true,
          newState: {
            selectedIds: newSelection,
            prompt: `${newSelection.length} object(s) selected. Press Enter to erase or select more:`,
          },
        };

      case 'enter':
        // Execute erase
        if (state.selectedIds.length === 0) {
          return {
            success: false,
            message: 'No objects selected.',
            newState: {
              activeCommand: null,
              phase: 'idle',
              prompt: 'Command:',
            },
          };
        }

        return {
          success: true,
          message: `${state.selectedIds.length} object(s) erased.`,
          shapesToDelete: state.selectedIds,
          newState: {
            activeCommand: null,
            phase: 'idle',
            prompt: 'Command:',
            selectedIds: [],
          },
        };

      case 'escape':
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

      default:
        return { success: false };
    }
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
