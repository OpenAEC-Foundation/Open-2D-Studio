import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape } from '../../types/geometry';
import { createInitialCommandState } from '../index';

export const printCommand: CommandHandler = {
  name: 'PRINT',

  start: (state: CommandState, selectedIds: string[]): CommandState => {
    // PRINT command immediately opens the print dialog
    return {
      ...state,
      activeCommand: 'PRINT',
      phase: 'executing',
      prompt: 'Opening print dialog...',
      options: [],
      selectedIds,
    };
  },

  handleInput: (
    state: CommandState,
    input: CommandInput,
    shapes: Shape[]
  ): CommandResult => {
    // PRINT command opens the print dialog and completes immediately
    return {
      success: true,
      message: 'Opening print dialog...',
      openPrintDialog: true,
      newState: {
        activeCommand: null,
        phase: 'idle',
        prompt: 'Command:',
      },
    };
  },

  getPreview: () => [],

  cancel: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: null,
      phase: 'idle',
      prompt: 'Command:',
      options: [],
    };
  },
};
