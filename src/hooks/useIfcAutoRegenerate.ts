/**
 * useIfcAutoRegenerate - Hook that watches for shape changes
 * and triggers IFC regeneration with a 500ms debounce.
 *
 * Only regenerates when:
 * - ifcAutoGenerate is enabled
 * - The shapes array actually changes (add/delete/modify)
 * - The IFC panel is open (to avoid unnecessary computation)
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/appStore';

export function useIfcAutoRegenerate(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Subscribe to store changes
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      // Only regenerate if auto-generate is on and panel or 3D view is open
      if (!state.ifcAutoGenerate || (!state.ifcPanelOpen && !state.show3DView)) return;

      // Check if shapes, wallTypes, or slabTypes actually changed
      const shapesChanged = state.shapes !== prevState.shapes;
      const wallTypesChanged = state.wallTypes !== prevState.wallTypes;
      const slabTypesChanged = state.slabTypes !== prevState.slabTypes;

      if (!shapesChanged && !wallTypesChanged && !slabTypesChanged) return;

      // Debounce: clear any pending regeneration
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      // Schedule regeneration after 500ms
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Get latest state and regenerate
        const currentState = useAppStore.getState();
        if (currentState.ifcAutoGenerate && (currentState.ifcPanelOpen || currentState.show3DView)) {
          currentState.regenerateIFC();
        }
      }, 500);
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Also trigger regeneration when IFC panel is first opened
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.ifcPanelOpen && !prevState.ifcPanelOpen && state.ifcAutoGenerate) {
        // Panel just opened, regenerate immediately
        state.regenerateIFC();
      }
      if (state.show3DView && !prevState.show3DView && state.ifcAutoGenerate) {
        // 3D view just opened, regenerate immediately
        state.regenerateIFC();
      }
    });

    return unsubscribe;
  }, []);
}
