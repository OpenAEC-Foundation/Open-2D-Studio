/**
 * ShapeService Test Suite
 *
 * Tests for shape creation and transformation operations
 *
 * Note: This is a template test file. Expand with specific tests as needed.
 */

import { describe, it, expect } from 'vitest';
import {
  createLineShape,
  createCircleShape,
  getShapeCenter,
} from './shapeService';

describe('ShapeService', () => {
  describe('createLineShape', () => {
    it('creates a line shape with correct type', () => {
      const line = createLineShape(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        'layer-1',
        'drawing-1'
      );

      expect(line.type).toBe('line');
      expect(line.layerId).toBe('layer-1');
      expect(line.drawingId).toBe('drawing-1');
    });

    it('stores start and end points', () => {
      const line = createLineShape(
        { x: 5, y: 10 },
        { x: 15, y: 20 },
        'layer-1',
        'drawing-1'
      );

      expect(line.start.x).toBe(5);
      expect(line.start.y).toBe(10);
      expect(line.end.x).toBe(15);
      expect(line.end.y).toBe(20);
    });
  });

  describe('createCircleShape', () => {
    it('creates a circle shape with correct properties', () => {
      const circle = createCircleShape(
        { x: 50, y: 50 },
        25,
        'layer-1',
        'drawing-1'
      );

      expect(circle.type).toBe('circle');
      expect(circle.center.x).toBe(50);
      expect(circle.center.y).toBe(50);
      expect(circle.radius).toBe(25);
    });
  });

  describe('getShapeCenter', () => {
    it('returns center of a line', () => {
      const line = createLineShape(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        'layer-1',
        'drawing-1'
      );

      const center = getShapeCenter(line);

      expect(center.x).toBe(5);
      expect(center.y).toBe(5);
    });

    it('returns center of a circle', () => {
      const circle = createCircleShape(
        { x: 50, y: 50 },
        25,
        'layer-1',
        'drawing-1'
      );

      const center = getShapeCenter(circle);

      expect(center.x).toBe(50);
      expect(center.y).toBe(50);
    });
  });
});
