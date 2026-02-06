/**
 * Shared state for grip axis hover highlighting.
 * Used by useGripEditing (writer) and ShapeRenderer (reader).
 */

export interface GripHoverState {
  shapeId: string;
  gripIndex: number;
  axis: 'x' | 'y';
}

let currentHover: GripHoverState | null = null;

export function setGripHover(state: GripHoverState | null): void {
  currentHover = state;
}

export function getGripHover(): GripHoverState | null {
  return currentHover;
}
