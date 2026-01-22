import type { CommandHandler, CommandName, CommandState, CommandInput, CommandResult } from './types';
import type { Shape, Point } from '../types/geometry';
import { COMMAND_SHORTCUTS } from './types';

// Import all command handlers
import { eraseCommand } from './handlers/eraseCommand';
import { moveCommand } from './handlers/moveCommand';
import { copyCommand } from './handlers/copyCommand';
import { rotateCommand } from './handlers/rotateCommand';
import { scaleCommand } from './handlers/scaleCommand';
import { mirrorCommand } from './handlers/mirrorCommand';
import { offsetCommand } from './handlers/offsetCommand';
import { filletCommand } from './handlers/filletCommand';
import { chamferCommand } from './handlers/chamferCommand';
import { undoCommand } from './handlers/undoCommand';
import { redoCommand } from './handlers/redoCommand';
import { printCommand } from './handlers/printCommand';

// Command registry
const commandHandlers: Map<CommandName, CommandHandler> = new Map([
  ['ERASE', eraseCommand],
  ['MOVE', moveCommand],
  ['COPY', copyCommand],
  ['ROTATE', rotateCommand],
  ['SCALE', scaleCommand],
  ['MIRROR', mirrorCommand],
  ['OFFSET', offsetCommand],
  ['FILLET', filletCommand],
  ['CHAMFER', chamferCommand],
  ['UNDO', undoCommand],
  ['REDO', redoCommand],
  ['PRINT', printCommand],
]);

// Get command handler by name
export function getCommandHandler(name: CommandName): CommandHandler | undefined {
  return commandHandlers.get(name);
}

// Resolve command name from input (handles shortcuts)
export function resolveCommandName(input: string): CommandName | null {
  const normalized = input.toLowerCase().trim();

  // Check shortcuts first
  if (normalized in COMMAND_SHORTCUTS) {
    return COMMAND_SHORTCUTS[normalized];
  }

  // Check if it's a full command name
  const upperInput = input.toUpperCase().trim() as CommandName;
  if (commandHandlers.has(upperInput)) {
    return upperInput;
  }

  return null;
}

// Initial command state
export function createInitialCommandState(): CommandState {
  return {
    activeCommand: null,
    phase: 'idle',
    prompt: 'Command:',
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
}

// Start a command
export function startCommand(
  commandName: CommandName,
  currentState: CommandState,
  selectedIds: string[]
): CommandState {
  const handler = getCommandHandler(commandName);
  if (!handler) {
    return {
      ...currentState,
      prompt: `Unknown command: ${commandName}`,
    };
  }

  return handler.start(currentState, selectedIds);
}

// Process input for active command
export function processCommandInput(
  state: CommandState,
  input: CommandInput,
  shapes: Shape[]
): CommandResult {
  if (!state.activeCommand) {
    return { success: false, message: 'No active command.' };
  }

  const handler = getCommandHandler(state.activeCommand);
  if (!handler) {
    return { success: false, message: 'Command handler not found.' };
  }

  return handler.handleInput(state, input, shapes);
}

// Get preview shapes for active command
export function getCommandPreview(
  state: CommandState,
  currentPoint: Point,
  shapes: Shape[]
): Shape[] {
  if (!state.activeCommand) {
    return [];
  }

  const handler = getCommandHandler(state.activeCommand);
  if (!handler || !handler.getPreview) {
    return [];
  }

  return handler.getPreview(state, currentPoint, shapes);
}

// Cancel active command
export function cancelCommand(state: CommandState): CommandState {
  if (!state.activeCommand) {
    return state;
  }

  const handler = getCommandHandler(state.activeCommand);
  if (!handler) {
    return createInitialCommandState();
  }

  return handler.cancel(state);
}

// Export types
export * from './types';

// Export individual handlers for direct use
export {
  eraseCommand,
  moveCommand,
  copyCommand,
  rotateCommand,
  scaleCommand,
  mirrorCommand,
  offsetCommand,
  filletCommand,
  chamferCommand,
  undoCommand,
  redoCommand,
  printCommand,
};
