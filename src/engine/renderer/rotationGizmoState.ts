/**
 * Shared state for rotation gizmo visibility and active rotation feedback.
 * Written by the canvas render loop / useGripEditing, read by ShapeRenderer.
 */

let rotationGizmoVisible = true;

export function setRotationGizmoVisible(visible: boolean): void {
  rotationGizmoVisible = visible;
}

export function getRotationGizmoVisible(): boolean {
  return rotationGizmoVisible;
}

/**
 * Active rotation state — set during a rotation gizmo drag so the renderer
 * can draw angle feedback (guide lines, arc sweep, angle label).
 */
export interface ActiveRotationState {
  /** Shape being rotated */
  shapeId: string;
  /** Rotation center (world coordinates) */
  center: { x: number; y: number };
  /** Starting angle of the drag (radians, measured from center) */
  startAngle: number;
  /** Current delta angle (radians) — may be snapped */
  deltaAngle: number;
  /** Whether the angle is currently snapped to a detent */
  isSnapped: boolean;
}

let activeRotation: ActiveRotationState | null = null;

export function setActiveRotation(state: ActiveRotationState | null): void {
  activeRotation = state;
}

export function getActiveRotation(): ActiveRotationState | null {
  return activeRotation;
}

/**
 * Hover state for the rotation gizmo — set when the cursor is over the
 * rotation handle so the renderer can highlight it.
 */
let rotationGizmoHovered = false;

export function setRotationGizmoHovered(hovered: boolean): void {
  rotationGizmoHovered = hovered;
}

export function getRotationGizmoHovered(): boolean {
  return rotationGizmoHovered;
}
