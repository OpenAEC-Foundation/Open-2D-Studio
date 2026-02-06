/**
 * Filled Region Types - Named, reusable type definitions for hatch/filled regions.
 *
 * Users define named types (e.g., "Concrete - Section", "Insulation - Batt")
 * and apply them to hatch shapes. Changing a type definition updates all instances.
 */

import type { HatchPatternType } from './geometry';

/**
 * A reusable filled region type definition.
 * When applied to a HatchShape, the shape derives its pattern properties from this type.
 */
export interface FilledRegionType {
  id: string;
  name: string;
  isBuiltIn: boolean;

  // Foreground pattern
  fgPatternType: HatchPatternType;
  fgPatternAngle: number;
  fgPatternScale: number;
  fgColor: string;
  fgCustomPatternId?: string;

  // Background pattern (optional second layer)
  bgPatternType?: HatchPatternType;
  bgPatternAngle?: number;
  bgPatternScale?: number;
  bgColor?: string;
  bgCustomPatternId?: string;

  // Display
  backgroundColor?: string;
  masking: boolean;
  lineWeight: number;
}

/**
 * Built-in filled region types that ship with the application.
 */
export const BUILTIN_FILLED_REGION_TYPES: FilledRegionType[] = [
  {
    id: 'frt-solid-fill',
    name: 'Solid Fill',
    isBuiltIn: true,
    fgPatternType: 'solid',
    fgPatternAngle: 0,
    fgPatternScale: 1,
    fgColor: '#808080',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-diagonal-hatch',
    name: 'Diagonal Hatch',
    isBuiltIn: true,
    fgPatternType: 'diagonal',
    fgPatternAngle: 0,
    fgPatternScale: 1,
    fgColor: '#ffffff',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-crosshatch',
    name: 'Crosshatch',
    isBuiltIn: true,
    fgPatternType: 'crosshatch',
    fgPatternAngle: 0,
    fgPatternScale: 1,
    fgColor: '#ffffff',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-concrete',
    name: 'Concrete',
    isBuiltIn: true,
    fgPatternType: 'dots',
    fgPatternAngle: 0,
    fgPatternScale: 0.8,
    fgColor: '#a0a0a0',
    backgroundColor: '#c0c0c0',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-earth',
    name: 'Earth',
    isBuiltIn: true,
    fgPatternType: 'diagonal',
    fgPatternAngle: 45,
    fgPatternScale: 1.5,
    fgColor: '#8B6914',
    bgPatternType: 'horizontal',
    bgPatternAngle: 0,
    bgPatternScale: 2,
    bgColor: '#6B4914',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-insulation',
    name: 'Insulation',
    isBuiltIn: true,
    fgPatternType: 'crosshatch',
    fgPatternAngle: 0,
    fgPatternScale: 0.6,
    fgColor: '#FFD700',
    backgroundColor: '#FFF8DC',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-sand',
    name: 'Sand',
    isBuiltIn: true,
    fgPatternType: 'dots',
    fgPatternAngle: 0,
    fgPatternScale: 0.5,
    fgColor: '#C4A747',
    backgroundColor: '#E8D98A',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-water',
    name: 'Water',
    isBuiltIn: true,
    fgPatternType: 'horizontal',
    fgPatternAngle: 0,
    fgPatternScale: 1.2,
    fgColor: '#4682B4',
    backgroundColor: '#B0E0E6',
    masking: true,
    lineWeight: 1,
  },
  {
    id: 'frt-wood',
    name: 'Wood',
    isBuiltIn: true,
    fgPatternType: 'diagonal',
    fgPatternAngle: 30,
    fgPatternScale: 1,
    fgColor: '#8B4513',
    bgPatternType: 'diagonal',
    bgPatternAngle: -30,
    bgPatternScale: 1,
    bgColor: '#A0522D',
    masking: true,
    lineWeight: 1,
  },
];

/**
 * Get a built-in filled region type by ID
 */
export function getBuiltinFilledRegionType(id: string): FilledRegionType | undefined {
  return BUILTIN_FILLED_REGION_TYPES.find(t => t.id === id);
}

/**
 * Check if a filled region type ID refers to a built-in type
 */
export function isBuiltinFilledRegionTypeId(id: string): boolean {
  return BUILTIN_FILLED_REGION_TYPES.some(t => t.id === id);
}
