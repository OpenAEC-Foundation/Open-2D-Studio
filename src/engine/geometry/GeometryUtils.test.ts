/**
 * GeometryUtils Test Suite
 *
 * Tests for core geometry calculations
 *
 * Note: This is a template test file. Expand with specific tests as needed.
 */

import { describe, it, expect } from 'vitest';
import { pointDistance } from './GeometryUtils';

describe('GeometryUtils', () => {
  describe('pointDistance', () => {
    it('calculates distance between two points', () => {
      expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('returns 0 for same point', () => {
      expect(pointDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    it('handles negative coordinates', () => {
      expect(pointDistance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
    });

    it('is commutative', () => {
      const p1 = { x: 10, y: 20 };
      const p2 = { x: 30, y: 40 };
      expect(pointDistance(p1, p2)).toBe(pointDistance(p2, p1));
    });
  });
});
