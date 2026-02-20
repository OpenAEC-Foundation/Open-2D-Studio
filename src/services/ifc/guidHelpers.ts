/**
 * Shared IFC GUID and material name helpers.
 *
 * Used by both ifcGenerator.ts (parametric IFC export) and ifcExport.ts (2D annotation export).
 */

import type { MaterialCategory, BeamMaterial, SlabMaterial } from '../../types/geometry';

// ============================================================================
// IFC GUID Generation (22-character base64 encoding, ISO 10303-21)
// ============================================================================

export const BASE64_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** Generate a random 22-character IFC-compatible GUID. */
export function generateIfcGuid(): string {
  let result = '';
  for (let i = 0; i < 22; i++) {
    result += BASE64_CHARS[Math.floor(Math.random() * 64)];
  }
  return result;
}

/**
 * Deterministic GUID from shape ID (so the same shape always produces the same GUID).
 * Uses a simple hash of the input string to seed a base64 encoded result.
 */
export function shapeToIfcGuid(shapeId: string, suffix: string = ''): string {
  const input = shapeId + suffix;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  let result = '';
  let h = Math.abs(hash);
  for (let i = 0; i < 22; i++) {
    result += BASE64_CHARS[h % 64];
    h = Math.floor(h / 64);
    if (h === 0) h = Math.abs(hash + i * 7919); // prime-based mixing
  }
  return result;
}

// ============================================================================
// Material Name / Category Resolver
// ============================================================================

export function getMaterialDisplayName(material: MaterialCategory | BeamMaterial | SlabMaterial): string {
  switch (material) {
    case 'concrete': return 'Concrete';
    case 'masonry': return 'Masonry';
    case 'calcium-silicate': return 'Calcium Silicate';
    case 'timber': return 'Timber';
    case 'steel': return 'Steel';
    case 'cold-formed-steel': return 'Cold-Formed Steel';
    case 'aluminum': return 'Aluminum';
    case 'generic': return 'Generic';
    case 'other': return 'Other';
    default: return 'Generic';
  }
}

export function getMaterialCategory(material: MaterialCategory | BeamMaterial | SlabMaterial): string {
  switch (material) {
    case 'concrete': return 'concrete';
    case 'masonry': return 'masonry';
    case 'calcium-silicate': return 'calcium-silicate';
    case 'timber': return 'wood';
    case 'steel': case 'cold-formed-steel': case 'aluminum': return 'steel';
    case 'generic': case 'other': return 'not defined';
    default: return 'not defined';
  }
}
