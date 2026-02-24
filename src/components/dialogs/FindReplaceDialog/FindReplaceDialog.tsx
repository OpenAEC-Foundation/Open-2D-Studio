/**
 * Find & Replace Dialog
 *
 * Search and replace text across all text shapes in the current drawing.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../../state/appStore';
import { DraggableModal } from '../../shared/DraggableModal';
import type { TextShape } from '../../../types/geometry';

interface FindReplaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  shapeId: string;
  text: string;
  matchIndex: number;
  matchLength: number;
}

export function FindReplaceDialog({ isOpen, onClose }: FindReplaceDialogProps) {
  const shapes = useAppStore(s => s.shapes);
  const updateShape = useAppStore(s => s.updateShape);
  const selectShapes = useAppStore(s => s.selectShapes);

  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [message, setMessage] = useState('');

  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus find input when dialog opens
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [isOpen]);

  // Get all text shapes
  const textShapes = shapes.filter((s): s is TextShape => s.type === 'text');

  // Build search pattern
  const buildPattern = useCallback((searchText: string): RegExp | null => {
    if (!searchText) return null;

    try {
      let pattern = searchText;

      if (!useRegex) {
        // Escape regex special characters
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }

      return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
  }, [caseSensitive, wholeWord, useRegex]);

  // Find all matches
  const findAll = useCallback(() => {
    const pattern = buildPattern(findText);
    if (!pattern) {
      setResults([]);
      setCurrentResultIndex(-1);
      setMessage(findText ? 'Invalid search pattern' : '');
      return;
    }

    const newResults: SearchResult[] = [];

    for (const shape of textShapes) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(shape.text)) !== null) {
        newResults.push({
          shapeId: shape.id,
          text: shape.text,
          matchIndex: match.index,
          matchLength: match[0].length,
        });
      }
    }

    setResults(newResults);
    setCurrentResultIndex(newResults.length > 0 ? 0 : -1);
    setMessage(newResults.length > 0
      ? `Found ${newResults.length} match${newResults.length > 1 ? 'es' : ''}`
      : 'No matches found'
    );

    // Select first result
    if (newResults.length > 0) {
      selectShapes([newResults[0].shapeId]);
    }
  }, [findText, buildPattern, textShapes, selectShapes]);

  // Navigate to next/previous result
  const goToResult = useCallback((index: number) => {
    if (results.length === 0) return;

    const newIndex = ((index % results.length) + results.length) % results.length;
    setCurrentResultIndex(newIndex);
    selectShapes([results[newIndex].shapeId]);
    setMessage(`${newIndex + 1} of ${results.length}`);
  }, [results, selectShapes]);

  // Replace current match
  const replaceCurrent = useCallback(() => {
    if (currentResultIndex < 0 || currentResultIndex >= results.length) {
      setMessage('No match selected');
      return;
    }

    const result = results[currentResultIndex];
    const shape = textShapes.find(s => s.id === result.shapeId);
    if (!shape) return;

    const newText =
      shape.text.substring(0, result.matchIndex) +
      replaceText +
      shape.text.substring(result.matchIndex + result.matchLength);

    updateShape(result.shapeId, { text: newText });

    // Re-search to update results
    setTimeout(() => {
      findAll();
    }, 0);

    setMessage('Replaced 1 match');
  }, [currentResultIndex, results, textShapes, replaceText, updateShape, findAll]);

  // Replace all matches
  const replaceAll = useCallback(() => {
    const pattern = buildPattern(findText);
    if (!pattern) {
      setMessage('Invalid search pattern');
      return;
    }

    let totalReplaced = 0;

    for (const shape of textShapes) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = shape.text.match(regex);

      if (matches && matches.length > 0) {
        const newText = shape.text.replace(regex, replaceText);
        updateShape(shape.id, { text: newText });
        totalReplaced += matches.length;
      }
    }

    setResults([]);
    setCurrentResultIndex(-1);
    setMessage(totalReplaced > 0
      ? `Replaced ${totalReplaced} match${totalReplaced > 1 ? 'es' : ''}`
      : 'No matches found'
    );
  }, [findText, replaceText, buildPattern, textShapes, updateShape]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToResult(currentResultIndex - 1);
      } else if (e.ctrlKey) {
        replaceCurrent();
      } else {
        if (results.length === 0) {
          findAll();
        } else {
          goToResult(currentResultIndex + 1);
        }
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) {
        goToResult(currentResultIndex - 1);
      } else {
        goToResult(currentResultIndex + 1);
      }
    }
  }, [onClose, findAll, goToResult, replaceCurrent, currentResultIndex, results.length]);

  const footerContent = (
    <>
      <span className="mr-4"><kbd className="px-1 bg-cad-bg rounded">Enter</kbd> Find next</span>
      <span className="mr-4"><kbd className="px-1 bg-cad-bg rounded">Shift+Enter</kbd> Find previous</span>
      <span><kbd className="px-1 bg-cad-bg rounded">Ctrl+Enter</kbd> Replace</span>
    </>
  );

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Find & Replace"
      width={480}
      footer={footerContent}
      footerClassName="px-4 py-2 bg-cad-bg/50 border-t border-cad-border text-xs text-cad-text-dim"
    >
      <div onKeyDown={handleKeyDown}>
        {/* Body */}
        <div className="p-4">
          {/* Find field */}
          <div className="mb-3">
            <label className="block text-xs text-cad-text-dim mb-1">Find</label>
            <div className="flex gap-2">
              <input
                ref={findInputRef}
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Search text..."
                className="flex-1 bg-cad-bg border border-cad-border rounded px-2 py-1.5 text-sm text-cad-text"
              />
              <button
                onClick={findAll}
                className="px-3 py-1.5 bg-cad-accent text-white text-sm rounded hover:bg-cad-accent/80"
              >
                Find All
              </button>
            </div>
          </div>

          {/* Replace field */}
          <div className="mb-3">
            <label className="block text-xs text-cad-text-dim mb-1">Replace with</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replacement text..."
                className="flex-1 bg-cad-bg border border-cad-border rounded px-2 py-1.5 text-sm text-cad-text"
              />
              <button
                onClick={replaceCurrent}
                disabled={results.length === 0}
                className="px-3 py-1.5 bg-cad-bg border border-cad-border text-sm rounded hover:bg-cad-border disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace
              </button>
              <button
                onClick={replaceAll}
                className="px-3 py-1.5 bg-cad-bg border border-cad-border text-sm rounded hover:bg-cad-border"
              >
                Replace All
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 text-xs text-cad-text">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="accent-cad-accent"
              />
              Case sensitive
            </label>
            <label className="flex items-center gap-2 text-xs text-cad-text">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="accent-cad-accent"
              />
              Whole word
            </label>
            <label className="flex items-center gap-2 text-xs text-cad-text">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="accent-cad-accent"
              />
              Use regex
            </label>
          </div>

          {/* Navigation */}
          {results.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => goToResult(currentResultIndex - 1)}
                className="px-2 py-1 bg-cad-bg border border-cad-border rounded text-sm hover:bg-cad-border"
                title="Previous (Shift+Enter or Shift+F3)"
              >
                ← Prev
              </button>
              <button
                onClick={() => goToResult(currentResultIndex + 1)}
                className="px-2 py-1 bg-cad-bg border border-cad-border rounded text-sm hover:bg-cad-border"
                title="Next (Enter or F3)"
              >
                Next →
              </button>
              <span className="text-xs text-cad-text-dim ml-2">
                {currentResultIndex + 1} of {results.length}
              </span>
            </div>
          )}

          {/* Results preview */}
          {results.length > 0 && (
            <div className="border border-cad-border rounded bg-cad-bg max-h-40 overflow-y-auto">
              {results.map((result, idx) => (
                <button
                  key={`${result.shapeId}-${result.matchIndex}`}
                  onClick={() => goToResult(idx)}
                  className={`w-full text-left px-2 py-1.5 text-xs border-b border-cad-border last:border-0 hover:bg-cad-border ${
                    idx === currentResultIndex ? 'bg-cad-accent/20' : ''
                  }`}
                >
                  <span className="text-cad-text-dim">
                    {result.text.substring(Math.max(0, result.matchIndex - 20), result.matchIndex)}
                  </span>
                  <span className="text-cad-accent font-medium">
                    {result.text.substring(result.matchIndex, result.matchIndex + result.matchLength)}
                  </span>
                  <span className="text-cad-text-dim">
                    {result.text.substring(result.matchIndex + result.matchLength, result.matchIndex + result.matchLength + 20)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Status message */}
          {message && (
            <div className="mt-3 text-xs text-cad-text-dim">
              {message}
            </div>
          )}
        </div>
      </div>
    </DraggableModal>
  );
}
