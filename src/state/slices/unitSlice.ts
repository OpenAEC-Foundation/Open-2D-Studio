/**
 * Unit Slice - Manages document-level unit settings
 */

import type { LengthUnit, NumberFormat, UnitSettings } from '../../units/types';
import { DEFAULT_UNIT_SETTINGS } from '../../units/types';
import type { DimensionShape } from '../../types/dimension';
import { calculateDimensionValue, formatDimensionValue, formatDimAssociateValue } from '../../engine/geometry/DimensionUtils';

// ============================================================================
// State Interface
// ============================================================================

export interface UnitState {
  unitSettings: UnitSettings;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface UnitActions {
  setUnitSettings: (settings: Partial<UnitSettings>) => void;
  setLengthUnit: (unit: LengthUnit) => void;
  setLengthPrecision: (precision: number) => void;
  setAnglePrecision: (precision: number) => void;
  setNumberFormat: (format: NumberFormat) => void;
  setShowUnitSuffix: (show: boolean) => void;
}

// ============================================================================
// Combined Slice Type
// ============================================================================

export type UnitSlice = UnitState & UnitActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialUnitState: UnitState = {
  unitSettings: { ...DEFAULT_UNIT_SETTINGS },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Re-format all non-overridden dimension values using the current unit settings.
 * Called after any unit setting change so existing dimensions stay in sync.
 */
function reformatAllDimensions(state: any): void {
  const settings: UnitSettings = state.unitSettings;
  for (const shape of state.shapes) {
    if (shape.type !== 'dimension') continue;
    const dim = shape as DimensionShape;
    if (dim.valueOverridden) continue;

    const rawValue = calculateDimensionValue(dim.points, dim.dimensionType, dim.linearDirection);

    // DimAssociate style uses plain integer formatting (no locale)
    if (dim.dimensionStyleName === 'DimAssociate') {
      dim.value = formatDimAssociateValue(rawValue);
    } else {
      dim.value = formatDimensionValue(rawValue, dim.dimensionType, dim.dimensionStyle.precision, settings);
    }
  }
}

// ============================================================================
// Slice Creator
// ============================================================================

export function createUnitSlice(
  set: (fn: (state: any) => void) => void,
  _get: () => any
): UnitActions {
  return {
    setUnitSettings: (settings: Partial<UnitSettings>) => {
      set((state) => {
        Object.assign(state.unitSettings, settings);
        reformatAllDimensions(state);
      });
    },

    setLengthUnit: (unit: LengthUnit) => {
      set((state) => {
        state.unitSettings.lengthUnit = unit;
        reformatAllDimensions(state);
      });
    },

    setLengthPrecision: (precision: number) => {
      set((state) => {
        state.unitSettings.lengthPrecision = Math.max(0, Math.min(8, precision));
        reformatAllDimensions(state);
      });
    },

    setAnglePrecision: (precision: number) => {
      set((state) => {
        state.unitSettings.anglePrecision = Math.max(0, Math.min(8, precision));
        reformatAllDimensions(state);
      });
    },

    setNumberFormat: (format: NumberFormat) => {
      set((state) => {
        state.unitSettings.numberFormat = format;
        reformatAllDimensions(state);
      });
    },

    setShowUnitSuffix: (show: boolean) => {
      set((state) => {
        state.unitSettings.showUnitSuffix = show;
        reformatAllDimensions(state);
      });
    },
  };
}
