/**
 * ShortcutHUD - Live key press visualizer for the canvas
 *
 * Shows the actual keys being pressed in real-time in the bottom-left
 * of the canvas. Useful for screen recordings and video tutorials.
 * Keys fade out after a short delay.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../state/appStore';

/** A recorded key press with timestamp for fade-out */
interface KeyPress {
  id: number;
  display: string;   // Human-readable key display (e.g. "Ctrl+Z", "wa", "Esc")
  timestamp: number;
}

/** How long key presses stay visible (ms) */
const FADE_DURATION = 2000;
/** Maximum number of key presses to show at once */
const MAX_VISIBLE = 6;

/** Map raw key names to display-friendly labels */
function formatKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && !['Shift', 'shift'].includes(e.key)) parts.push('Shift');

  const key = e.key;
  switch (key) {
    case ' ': parts.push('Space'); break;
    case 'Escape': parts.push('Esc'); break;
    case 'Enter': parts.push('Enter'); break;
    case 'Backspace': parts.push('Backspace'); break;
    case 'Delete': parts.push('Del'); break;
    case 'Tab': parts.push('Tab'); break;
    case 'ArrowUp': parts.push('\u2191'); break;
    case 'ArrowDown': parts.push('\u2193'); break;
    case 'ArrowLeft': parts.push('\u2190'); break;
    case 'ArrowRight': parts.push('\u2192'); break;
    case 'Shift': parts.push('Shift'); break;
    case 'Control': case 'Meta': break; // Already handled as modifier
    case 'Alt': break;
    default:
      if (key.length === 1) {
        parts.push(key.toUpperCase());
      } else {
        parts.push(key);
      }
  }

  return parts.join('+');
}

/** Two-key combos that should be merged (e.g. 'w' + 'a' → 'wa → Wall') */
const TWO_KEY_LABELS: Record<string, string> = {
  'md': 'Select', 'mv': 'Move', 'co': 'Copy', 'cc': 'Copy 2',
  'ro': 'Rotate', 'mm': 'Mirror', 're': 'Scale', 'tr': 'Trim',
  'ex': 'Extend', 'of': 'Offset', 'fl': 'Fillet', 'li': 'Line',
  'rc': 'Rectangle', 'ci': 'Circle', 'ar': 'Arc', 'pl': 'Polyline',
  'el': 'Ellipse', 'sp': 'Spline', 'tx': 'Text', 'le': 'Leader',
  'di': 'Dimension', 'dl': 'Dim Linear', 'da': 'Dim Angular',
  'dr': 'Dim Radius', 'dd': 'Dim Diameter', 'se': 'Section',
  'be': 'Beam', 'gl': 'Gridline', 'pi': 'Pile', 'ct': 'CPT',
  'wa': 'Wall', 'al': 'Align', 'ay': 'Array', 'tw': 'Trim Walls',
  'sl': 'Slab', 'ps': 'Plate System', 'lv': 'Level', 'lb': 'Label',
  'im': 'Image', 'rm': 'Space', 'sv': 'Spot Elevation',
  'cs': 'Create Similar', 'tl': 'Thin Lines', 'za': 'Zoom All',
};

let nextId = 0;

export function ShortcutHUD() {
  const editorMode = useAppStore(s => s.editorMode);
  const [keyPresses, setKeyPresses] = useState<KeyPress[]>([]);
  const pendingKeyRef = useRef<{ key: string; id: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const addKeyPress = useCallback((display: string) => {
    const id = nextId++;
    setKeyPresses(prev => {
      const next = [...prev, { id, display, timestamp: Date.now() }];
      return next.slice(-MAX_VISIBLE);
    });
  }, []);

  // Merge two single keys into a combo if it matches TWO_KEY_LABELS
  const tryMergeCombo = useCallback((firstKey: string, secondKey: string, firstId: number) => {
    const combo = firstKey.toLowerCase() + secondKey.toLowerCase();
    const label = TWO_KEY_LABELS[combo];
    if (label) {
      // Replace the first key press with the combo
      setKeyPresses(prev =>
        prev.map(kp =>
          kp.id === firstId
            ? { ...kp, display: `${combo} \u2192 ${label}`, timestamp: Date.now() }
            : kp
        )
      );
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const display = formatKey(e);
      if (!display) return;

      // Check for two-key combo
      const key = e.key;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.length === 1) {
        if (pendingKeyRef.current) {
          const pending = pendingKeyRef.current;
          clearTimeout(pending.timer);
          pendingKeyRef.current = null;

          if (tryMergeCombo(pending.key, key, pending.id)) {
            return;
          }
          // Not a valid combo — add the second key as separate
          addKeyPress(display);
          return;
        }

        // Start pending for potential combo
        const id = nextId++;
        setKeyPresses(prev => {
          const next = [...prev, { id, display, timestamp: Date.now() }];
          return next.slice(-MAX_VISIBLE);
        });
        pendingKeyRef.current = {
          key,
          id,
          timer: setTimeout(() => {
            pendingKeyRef.current = null;
          }, 750),
        };
        return;
      }

      // Clear any pending combo on modifier keys
      if (pendingKeyRef.current) {
        clearTimeout(pendingKeyRef.current.timer);
        pendingKeyRef.current = null;
      }

      addKeyPress(display);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [addKeyPress, tryMergeCombo]);

  // Cleanup expired key presses
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setKeyPresses(prev => prev.filter(kp => now - kp.timestamp < FADE_DURATION));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Only show in drawing mode
  if (editorMode !== 'drawing') return null;
  if (keyPresses.length === 0) return null;

  const now = Date.now();

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        left: 8,
        bottom: 60,
        zIndex: 20,
      }}
    >
      <div className="flex flex-col gap-1">
        {keyPresses.map((kp) => {
          const age = now - kp.timestamp;
          const opacity = Math.max(0, 1 - age / FADE_DURATION);
          return (
            <div
              key={kp.id}
              className="bg-black/70 backdrop-blur-sm rounded px-2.5 py-1 border border-white/15 transition-opacity"
              style={{ opacity }}
            >
              <span className="text-[12px] font-mono font-medium text-amber-300">
                {kp.display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
