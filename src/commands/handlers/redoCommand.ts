import type { CommandHandler, CommandState, CommandInput, CommandResult } from '../types';
import type { Shape } from '../../types/geometry';
import { useAppStore } from '../../state/appStore';

export const redoCommand: CommandHandler = {
  name: 'REDO',

  start: (_state: CommandState, _selectedIds: string[]): CommandState => {
    // REDO executes immediately
    const { redo } = useAppStore.getState();
    const success = redo();

    return {
      activeCommand: null,
      phase: 'idle',
      prompt: success ? 'REDO' : 'Nothing to redo.',
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
    // REDO doesn't need input handling
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
