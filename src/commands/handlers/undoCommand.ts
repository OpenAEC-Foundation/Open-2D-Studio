import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape } from '../../types/geometry';
import { useAppStore } from '../../state/appStore';

export const undoCommand: CommandHandler = {
  name: 'UNDO',

  start: (_state: CommandState, _selectedIds: string[]): CommandState => {
    // UNDO executes immediately
    const { undo } = useAppStore.getState();
    const success = undo();

    return {
      activeCommand: null,
      phase: 'idle',
      prompt: success ? 'UNDO' : 'Nothing to undo.',
      options: [],
      selectedIds: [],
      selectionComplete: false,
      basePoint: null,
      secondPoint: null,
      points: [],
      numericValue: null,
      stringValue: null,
      data: {},
      previewShapes: [],
    };
  },

  handleInput: (
    _state: CommandState,
    _input: CommandInput,
    _shapes: Shape[]
  ): CommandResult => {
    // UNDO doesn't need input handling
    return {
      success: true,
      newState: {
        activeCommand: null,
        phase: 'idle',
        prompt: 'Command:',
      },
    };
  },

  cancel: (state: CommandState): CommandState => {
    return {
      ...state,
      activeCommand: null,
      phase: 'idle',
      prompt: 'Command:',
    };
  },
};
