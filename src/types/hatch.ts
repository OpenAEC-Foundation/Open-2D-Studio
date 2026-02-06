/**
 * Custom Hatch Pattern Types
 *
 * Supports both line-based patterns (PAT format compatible) and SVG tile patterns.
 */

/**
 * Pattern type determines how the pattern scales with view/print
 * - 'model': Pattern scales with geometry (real-world dimensions)
 * - 'drafting': Pattern maintains constant appearance regardless of zoom/scale
 */
export type HatchPatternScaleType = 'model' | 'drafting';

/**
 * Source of the pattern
 * - 'builtin': Built-in patterns that come with the application
 * - 'user': User-created patterns (stored in app settings)
 * - 'project': Project-specific patterns (stored with project file)
 * - 'imported': Imported from external file (PAT or SVG)
 */
export type HatchPatternSource = 'builtin' | 'user' | 'project' | 'imported';

/**
 * Pattern category for organizing patterns in the picker
 */
export type PatternCategory = 'basic' | 'hatching' | 'material' | 'geometric' | 'custom';

/**
 * Original format if pattern was imported
 */
export type HatchPatternFormat = 'pat' | 'svg';

/**
 * Line family definition - defines a set of parallel lines in a hatch pattern
 *
 * Based on industry-standard PAT format:
 * angle, x-origin, y-origin, delta-x, delta-y, [dash, gap, dash, gap...]
 */
export interface LineFamily {
  /** Line direction in degrees (0 = horizontal, 90 = vertical, 45 = diagonal) */
  angle: number;

  /** X coordinate of starting point for the line family */
  originX: number;

  /** Y coordinate of starting point for the line family */
  originY: number;

  /** Horizontal shift between successive parallel lines (for staggering, e.g., brick pattern) */
  deltaX: number;

  /** Perpendicular spacing between parallel lines */
  deltaY: number;

  /**
   * Dash pattern array: [dash, gap, dash, gap, ...]
   * - Positive values = dash length
   * - Negative values = gap length
   * - 0 = dot
   * - Empty array or undefined = continuous line
   */
  dashPattern?: number[];

  /** Line thickness (optional, defaults to shape stroke width) */
  strokeWidth?: number;

  /** Line color override (optional, defaults to shape fill color) */
  strokeColor?: string;
}

/**
 * Custom hatch pattern definition
 *
 * Can represent:
 * 1. Simple line-based patterns (like PAT files)
 * 2. Complex SVG tile patterns
 * 3. Both combined (SVG for preview, lines for rendering)
 */
export interface CustomHatchPattern {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Pattern scale type (model or drafting) */
  scaleType: HatchPatternScaleType;

  /** Source of the pattern */
  source: HatchPatternSource;

  /** Original import format (if imported) */
  sourceFormat?: HatchPatternFormat;

  /**
   * Line families that make up the pattern
   * For simple patterns like diagonal, this has 1 family
   * For crosshatch, this has 2 families
   * For complex patterns like brick, this may have multiple families
   */
  lineFamilies: LineFamily[];

  /**
   * SVG content for preview (optional)
   * Used for displaying in pattern picker and for complex patterns
   */
  svgPreview?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Last modified timestamp */
  modifiedAt?: string;

  /** Category for organizing in the pattern picker */
  category?: PatternCategory;
}

/**
 * SVG-based hatch pattern (for complex patterns that can't be expressed as line families)
 *
 * These patterns are rendered by tiling an SVG image
 */
export interface SvgHatchPattern extends CustomHatchPattern {
  /** SVG content of the repeating tile */
  svgTile: string;

  /** Tile width in pattern units */
  tileWidth: number;

  /** Tile height in pattern units */
  tileHeight: number;

  /** Optional rotation of the entire tile pattern */
  tileRotation?: number;
}

/**
 * Type guard to check if a pattern is SVG-based
 */
export function isSvgHatchPattern(pattern: CustomHatchPattern): pattern is SvgHatchPattern {
  return 'svgTile' in pattern && typeof (pattern as SvgHatchPattern).svgTile === 'string';
}

/**
 * Built-in pattern IDs (for backward compatibility)
 */
export type BuiltinPatternId =
  | 'solid' | 'diagonal' | 'crosshatch' | 'horizontal' | 'vertical' | 'dots'
  // Material
  | 'concrete' | 'brick-running' | 'brick-stack' | 'insulation' | 'earth' | 'sand' | 'gravel' | 'water' | 'clay'
  // Wood
  | 'wood-grain' | 'plywood' | 'timber-section'
  // Metal
  | 'steel-section' | 'aluminum'
  // Masonry
  | 'stone-block' | 'cut-stone'
  // Geometric
  | 'diamonds' | 'herringbone' | 'basket-weave' | 'zigzag';

