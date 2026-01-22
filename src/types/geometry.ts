// Core geometry types for the CAD engine

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot';

export interface ShapeStyle {
  strokeColor: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  fillColor?: string;
}

// Base shape interface
export interface BaseShape {
  id: string;
  type: ShapeType;
  layerId: string;
  style: ShapeStyle;
  visible: boolean;
  locked: boolean;
}

export type ShapeType = 'line' | 'rectangle' | 'circle' | 'arc' | 'polyline' | 'ellipse' | 'text' | 'point';

// Specific shape types
export interface LineShape extends BaseShape {
  type: 'line';
  start: Point;
  end: Point;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  topLeft: Point;
  width: number;
  height: number;
  rotation: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  center: Point;
  radius: number;
}

export interface ArcShape extends BaseShape {
  type: 'arc';
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  center: Point;
  radiusX: number;
  radiusY: number;
  rotation: number;
}

export interface PolylineShape extends BaseShape {
  type: 'polyline';
  points: Point[];
  closed: boolean;
}

export interface TextShape extends BaseShape {
  type: 'text';
  position: Point;
  text: string;
  fontSize: number;
  fontFamily: string;
  rotation: number;
}

export interface PointShape extends BaseShape {
  type: 'point';
  position: Point;
}

// Union type for all shapes
export type Shape =
  | LineShape
  | RectangleShape
  | CircleShape
  | ArcShape
  | EllipseShape
  | PolylineShape
  | TextShape
  | PointShape;

// Layer type
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  lineStyle: LineStyle;
  lineWidth: number;
}

// Viewport/Camera
export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

// Snap types
export type SnapType =
  | 'grid'
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'intersection'
  | 'perpendicular'
  | 'tangent'
  | 'nearest';

export interface SnapPoint {
  point: Point;
  type: SnapType;
  sourceShapeId?: string;
}

// Tool types
export type ToolType =
  | 'select'
  | 'pan'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'polyline'
  | 'ellipse'
  | 'text'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'scale'
  | 'mirror'
  | 'trim'
  | 'extend'
  | 'fillet'
  | 'offset';
