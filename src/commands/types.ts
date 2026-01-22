import type { Point, Shape } from '../types/geometry';

// All available commands
export type CommandName =
  // Drawing commands
  | 'LINE'
  | 'CIRCLE'
  | 'RECTANGLE'
  | 'ARC'
  | 'POLYLINE'
  | 'POLYGON'
  | 'ELLIPSE'
  // Modify commands
  | 'ERASE'
  | 'MOVE'
  | 'COPY'
  | 'ROTATE'
  | 'SCALE'
  | 'MIRROR'
  | 'OFFSET'
  | 'TRIM'
  | 'EXTEND'
  | 'FILLET'
  | 'CHAMFER'
  | 'ARRAY'
  // Utility commands
  | 'UNDO'
  | 'REDO'
  | 'SELECT'
  | 'PAN'
  | 'ZOOM'
  | 'PRINT'
  | null;

// Command shortcuts mapping
export const COMMAND_SHORTCUTS: Record<string, CommandName> = {
  // Drawing
  'l': 'LINE',
  'line': 'LINE',
  'c': 'CIRCLE',
  'circle': 'CIRCLE',
  'rec': 'RECTANGLE',
  'rectang': 'RECTANGLE',
  'rectangle': 'RECTANGLE',
  'a': 'ARC',
  'arc': 'ARC',
  'pl': 'POLYLINE',
  'pline': 'POLYLINE',
  'polyline': 'POLYLINE',
  'pol': 'POLYGON',
  'polygon': 'POLYGON',
  'el': 'ELLIPSE',
  'ellipse': 'ELLIPSE',
  // Modify
  'e': 'ERASE',
  'erase': 'ERASE',
  'm': 'MOVE',
  'move': 'MOVE',
  'co': 'COPY',
  'cp': 'COPY',
  'copy': 'COPY',
  'ro': 'ROTATE',
  'rotate': 'ROTATE',
  'sc': 'SCALE',
  'scale': 'SCALE',
  'mi': 'MIRROR',
  'mirror': 'MIRROR',
  'o': 'OFFSET',
  'offset': 'OFFSET',
  'tr': 'TRIM',
  'trim': 'TRIM',
  'ex': 'EXTEND',
  'extend': 'EXTEND',
  'f': 'FILLET',
  'fillet': 'FILLET',
  'cha': 'CHAMFER',
  'chamfer': 'CHAMFER',
  'ar': 'ARRAY',
  'array': 'ARRAY',
  // Utility
  'u': 'UNDO',
  'undo': 'UNDO',
  'redo': 'REDO',
  'p': 'PAN',
  'pan': 'PAN',
  'z': 'ZOOM',
  'zoom': 'ZOOM',
  'print': 'PRINT',
  'plot': 'PRINT',
};

// Command state phases
export type CommandPhase =
  | 'idle'
  | 'selecting'             // Selecting objects
  | 'selecting_second'      // Selecting second object (fillet/chamfer)
  | 'awaiting_point'        // Waiting for a point input
  | 'awaiting_second_point' // Waiting for second point
  | 'awaiting_value'        // Waiting for a numeric value
  | 'awaiting_option'       // Waiting for option selection
  | 'awaiting_radius'       // Waiting for radius (fillet)
  | 'awaiting_dist1'        // Waiting for first distance (chamfer)
  | 'awaiting_dist2'        // Waiting for second distance (chamfer)
  | 'awaiting_angle_dist'   // Waiting for angle distance (chamfer)
  | 'awaiting_angle'        // Waiting for angle (chamfer)
  | 'executing';            // Command is executing

// Command state data
export interface CommandState {
  activeCommand: CommandName;
  phase: CommandPhase;
  prompt: string;
  options: string[];

  // Selection
  selectedIds: string[];
  selectionComplete: boolean;

  // Points
  basePoint: Point | null;
  secondPoint: Point | null;
  points: Point[];

  // Values
  numericValue: number | null;
  stringValue: string | null;

  // Command-specific data
  data: Record<string, any>;

  // Preview
  previewShapes: Shape[];
}

// Initial command state
export const initialCommandState: CommandState = {
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

// Command input types
export type CommandInput =
  | { type: 'point'; point: Point }
  | { type: 'value'; value: number }
  | { type: 'text'; text: string }
  | { type: 'option'; option: string }
  | { type: 'enter' }
  | { type: 'escape' }
  | { type: 'selection'; ids: string[]; point?: Point };

// Command result
export interface CommandResult {
  success: boolean;
  message?: string;
  newState?: Partial<CommandState>;
  shapesToAdd?: Shape[];
  shapesToUpdate?: { id: string; updates: Partial<Shape> }[];
  shapesToDelete?: string[];
  continue?: boolean; // Continue with same command (e.g., COPY multiple)
  openPrintDialog?: boolean; // Open the print dialog
}

// Command handler interface
export interface CommandHandler {
  name: CommandName;

  // Start the command
  start: (state: CommandState, selectedIds: string[]) => CommandState;

  // Handle input during command
  handleInput: (
    state: CommandState,
    input: CommandInput,
    shapes: Shape[]
  ) => CommandResult;

  // Get preview shapes for current state
  getPreview?: (
    state: CommandState,
    currentPoint: Point,
    shapes: Shape[]
  ) => Shape[];

  // Cancel the command
  cancel: (state: CommandState) => CommandState;
}