/**
 * Built-in patterns converted to CustomHatchPattern format
 */
export const BUILTIN_PATTERNS: CustomHatchPattern[] = [
  {
    id: 'solid',
    name: 'Solid',
    description: 'Solid fill with no pattern lines',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'basic',
    lineFamilies: [], // Empty = solid fill
  },
  {
    id: 'diagonal',
    name: 'Diagonal',
    description: 'Diagonal lines at 45 degrees',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'hatching',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
    ],
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    description: 'Two sets of diagonal lines forming a cross pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'hatching',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
      { angle: -45, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
    ],
  },
  {
    id: 'horizontal',
    name: 'Horizontal',
    description: 'Horizontal parallel lines',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'basic',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
    ],
  },
  {
    id: 'vertical',
    name: 'Vertical',
    description: 'Vertical parallel lines',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'basic',
    lineFamilies: [
      { angle: 90, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
    ],
  },
  {
    id: 'dots',
    name: 'Dots',
    description: 'Regular grid of dots',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'hatching',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 10, deltaY: 10, dashPattern: [0] },
    ],
  },

  // =========================================================================
  // Material Patterns
  // =========================================================================
  {
    id: 'concrete',
    name: 'Concrete',
    description: 'Concrete section - random dots and short dashes',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 37, originX: 0, originY: 0, deltaX: 3, deltaY: 8, dashPattern: [0] },
      { angle: 127, originX: 5, originY: 3, deltaX: 5, deltaY: 12, dashPattern: [0] },
      { angle: 70, originX: 2, originY: 7, deltaX: 7, deltaY: 10, dashPattern: [0] },
    ],
  },
  {
    id: 'brick-running',
    name: 'Brick Running Bond',
    description: 'Brick pattern with staggered rows',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
      { angle: 90, originX: 0, originY: 0, deltaX: 20, deltaY: 20, dashPattern: [10, -10] },
    ],
  },
  {
    id: 'brick-stack',
    name: 'Brick Stack Bond',
    description: 'Brick pattern with aligned vertical joints',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
      { angle: 90, originX: 0, originY: 0, deltaX: 0, deltaY: 20, dashPattern: [10, -10] },
    ],
  },
  {
    id: 'insulation',
    name: 'Insulation',
    description: 'Insulation batt pattern with wavy lines',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 6 },
      { angle: -45, originX: 0, originY: 0, deltaX: 0, deltaY: 6 },
    ],
  },
  {
    id: 'earth',
    name: 'Earth',
    description: 'Earth/soil section pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 12, dashPattern: [6, -3, 2, -3] },
      { angle: 0, originX: 0, originY: 0, deltaX: 6, deltaY: 10, dashPattern: [0] },
    ],
  },
  {
    id: 'sand',
    name: 'Sand',
    description: 'Sand pattern - scattered dots',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 6, deltaY: 6, dashPattern: [0] },
      { angle: 60, originX: 3, originY: 2, deltaX: 6, deltaY: 8, dashPattern: [0] },
      { angle: 120, originX: 1, originY: 4, deltaX: 8, deltaY: 7, dashPattern: [0] },
    ],
  },
  {
    id: 'gravel',
    name: 'Gravel',
    description: 'Gravel/aggregate pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 30, originX: 0, originY: 0, deltaX: 4, deltaY: 12, dashPattern: [3, -5] },
      { angle: -30, originX: 6, originY: 0, deltaX: 4, deltaY: 12, dashPattern: [2, -6] },
      { angle: 80, originX: 2, originY: 4, deltaX: 6, deltaY: 10, dashPattern: [0] },
    ],
  },
  {
    id: 'water',
    name: 'Water',
    description: 'Water section - horizontal wavy lines',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 8 },
      { angle: 0, originX: 0, originY: 4, deltaX: 0, deltaY: 16, dashPattern: [8, -4] },
    ],
  },
  {
    id: 'clay',
    name: 'Clay',
    description: 'Clay section pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 6, dashPattern: [12, -4] },
      { angle: 0, originX: 8, originY: 3, deltaX: 0, deltaY: 6, dashPattern: [6, -10] },
    ],
  },

  // =========================================================================
  // Wood Patterns
  // =========================================================================
  {
    id: 'wood-grain',
    name: 'Wood Grain',
    description: 'Wood grain lines at varying spacing',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 5 },
      { angle: 0, originX: 0, originY: 2, deltaX: 0, deltaY: 12, dashPattern: [15, -8] },
    ],
  },
  {
    id: 'plywood',
    name: 'Plywood',
    description: 'Plywood cross-section with alternating grain',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 4 },
      { angle: 90, originX: 0, originY: 0, deltaX: 0, deltaY: 15, dashPattern: [4, -8] },
    ],
  },
  {
    id: 'timber-section',
    name: 'Timber Section',
    description: 'Timber cross-section with diagonal lines',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 5 },
      { angle: -45, originX: 0, originY: 0, deltaX: 0, deltaY: 10, dashPattern: [3, -7] },
    ],
  },

  // =========================================================================
  // Metal Patterns
  // =========================================================================
  {
    id: 'steel-section',
    name: 'Steel Section',
    description: 'Steel cross-section with dense diagonal lines',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 3 },
    ],
  },
  {
    id: 'aluminum',
    name: 'Aluminum',
    description: 'Aluminum section pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 0, deltaY: 3 },
      { angle: 45, originX: 0, originY: 1.5, deltaX: 0, deltaY: 6, dashPattern: [4, -4] },
    ],
  },

  // =========================================================================
  // Masonry Patterns
  // =========================================================================
  {
    id: 'stone-block',
    name: 'Stone Block',
    description: 'Rough stone block pattern',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 20 },
      { angle: 90, originX: 0, originY: 0, deltaX: 30, deltaY: 40, dashPattern: [20, -20] },
      { angle: 45, originX: 5, originY: 5, deltaX: 10, deltaY: 20, dashPattern: [3, -17] },
    ],
  },
  {
    id: 'cut-stone',
    name: 'Cut Stone',
    description: 'Dressed/cut stone pattern',
    scaleType: 'model',
    source: 'builtin',
    category: 'material',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 0, deltaY: 15 },
      { angle: 90, originX: 0, originY: 0, deltaX: 25, deltaY: 30, dashPattern: [15, -15] },
    ],
  },

  // =========================================================================
  // Geometric Patterns
  // =========================================================================
  {
    id: 'diamonds',
    name: 'Diamonds',
    description: 'Diamond/rhombus grid pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'geometric',
    lineFamilies: [
      { angle: 60, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
      { angle: -60, originX: 0, originY: 0, deltaX: 0, deltaY: 10 },
    ],
  },
  {
    id: 'herringbone',
    name: 'Herringbone',
    description: 'Herringbone / chevron pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'geometric',
    lineFamilies: [
      { angle: 45, originX: 0, originY: 0, deltaX: 10, deltaY: 10, dashPattern: [10, -10] },
      { angle: -45, originX: 0, originY: 0, deltaX: 10, deltaY: 10, dashPattern: [10, -10] },
    ],
  },
  {
    id: 'basket-weave',
    name: 'Basket Weave',
    description: 'Alternating horizontal and vertical segments',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'geometric',
    lineFamilies: [
      { angle: 0, originX: 0, originY: 0, deltaX: 20, deltaY: 10, dashPattern: [10, -10] },
      { angle: 90, originX: 10, originY: 0, deltaX: 10, deltaY: 20, dashPattern: [10, -10] },
    ],
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    description: 'Zigzag / sawtooth pattern',
    scaleType: 'drafting',
    source: 'builtin',
    category: 'geometric',
    lineFamilies: [
      { angle: 60, originX: 0, originY: 0, deltaX: 10, deltaY: 12, dashPattern: [7, -5] },
      { angle: -60, originX: 5, originY: 0, deltaX: 10, deltaY: 12, dashPattern: [7, -5] },
    ],
  },
];

/**
 * Get a built-in pattern by ID
 */
export function getBuiltinPattern(id: BuiltinPatternId): CustomHatchPattern | undefined {
  return BUILTIN_PATTERNS.find(p => p.id === id);
}

/**
 * Check if a pattern ID refers to a built-in pattern
 */
export function isBuiltinPatternId(id: string): id is BuiltinPatternId {
  return BUILTIN_PATTERNS.some(p => p.id === id);
}

/**
 * Hatch patterns store state for user and project patterns
 */
export interface HatchPatternsState {
  /** User-defined patterns (persistent across sessions) */
  userPatterns: CustomHatchPattern[];

  /** Project-specific patterns (saved with project file) */
  projectPatterns: CustomHatchPattern[];
}

/**
 * Default empty hatch patterns state
 */
export const DEFAULT_HATCH_PATTERNS_STATE: HatchPatternsState = {
  userPatterns: [],
  projectPatterns: [],
};
