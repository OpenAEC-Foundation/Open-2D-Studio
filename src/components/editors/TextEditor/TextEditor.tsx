/**
 * TextEditor - Inline text editing overlay component
 *
 * Provides an overlay textarea for editing text shapes directly on the canvas.
 * Matches the text shape's font styling and position.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../../state/appStore';
import { worldToScreen } from '../../../engine/geometry/GeometryUtils';
import type { TextShape } from '../../../types/geometry';

interface TextEditorProps {
  shape: TextShape;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function TextEditor({ shape, onSave, onCancel }: TextEditorProps) {
  const { viewport } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(shape.text);

  // Calculate screen position from world coordinates
  const screenPos = worldToScreen(shape.position.x, shape.position.y, viewport);

  // Focus on mount
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      // Move cursor to end
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
    }
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [text]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (text.trim()) {
        onSave(text);
      } else {
        onCancel();
      }
    }
    // Shift+Enter adds new line (default textarea behavior)
  }, [text, onSave, onCancel]);

  const handleBlur = useCallback(() => {
    if (text.trim()) {
      onSave(text);
    } else {
      onCancel();
    }
  }, [text, onSave, onCancel]);

  // Calculate font styles for textarea
  const fontSize = shape.fontSize * viewport.zoom;
  const fontStyle = `${shape.italic ? 'italic ' : ''}${shape.bold ? 'bold ' : ''}`;

  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        font: `${fontStyle}${fontSize}px ${shape.fontFamily}`,
        color: shape.color || '#ffffff',
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        border: '1px solid #0066ff',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        minWidth: '50px',
        minHeight: `${fontSize + 4}px`,
        padding: '2px 4px',
        transform: shape.rotation ? `rotate(${shape.rotation}rad)` : undefined,
        transformOrigin: 'top left',
        zIndex: 1000,
        lineHeight: shape.lineHeight || 1.2,
        textAlign: shape.alignment,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
      }}
      placeholder="Enter text..."
    />
  );
}
