/**
 * SelectionService Test Suite
 *
 * Tests for selection operations
 *
 * Note: This is a template test file. Expand with specific tests as needed.
 */

import { describe, it, expect } from 'vitest';
import { addToSelection, toggleInSelection } from './selectionService';

describe('SelectionService', () => {
  describe('addToSelection', () => {
    it('adds shape ids to selection', () => {
      const selection = ['shape-1'];
      const newSelection = addToSelection(selection, ['shape-2']);

      expect(newSelection).toContain('shape-1');
      expect(newSelection).toContain('shape-2');
      expect(newSelection).toHaveLength(2);
    });

    it('adds multiple shape ids to selection', () => {
      const selection = ['shape-1'];
      const newSelection = addToSelection(selection, ['shape-2', 'shape-3']);

      expect(newSelection).toContain('shape-1');
      expect(newSelection).toContain('shape-2');
      expect(newSelection).toContain('shape-3');
      expect(newSelection).toHaveLength(3);
    });

    it('does not add duplicate ids', () => {
      const selection = ['shape-1', 'shape-2'];
      const newSelection = addToSelection(selection, ['shape-1']);

      expect(newSelection).toHaveLength(2);
    });
  });

  describe('toggleInSelection', () => {
    it('adds shape if not selected', () => {
      const selection = ['shape-1'];
      const newSelection = toggleInSelection(selection, 'shape-2');

      expect(newSelection).toContain('shape-2');
      expect(newSelection).toHaveLength(2);
    });
  });
});
