/**
 * IFC4.0 Generator Service (ISO 16739-1:2018)
 *
 * Converts the application's shapes into IFC4 STEP physical file format
 * (ISO 10303-21). Generates a valid IFC4 file with proper spatial structure,
 * geometry representations, element types, materials, and property sets.
 *
 * Supported mappings:
 *   WallShape          -> IfcWall + IfcWallType + Pset_WallCommon + IfcMaterialLayerSetUsage
 *   BeamShape          -> IfcBeam + IfcBeamType + Pset_BeamCommon + IfcMaterial
 *   SlabShape          -> IfcSlab + IfcSlabType + Pset_SlabCommon + IfcMaterialLayerSetUsage
 *   GridlineShape      -> IfcGrid + IfcGridAxis
 *   LevelShape         -> IfcBuildingStorey + IfcAnnotation
 *   PileShape          -> IfcPile + Pset_PileCommon + IfcMaterial
 *   (Column beams)     -> IfcColumn
 *   LineShape          -> IfcAnnotation (Curve2D IfcPolyline)
 *   ArcShape           -> IfcAnnotation (Curve2D IfcTrimmedCurve)
 *   CircleShape        -> IfcAnnotation (Curve2D IfcCircle)
 *   PolylineShape      -> IfcAnnotation (Curve2D IfcPolyline)
 *   RectangleShape     -> IfcAnnotation (Curve2D IfcPolyline)
 *   DimensionShape     -> IfcAnnotation with dimension text
 *   TextShape          -> IfcAnnotation
 *   SectionCalloutShape -> IfcAnnotation
 */

import type {
  Shape,
  Drawing,
  WallShape,
  BeamShape,
  SlabShape,
  GridlineShape,
  LevelShape,
  PileShape,
  WallType,
  SlabType,
  Point,
  MaterialCategory,
  BeamMaterial,
  SlabMaterial,
  LineShape,
  ArcShape,
  CircleShape,
  PolylineShape,
  RectangleShape,
  TextShape,
  SectionCalloutShape,
} from '../../types/geometry';
import type { DimensionShape } from '../../types/dimension';
import type { ProjectStructure } from '../../state/slices/parametricSlice';

// ============================================================================
// Entity ID Counter
// ============================================================================

class IdCounter {
  private _next = 1;
  next(): number {
    return this._next++;
  }
  current(): number {
    return this._next - 1;
  }
}

// ============================================================================
// STEP Encoding Helpers
// ============================================================================

function stepString(s: string): string {
  // IFC STEP encodes strings in single quotes, with ' escaped as ''
  return "'" + s.replace(/'/g, "''") + "'";
}

function stepReal(n: number): string {
  // STEP requires a decimal point
  if (Number.isInteger(n)) return n.toFixed(1);
  return n.toString();
}

function stepBool(b: boolean): string {
  return b ? '.T.' : '.F.';
}

function stepEnum(s: string): string {
  // Ensure enum values have dots: .VALUE.
  if (s.startsWith('.') && s.endsWith('.')) return s;
  return `.${s}.`;
}

function stepRef(id: number): string {
  return `#${id}`;
}

function stepList(refs: number[]): string {
  return '(' + refs.map(stepRef).join(',') + ')';
}

function stepRealTuple(nums: number[]): string {
  return '(' + nums.map(stepReal).join(',') + ')';
}

function isoTimestamp(): string {
  return new Date().toISOString().slice(0, 19);
}

// ============================================================================
// Geometry Helpers
// ============================================================================

function lineLength(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function lineAngle(start: Point, end: Point): number {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

// ============================================================================
// IFC Entity Builder
// ============================================================================

interface IfcEntity {
  id: number;
  type: string;
  attrs: string;
}

class IfcBuilder {
  private entities: IfcEntity[] = [];
  private counter = new IdCounter();

  add(type: string, attrs: string): number {
    const id = this.counter.next();
    this.entities.push({ id, type, attrs });
    return id;
  }

  // -------------------------------------------------------------------------
  // Core project structure
  // -------------------------------------------------------------------------

  addCartesianPoint(x: number, y: number, z: number): number {
    return this.add('IFCCARTESIANPOINT', `(${stepRealTuple([x, y, z])})`);
  }

  addCartesianPoint2D(x: number, y: number): number {
    return this.add('IFCCARTESIANPOINT', `(${stepRealTuple([x, y])})`);
  }

  addDirection(x: number, y: number, z: number): number {
    return this.add('IFCDIRECTION', `(${stepRealTuple([x, y, z])})`);
  }

  addDirection2D(x: number, y: number): number {
    return this.add('IFCDIRECTION', `(${stepRealTuple([x, y])})`);
  }

  addAxis2Placement3D(location: number, axis?: number, refDir?: number): number {
    const axisRef = axis !== undefined ? stepRef(axis) : '$';
    const refDirRef = refDir !== undefined ? stepRef(refDir) : '$';
    return this.add('IFCAXIS2PLACEMENT3D', `(${stepRef(location)},${axisRef},${refDirRef})`);
  }

  addAxis2Placement2D(location: number, refDir?: number): number {
    const refDirRef = refDir !== undefined ? stepRef(refDir) : '$';
    return this.add('IFCAXIS2PLACEMENT2D', `(${stepRef(location)},${refDirRef})`);
  }

  addLocalPlacement(relativeTo: number | null, axis2: number): number {
    const rel = relativeTo !== null ? stepRef(relativeTo) : '$';
    return this.add('IFCLOCALPLACEMENT', `(${rel},${stepRef(axis2)})`);
  }

  addOwnerHistory(
    personOrgId: number,
    appId: number,
    changeAction: string = '.NOCHANGE.',
    creationDate: number = Math.floor(Date.now() / 1000)
  ): number {
    return this.add(
      'IFCOWNERHISTORY',
      `(${stepRef(personOrgId)},${stepRef(appId)},$,${changeAction},$,${stepRef(personOrgId)},${stepRef(appId)},${creationDate})`
    );
  }

  // -------------------------------------------------------------------------
  // Geometry representations
  // -------------------------------------------------------------------------

  addRectangleProfileDef(
    profileType: string,
    name: string | null,
    position: number,
    xDim: number,
    yDim: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCRECTANGLEPROFILEDEF',
      `(${profileType},${nameStr},${stepRef(position)},${stepReal(xDim)},${stepReal(yDim)})`
    );
  }

  addCircleProfileDef(
    profileType: string,
    name: string | null,
    position: number,
    radius: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCCIRCLEPROFILEDEF',
      `(${profileType},${nameStr},${stepRef(position)},${stepReal(radius)})`
    );
  }

  addArbitraryClosedProfileDef(
    profileType: string,
    name: string | null,
    outerCurve: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCARBITRARYCLOSEDPROFILEDEF',
      `(${profileType},${nameStr},${stepRef(outerCurve)})`
    );
  }

  addPolyline(points: number[]): number {
    return this.add('IFCPOLYLINE', `(${stepList(points)})`);
  }

  addExtrudedAreaSolid(
    profile: number,
    position: number,
    direction: number,
    depth: number
  ): number {
    return this.add(
      'IFCEXTRUDEDAREASOLID',
      `(${stepRef(profile)},${stepRef(position)},${stepRef(direction)},${stepReal(depth)})`
    );
  }

  addShapeRepresentation(
    contextId: number,
    repIdentifier: string,
    repType: string,
    items: number[]
  ): number {
    return this.add(
      'IFCSHAPEREPRESENTATION',
      `(${stepRef(contextId)},${stepString(repIdentifier)},${stepString(repType)},${stepList(items)})`
    );
  }

  addProductDefinitionShape(
    name: string | null,
    description: string | null,
    representations: number[]
  ): number {
    const nameStr = name ? stepString(name) : '$';
    const descStr = description ? stepString(description) : '$';
    return this.add(
      'IFCPRODUCTDEFINITIONSHAPE',
      `(${nameStr},${descStr},${stepList(representations)})`
    );
  }

  // -------------------------------------------------------------------------
  // Units
  // -------------------------------------------------------------------------

  addSIUnit(unitType: string, prefix: string | null, name: string): number {
    const prefixStr = prefix ? `.${prefix}.` : '$';
    return this.add('IFCSIUNIT', `(*,${unitType},${prefixStr},${name})`);
  }

  addMeasureWithUnit(valueComponent: string, unitComponent: number): number {
    return this.add(
      'IFCMEASUREWITHUNIT',
      `(${valueComponent},${stepRef(unitComponent)})`
    );
  }

  addConversionBasedUnit(
    dimensions: number,
    unitType: string,
    name: string,
    conversionFactor: number
  ): number {
    return this.add(
      'IFCCONVERSIONBASEDUNIT',
      `(${stepRef(dimensions)},${unitType},${stepString(name)},${stepRef(conversionFactor)})`
    );
  }

  addDimensionalExponents(
    length: number, mass: number, time: number,
    electricCurrent: number, thermodynamicTemperature: number,
    amountOfSubstance: number, luminousIntensity: number
  ): number {
    return this.add(
      'IFCDIMENSIONALEXPONENTS',
      `(${length},${mass},${time},${electricCurrent},${thermodynamicTemperature},${amountOfSubstance},${luminousIntensity})`
    );
  }

  addUnitAssignment(units: number[]): number {
    return this.add('IFCUNITASSIGNMENT', `(${stepList(units)})`);
  }

  // -------------------------------------------------------------------------
  // Spatial elements
  // -------------------------------------------------------------------------

  addProject(
    globalId: string,
    ownerHistory: number,
    name: string,
    units: number,
    repContexts: number[]
  ): number {
    return this.add(
      'IFCPROJECT',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,$,$,${stepList(repContexts)},${stepRef(units)})`
    );
  }

  addSite(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number
  ): number {
    return this.add(
      'IFCSITE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},$,$,.ELEMENT.,$,$,$,$,$)`
    );
  }

  addBuilding(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number
  ): number {
    return this.add(
      'IFCBUILDING',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},$,$,.ELEMENT.,$,$,$)`
    );
  }

  addBuildingStorey(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    elevation: number
  ): number {
    return this.add(
      'IFCBUILDINGSTOREY',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},$,$,.ELEMENT.,${stepReal(elevation)})`
    );
  }

  addRelAggregates(
    globalId: string,
    ownerHistory: number,
    name: string | null,
    relating: number,
    related: number[]
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCRELAGGREGATES',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${nameStr},$,${stepRef(relating)},${stepList(related)})`
    );
  }

  addRelContainedInSpatialStructure(
    globalId: string,
    ownerHistory: number,
    name: string | null,
    elements: number[],
    structure: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCRELCONTAINEDINSPATIALSTRUCTURE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${nameStr},$,${stepList(elements)},${stepRef(structure)})`
    );
  }

  // -------------------------------------------------------------------------
  // Building elements
  // -------------------------------------------------------------------------

  addWall(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    representation: number
  ): number {
    return this.add(
      'IFCWALL',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},${stepRef(representation)},$,$)`
    );
  }

  addBeam(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    representation: number
  ): number {
    return this.add(
      'IFCBEAM',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},${stepRef(representation)},$,$)`
    );
  }

  addColumn(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    representation: number
  ): number {
    return this.add(
      'IFCCOLUMN',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},${stepRef(representation)},$,$)`
    );
  }

  addSlab(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    representation: number
  ): number {
    return this.add(
      'IFCSLAB',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},${stepRef(representation)},$,$)`
    );
  }

  addPile(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    representation: number
  ): number {
    return this.add(
      'IFCPILE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},${stepRef(representation)},$,$,$)`
    );
  }

  addGrid(
    globalId: string,
    ownerHistory: number,
    name: string,
    placement: number,
    representation: number | null,
    uAxes: number[],
    vAxes: number[]
  ): number {
    const repStr = representation !== null ? stepRef(representation) : '$';
    return this.add(
      'IFCGRID',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,${stepRef(placement)},${repStr},$,${stepList(uAxes)},${stepList(vAxes)},$)`
    );
  }

  addGridAxis(
    tag: string,
    curve: number,
    sameSense: boolean
  ): number {
    return this.add(
      'IFCGRIDAXIS',
      `(${stepString(tag)},${stepRef(curve)},${stepBool(sameSense)})`
    );
  }

  addGeometricCurveSet(elements: number[]): number {
    return this.add('IFCGEOMETRICCURVESET', `(${stepList(elements)})`);
  }

  addAnnotation(
    globalId: string,
    ownerHistory: number,
    name: string,
    description: string | null,
    placement: number,
    representation: number | null
  ): number {
    const descStr = description ? stepString(description) : '$';
    const repStr = representation !== null ? stepRef(representation) : '$';
    return this.add(
      'IFCANNOTATION',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},${descStr},$,${stepRef(placement)},${repStr})`
    );
  }

  addCircleGeom(
    position: number,
    radius: number
  ): number {
    return this.add(
      'IFCCIRCLE',
      `(${stepRef(position)},${stepReal(radius)})`
    );
  }

  addTrimmedCurve(
    basisCurve: number,
    trim1: string,
    trim2: string,
    senseAgreement: boolean,
    masterRepresentation: string
  ): number {
    return this.add(
      'IFCTRIMMEDCURVE',
      `(${stepRef(basisCurve)},(${trim1}),(${trim2}),${stepBool(senseAgreement)},${masterRepresentation})`
    );
  }

  // -------------------------------------------------------------------------
  // Type objects
  // -------------------------------------------------------------------------

  addWallType(
    globalId: string,
    ownerHistory: number,
    name: string
  ): number {
    return this.add(
      'IFCWALLTYPE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,$,$,$,$,.STANDARD.)`
    );
  }

  addBeamType(
    globalId: string,
    ownerHistory: number,
    name: string
  ): number {
    return this.add(
      'IFCBEAMTYPE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,$,$,$,$,.BEAM.)`
    );
  }

  addSlabType(
    globalId: string,
    ownerHistory: number,
    name: string
  ): number {
    return this.add(
      'IFCSLABTYPE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},$,$,$,$,$,$,.FLOOR.)`
    );
  }

  addRelDefinesByType(
    globalId: string,
    ownerHistory: number,
    name: string | null,
    relatedObjects: number[],
    relatingType: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCRELDEFINESBYTYPE',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${nameStr},$,${stepList(relatedObjects)},${stepRef(relatingType)})`
    );
  }

  // -------------------------------------------------------------------------
  // Materials
  // -------------------------------------------------------------------------

  addMaterial(name: string, description?: string, category?: string): number {
    const descStr = description ? stepString(description) : '$';
    const catStr = category ? stepString(category) : '$';
    return this.add(
      'IFCMATERIAL',
      `(${stepString(name)},${descStr},${catStr})`
    );
  }

  addMaterialLayer(
    material: number | null,
    layerThickness: number,
    isVentilated: string | null,
    name?: string,
    description?: string,
    category?: string
  ): number {
    const matStr = material !== null ? stepRef(material) : '$';
    const ventStr = isVentilated !== null ? stepEnum(isVentilated) : '.FALSE.';
    const nameStr = name ? stepString(name) : '$';
    const descStr = description ? stepString(description) : '$';
    const catStr = category ? stepString(category) : '$';
    return this.add(
      'IFCMATERIALLAYER',
      `(${matStr},${stepReal(layerThickness)},${ventStr},${nameStr},${descStr},${catStr},0)`
    );
  }

  addMaterialLayerSet(
    layers: number[],
    layerSetName: string | null
  ): number {
    const nameStr = layerSetName ? stepString(layerSetName) : '$';
    return this.add(
      'IFCMATERIALLAYERSET',
      `(${stepList(layers)},${nameStr},$)`
    );
  }

  addMaterialLayerSetUsage(
    layerSet: number,
    layerSetDirection: string,
    directionSense: string,
    offsetFromReferenceLine: number
  ): number {
    return this.add(
      'IFCMATERIALLAYERSETUSAGE',
      `(${stepRef(layerSet)},${stepEnum(layerSetDirection)},${stepEnum(directionSense)},${stepReal(offsetFromReferenceLine)},$)`
    );
  }

  addRelAssociatesMaterial(
    globalId: string,
    ownerHistory: number,
    name: string | null,
    relatedObjects: number[],
    relatingMaterial: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCRELASSOCIATESMATERIAL',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${nameStr},$,${stepList(relatedObjects)},${stepRef(relatingMaterial)})`
    );
  }

  // -------------------------------------------------------------------------
  // Property Sets
  // -------------------------------------------------------------------------

  addPropertySingleValue(
    name: string,
    description: string | null,
    nominalValue: string,
    unit: number | null
  ): number {
    const descStr = description ? stepString(description) : '$';
    const unitStr = unit !== null ? stepRef(unit) : '$';
    return this.add(
      'IFCPROPERTYSINGLEVALUE',
      `(${stepString(name)},${descStr},${nominalValue},${unitStr})`
    );
  }

  addPropertySet(
    globalId: string,
    ownerHistory: number,
    name: string,
    description: string | null,
    properties: number[]
  ): number {
    const descStr = description ? stepString(description) : '$';
    return this.add(
      'IFCPROPERTYSET',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${stepString(name)},${descStr},${stepList(properties)})`
    );
  }

  addRelDefinesByProperties(
    globalId: string,
    ownerHistory: number,
    name: string | null,
    relatedObjects: number[],
    relatingPropertyDefinition: number
  ): number {
    const nameStr = name ? stepString(name) : '$';
    return this.add(
      'IFCRELDEFINESBYPROPERTIES',
      `(${stepString(globalId)},${stepRef(ownerHistory)},${nameStr},$,${stepList(relatedObjects)},${stepRef(relatingPropertyDefinition)})`
    );
  }

  // -------------------------------------------------------------------------
  // Context
  // -------------------------------------------------------------------------

  addGeometricRepresentationContext(
    identifier: string | null,
    contextType: string,
    dim: number,
    precision: number,
    worldCoordSystem: number,
    trueNorth: number | null
  ): number {
    const idStr = identifier ? stepString(identifier) : '$';
    const tnStr = trueNorth !== null ? stepRef(trueNorth) : '$';
    return this.add(
      'IFCGEOMETRICREPRESENTATIONCONTEXT',
      `(${idStr},${stepString(contextType)},${dim},${stepReal(precision)},${stepRef(worldCoordSystem)},${tnStr})`
    );
  }

  addGeometricRepresentationSubContext(
    identifier: string,
    contextType: string,
    parentContext: number,
    targetView: string
  ): number {
    return this.add(
      'IFCGEOMETRICREPRESENTATIONSUBCONTEXT',
      `(${stepString(identifier)},${stepString(contextType)},*,*,*,*,${stepRef(parentContext)},$,$,$,${targetView})`
    );
  }

  // -------------------------------------------------------------------------
  // Person / Organization / Application
  // -------------------------------------------------------------------------

  addPerson(familyName: string): number {
    return this.add('IFCPERSON', `($,${stepString(familyName)},$,$,$,$,$,$)`);
  }

  addOrganization(name: string): number {
    return this.add('IFCORGANIZATION', `($,${stepString(name)},$,$,$)`);
  }

  addPersonAndOrganization(person: number, org: number): number {
    return this.add('IFCPERSONANDORGANIZATION', `(${stepRef(person)},${stepRef(org)},$)`);
  }

  addApplication(org: number, version: string, fullName: string, identifier: string): number {
    return this.add(
      'IFCAPPLICATION',
      `(${stepRef(org)},${stepString(version)},${stepString(fullName)},${stepString(identifier)})`
    );
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  getEntities(): IfcEntity[] {
    return this.entities;
  }

  getEntityCount(): number {
    return this.entities.length;
  }

  serialize(): string {
    const lines: string[] = [];
    for (const e of this.entities) {
      lines.push(`${stepRef(e.id)}=${e.type}${e.attrs};`);
    }
    return lines.join('\n');
  }
}

// ============================================================================
// GUID Generator (IFC GloballyUniqueId: 22-character base64 encoding)
// ============================================================================

const BASE64_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

function generateIfcGuid(): string {
  // Generate 22-character IFC-compatible GUID
  let result = '';
  for (let i = 0; i < 22; i++) {
    result += BASE64_CHARS[Math.floor(Math.random() * 64)];
  }
  return result;
}

// Deterministic GUID from shape ID (so the same shape always gets the same GUID)
function shapeToIfcGuid(shapeId: string, suffix: string = ''): string {
  const input = shapeId + suffix;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  // Generate a deterministic 22-char string from the hash
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
// IFC Value Helpers
// ============================================================================

/** Format an IfcLabel value */
function ifcLabel(s: string): string {
  return `IFCLABEL(${stepString(s)})`;
}

/** Format an IfcBoolean value */
function ifcBoolean(b: boolean): string {
  return `IFCBOOLEAN(${stepBool(b)})`;
}

/** Format an IfcIdentifier value */
function ifcIdentifier(s: string): string {
  return `IFCIDENTIFIER(${stepString(s)})`;
}

/** Format an IfcLengthMeasure value */
function ifcLengthMeasure(n: number): string {
  return `IFCLENGTHMEASURE(${stepReal(n)})`;
}

/** Format an IfcPositiveLengthMeasure value */
function ifcPositiveLengthMeasure(n: number): string {
  return `IFCPOSITIVELENGTHMEASURE(${stepReal(n)})`;
}

/** Format an IfcAreaMeasure value */
function ifcAreaMeasure(n: number): string {
  return `IFCAREAMEASURE(${stepReal(n)})`;
}

/** Format an IfcVolumeMeasure value */
function ifcVolumeMeasure(n: number): string {
  return `IFCVOLUMEMEASURE(${stepReal(n)})`;
}

// ============================================================================
// Material Name Resolver
// ============================================================================

function getMaterialDisplayName(material: MaterialCategory | BeamMaterial | SlabMaterial): string {
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

function getMaterialCategory(material: MaterialCategory | BeamMaterial | SlabMaterial): string {
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

// ============================================================================
// IFC Generation Result
// ============================================================================

export interface IfcGenerationResult {
  content: string;
  entityCount: number;
  fileSize: number;
}

// ============================================================================
// Main Generator Function
// ============================================================================

export function generateIFC(
  shapes: Shape[],
  wallTypes: WallType[],
  slabTypes: SlabType[],
  projectStructure?: ProjectStructure,
  drawings?: Drawing[]
): IfcGenerationResult {
  const b = new IfcBuilder();

  // -------------------------------------------------------------------------
  // 1. Person, Organization, Application, OwnerHistory
  // -------------------------------------------------------------------------
  const personId = b.addPerson('User');
  const orgId = b.addOrganization('Open nD Studio');
  const personOrgId = b.addPersonAndOrganization(personId, orgId);
  const appOrgId = b.addOrganization('Open nD Studio');
  const appId = b.addApplication(appOrgId, '1.0', 'Open nD Studio', 'OpenNDStudio');
  const ownerHistoryId = b.addOwnerHistory(personOrgId, appId, '.NOCHANGE.');

  // -------------------------------------------------------------------------
  // 2. Units (millimeters for length, with degree angle support)
  // -------------------------------------------------------------------------
  const lengthUnit = b.addSIUnit('.LENGTHUNIT.', 'MILLI', '.METRE.');
  const areaUnit = b.addSIUnit('.AREAUNIT.', null, '.SQUARE_METRE.');
  const volumeUnit = b.addSIUnit('.VOLUMEUNIT.', null, '.CUBIC_METRE.');
  const solidAngleUnit = b.addSIUnit('.SOLIDANGLEUNIT.', null, '.STERADIAN.');
  const planeAngleUnit = b.addSIUnit('.PLANEANGLEUNIT.', null, '.RADIAN.');

  // Conversion-based unit for degrees
  const angleDimExponents = b.addDimensionalExponents(0, 0, 0, 0, 0, 0, 0);
  const degreeConversion = b.addMeasureWithUnit(
    `IFCPLANEANGLEMEASURE(${stepReal(Math.PI / 180)})`,
    planeAngleUnit
  );
  const degreeUnit = b.addConversionBasedUnit(
    angleDimExponents, '.PLANEANGLEUNIT.', 'DEGREE', degreeConversion
  );

  const unitAssignment = b.addUnitAssignment([
    lengthUnit, areaUnit, volumeUnit, solidAngleUnit, planeAngleUnit, degreeUnit
  ]);

  // -------------------------------------------------------------------------
  // 3. Geometric context
  // -------------------------------------------------------------------------
  const originPt = b.addCartesianPoint(0, 0, 0);
  const zDir = b.addDirection(0, 0, 1);
  const xDir = b.addDirection(1, 0, 0);
  const worldCoord = b.addAxis2Placement3D(originPt, zDir, xDir);

  const trueNorthDir = b.addDirection(0, 1, 0);
  const geomContext = b.addGeometricRepresentationContext(
    null, 'Model', 3, 1e-5, worldCoord, trueNorthDir
  );
  const bodySubContext = b.addGeometricRepresentationSubContext(
    'Body', 'Model', geomContext, '.MODEL_VIEW.'
  );
  const axisSubContext = b.addGeometricRepresentationSubContext(
    'Axis', 'Model', geomContext, '.GRAPH_VIEW.'
  );

  // -------------------------------------------------------------------------
  // 4. Project
  // -------------------------------------------------------------------------
  const projectId = b.addProject(
    generateIfcGuid(), ownerHistoryId, 'Open nD Studio Project',
    unitAssignment, [geomContext]
  );

  // -------------------------------------------------------------------------
  // 5. Spatial structure: Site -> Building(s) -> Storey(s)
  //    Uses projectStructure when provided; falls back to defaults.
  // -------------------------------------------------------------------------
  const siteName = projectStructure?.siteName || 'Default Site';
  const sitePlacement = b.addLocalPlacement(null, worldCoord);
  const siteId = b.addSite(generateIfcGuid(), ownerHistoryId, siteName, sitePlacement);

  // Aggregate Site into Project
  b.addRelAggregates(generateIfcGuid(), ownerHistoryId, 'ProjectContainer', projectId, [siteId]);

  // Build building(s) from project structure
  const psBuildings = projectStructure?.buildings ?? [
    { id: 'default-building', name: 'Default Building', storeys: [] },
  ];

  const buildingIds: number[] = [];
  // Map from building id -> { buildingPlacement, storeyIds, defaultStoreyId }
  const buildingInfoMap = new Map<string, {
    buildingPlacement: number;
    storeyIds: number[];
    defaultStoreyId: number;
  }>();

  for (const psBuilding of psBuildings) {
    const buildingAxisPlace = b.addAxis2Placement3D(originPt, zDir, xDir);
    const buildingPlacement = b.addLocalPlacement(sitePlacement, buildingAxisPlace);
    const buildingId = b.addBuilding(generateIfcGuid(), ownerHistoryId, psBuilding.name, buildingPlacement);
    buildingIds.push(buildingId);

    // Create storeys from project structure
    const psBuildingStoreyIds: number[] = [];
    let defaultStoreyIdForBuilding: number | undefined;
    let closestElevation = Infinity;

    if (psBuilding.storeys.length > 0) {
      for (const psStorey of psBuilding.storeys) {
        const storeyAxisPlace = b.addAxis2Placement3D(
          b.addCartesianPoint(0, 0, psStorey.elevation),
          zDir, xDir
        );
        const storeyPlacement = b.addLocalPlacement(buildingPlacement, storeyAxisPlace);
        const storeyEntityId = b.addBuildingStorey(
          shapeToIfcGuid(psStorey.id),
          ownerHistoryId,
          psStorey.name,
          storeyPlacement,
          psStorey.elevation
        );
        psBuildingStoreyIds.push(storeyEntityId);
        // Use the storey closest to elevation 0 as default for element containment
        if (Math.abs(psStorey.elevation) < closestElevation) {
          closestElevation = Math.abs(psStorey.elevation);
          defaultStoreyIdForBuilding = storeyEntityId;
        }
      }
    }

    // If no storeys defined, create a default ground floor
    if (psBuildingStoreyIds.length === 0) {
      const defaultStoreyAxisPlace = b.addAxis2Placement3D(originPt, zDir, xDir);
      const defaultStoreyPlacement = b.addLocalPlacement(buildingPlacement, defaultStoreyAxisPlace);
      const defaultStoreyId = b.addBuildingStorey(
        generateIfcGuid(), ownerHistoryId, 'Ground Floor',
        defaultStoreyPlacement, 0
      );
      psBuildingStoreyIds.push(defaultStoreyId);
      defaultStoreyIdForBuilding = defaultStoreyId;
    }

    // Aggregate storeys into building
    b.addRelAggregates(generateIfcGuid(), ownerHistoryId, 'BuildingContainer', buildingId, psBuildingStoreyIds);

    buildingInfoMap.set(psBuilding.id, {
      buildingPlacement,
      storeyIds: psBuildingStoreyIds,
      defaultStoreyId: defaultStoreyIdForBuilding!,
    });
  }

  // Aggregate all buildings into Site
  b.addRelAggregates(generateIfcGuid(), ownerHistoryId, 'SiteContainer', siteId, buildingIds);

  // Pick the first building's default storey for element containment
  const firstBuildingInfo = buildingInfoMap.values().next().value!;
  const defaultStoreyId = firstBuildingInfo.defaultStoreyId;
  const buildingPlacement = firstBuildingInfo.buildingPlacement;

  // -------------------------------------------------------------------------
  // 6. Create additional storeys from LevelShapes (supplement project structure)
  // -------------------------------------------------------------------------
  const levels = shapes.filter((s): s is LevelShape => s.type === 'level' && !s.id.startsWith('section-ref-'));
  const storeyMap = new Map<string, number>(); // shape id -> IFC entity id

  if (levels.length > 0) {
    const additionalStoreyIds: number[] = [];
    for (const level of levels) {
      const storeyAxisPlace = b.addAxis2Placement3D(
        b.addCartesianPoint(0, 0, level.elevation),
        zDir, xDir
      );
      const storeyPlacement = b.addLocalPlacement(buildingPlacement, storeyAxisPlace);
      const storeyEntityId = b.addBuildingStorey(
        shapeToIfcGuid(level.id),
        ownerHistoryId,
        level.label || `Level ${level.elevation}`,
        storeyPlacement,
        level.elevation
      );
      additionalStoreyIds.push(storeyEntityId);
      storeyMap.set(level.id, storeyEntityId);
    }
    // Aggregate level-based storeys into the first building
    if (additionalStoreyIds.length > 0 && buildingIds.length > 0) {
      b.addRelAggregates(
        generateIfcGuid(), ownerHistoryId, 'LevelStoreys',
        buildingIds[0], additionalStoreyIds
      );
    }
  }

  // Use defaultStoreyPlacement for element placement
  const defaultStoreyPlacement = (() => {
    const pt = b.addCartesianPoint(0, 0, 0);
    const ax = b.addAxis2Placement3D(pt, zDir, xDir);
    return b.addLocalPlacement(buildingPlacement, ax);
  })();

  // -------------------------------------------------------------------------
  // 6b. Drawing type resolution: map drawingId -> DrawingType + storeyId
  //     Plan drawings: assign elements to the linked IfcBuildingStorey
  //     Section drawings: add section metadata property set
  //     Standalone drawings: default behavior (IfcAnnotation for non-structural)
  // -------------------------------------------------------------------------
  const drawingMap = new Map<string, Drawing>();
  if (drawings) {
    for (const d of drawings) {
      drawingMap.set(d.id, d);
    }
  }

  /**
   * Resolve the IFC storey entity ID for a shape based on its drawing type.
   * Plan drawings with a storeyId get routed to the matching project structure storey.
   * Falls back to defaultStoreyId.
   */
  function resolveStoreyForShape(shape: Shape): number {
    const drawing = drawingMap.get(shape.drawingId);
    if (drawing?.drawingType === 'plan' && drawing.storeyId) {
      // Look up the storey entity ID from the project structure
      for (const psBuilding of psBuildings) {
        const psStorey = psBuilding.storeys.find(s => s.id === drawing.storeyId);
        if (psStorey) {
          // Find the IFC storey entity by name from the building info
          const buildingInfo = buildingInfoMap.get(psBuilding.id);
          if (buildingInfo) {
            // The storey entities were created in order; match by storey index
            const storeyIndex = psBuilding.storeys.indexOf(psStorey);
            if (storeyIndex >= 0 && storeyIndex < buildingInfo.storeyIds.length) {
              return buildingInfo.storeyIds[storeyIndex];
            }
          }
        }
      }
    }
    return defaultStoreyId;
  }

  /**
   * Check if a shape belongs to a plan drawing (for grid export as IfcGrid)
   */
  function isShapeInPlanDrawing(shape: Shape): boolean {
    const drawing = drawingMap.get(shape.drawingId);
    return drawing?.drawingType === 'plan';
  }

  /**
   * Check if a shape belongs to a section drawing
   */
  function isShapeInSectionDrawing(shape: Shape): boolean {
    const drawing = drawingMap.get(shape.drawingId);
    return drawing?.drawingType === 'section';
  }

  // Track elements by their target storey for containment
  const storeyElementsMap = new Map<number, number[]>();

  function addElementToStorey(elementId: number, storeyId: number) {
    const existing = storeyElementsMap.get(storeyId) || [];
    existing.push(elementId);
    storeyElementsMap.set(storeyId, existing);
  }

  // -------------------------------------------------------------------------
  // 7. Materials cache - create IfcMaterial entities on demand
  // -------------------------------------------------------------------------
  const materialCache = new Map<string, number>();  // material name -> IfcMaterial entity id

  function getOrCreateMaterial(matKey: MaterialCategory | BeamMaterial | SlabMaterial): number {
    const displayName = getMaterialDisplayName(matKey);
    if (materialCache.has(displayName)) {
      return materialCache.get(displayName)!;
    }
    const category = getMaterialCategory(matKey);
    const matId = b.addMaterial(displayName, undefined, category);
    materialCache.set(displayName, matId);
    return matId;
  }

  // -------------------------------------------------------------------------
  // 8. Helper: create element placement relative to storey
  // -------------------------------------------------------------------------
  function createElementPlacement(
    startX: number, startY: number, startZ: number,
    angle: number
  ): number {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const pt = b.addCartesianPoint(startX, startY, startZ);
    const dir = b.addDirection(cosA, sinA, 0);
    const axis = b.addAxis2Placement3D(pt, zDir, dir);
    return b.addLocalPlacement(defaultStoreyPlacement, axis);
  }

  // -------------------------------------------------------------------------
  // 9. Process structural shapes
  // -------------------------------------------------------------------------
  const elementIds: number[] = []; // fallback: elements to contain in default storey (when no drawing-type routing)

  // Shared 2D origin for profiles
  const origin2D = b.addCartesianPoint2D(0, 0);
  const profilePlacement2D = b.addAxis2Placement2D(origin2D);

  // Extrusion direction (along Z)
  const extrusionDir = b.addDirection(0, 0, 1);

  // Shared identity placement for extrusion position
  const identityPlacement = b.addAxis2Placement3D(originPt, zDir, xDir);

  // ----- Tracking arrays for material associations -----
  // { elementIds, materialEntityId } for IfcRelAssociatesMaterial with single IfcMaterial
  const materialAssociations: { elementIds: number[]; materialId: number }[] = [];
  // { elementIds, layerSetUsageId } for IfcRelAssociatesMaterial with IfcMaterialLayerSetUsage
  const layerSetUsageAssociations: { elementIds: number[]; usageId: number }[] = [];

  // ----- Tracking arrays for property set assignments -----
  const propertySetAssignments: { elementIds: number[]; psetId: number }[] = [];

  // ----- Wall Types mapping -----
  const wallTypeIfcMap = new Map<string, number>();
  const wallTypeElements = new Map<string, number[]>();

  for (const wt of wallTypes) {
    const wtId = b.addWallType(shapeToIfcGuid(wt.id, 'wt'), ownerHistoryId, `${wt.name} ${wt.thickness}mm`);
    wallTypeIfcMap.set(wt.id, wtId);
    wallTypeElements.set(wt.id, []);
  }

  // ----- Slab Types mapping -----
  const slabTypeIfcMap = new Map<string, number>();
  const slabTypeElements = new Map<string, number[]>();

  for (const st of slabTypes) {
    const stId = b.addSlabType(shapeToIfcGuid(st.id, 'st'), ownerHistoryId, `${st.name} ${st.thickness}mm`);
    slabTypeIfcMap.set(st.id, stId);
    slabTypeElements.set(st.id, []);
  }

  // ----- Beam types (dynamic, by profile) -----
  const beamTypeIfcMap = new Map<string, number>();
  const beamTypeElements = new Map<string, number[]>();

  // ----- Gridlines (collect for IfcGrid) -----
  const gridlineAxes: { axis: number; curve: number; shape: GridlineShape }[] = [];

  // Filter out section-reference shapes (they are derived from plan shapes and would create duplicates)
  const exportShapes = shapes.filter(s => !s.id.startsWith('section-ref-'));

  // Process each shape
  for (const shape of exportShapes) {
    switch (shape.type) {
      case 'wall': {
        const wall = shape as WallShape;
        const length = lineLength(wall.start, wall.end);
        if (length < 0.001) continue;
        const angle = lineAngle(wall.start, wall.end);

        // Wall height (default 3000mm if not specified)
        const wallHeight = 3000;

        // ----- Axis representation (centerline) -----
        // Wall axis runs along the local X-axis from origin to (length,0,0)
        const axisStartPt = b.addCartesianPoint(0, 0, 0);
        const axisEndPt = b.addCartesianPoint(length, 0, 0);
        const axisPolyline = b.addPolyline([axisStartPt, axisEndPt]);
        const axisShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Axis', 'Curve2D', [axisPolyline]
        );

        // ----- Body representation -----
        // Wall footprint in the element's local XY plane, extruded upward along Z.
        //
        // Element local coords: X = wall direction, Y = perpendicular, Z = up.
        // IFCRECTANGLEPROFILEDEF is centered on its placement point.
        // Place center at (length/2, 0) so the rectangle spans x=[0..length], y=[-t/2..t/2].
        // Extrude along Z (up) for wallHeight.
        const wallProfileCenter = b.addCartesianPoint2D(length / 2, 0);
        const wallProfilePlacement = b.addAxis2Placement2D(wallProfileCenter);
        const wallProfile = b.addRectangleProfileDef(
          '.AREA.', null, wallProfilePlacement,
          length, wall.thickness
        );

        const wallSolid = b.addExtrudedAreaSolid(
          wallProfile, identityPlacement, extrusionDir, wallHeight
        );

        const bodyShapeRep = b.addShapeRepresentation(
          bodySubContext, 'Body', 'SweptSolid', [wallSolid]
        );
        const wallProdShape = b.addProductDefinitionShape(null, null, [axisShapeRep, bodyShapeRep]);

        // Placement: at wall start point, rotated along wall direction
        const placement = createElementPlacement(wall.start.x, wall.start.y, 0, angle);

        // Create IfcWall
        const wallEntityId = b.addWall(
          shapeToIfcGuid(wall.id),
          ownerHistoryId,
          wall.label || 'Wall',
          placement,
          wallProdShape
        );
        addElementToStorey(wallEntityId, resolveStoreyForShape(wall));

        // Track for type assignment
        if (wall.wallTypeId && wallTypeElements.has(wall.wallTypeId)) {
          wallTypeElements.get(wall.wallTypeId)!.push(wallEntityId);
        }

        // ----- Material Layer Set Usage for wall -----
        // Determine material from wall type or default
        const wallType = wall.wallTypeId
          ? wallTypes.find(wt => wt.id === wall.wallTypeId)
          : undefined;
        const wallMaterialKey: MaterialCategory = wallType?.material || 'concrete';
        const wallMatId = getOrCreateMaterial(wallMaterialKey);

        const wallLayer = b.addMaterialLayer(wallMatId, wall.thickness, null, 'Wall Layer');
        const wallLayerSet = b.addMaterialLayerSet([wallLayer], `${wall.label || 'Wall'} LayerSet`);
        // Offset from reference line: for centered walls, offset = -thickness/2
        const wallOffset = wall.justification === 'center' ? -wall.thickness / 2
          : wall.justification === 'left' ? -wall.thickness
            : 0;
        const wallLayerSetUsage = b.addMaterialLayerSetUsage(
          wallLayerSet, 'AXIS2', 'POSITIVE', wallOffset
        );
        layerSetUsageAssociations.push({ elementIds: [wallEntityId], usageId: wallLayerSetUsage });

        // ----- Property Set: Pset_WallCommon -----
        const wallProps: number[] = [];
        wallProps.push(b.addPropertySingleValue('Reference', null, ifcIdentifier(wall.label || 'Wall'), null));
        wallProps.push(b.addPropertySingleValue('IsExternal', null, ifcBoolean(true), null));
        wallProps.push(b.addPropertySingleValue('LoadBearing', null, ifcBoolean(true), null));
        wallProps.push(b.addPropertySingleValue('ExtendToStructure', null, ifcBoolean(false), null));
        const wallPset = b.addPropertySet(
          shapeToIfcGuid(wall.id, 'pset'),
          ownerHistoryId,
          'Pset_WallCommon',
          'Common wall properties',
          wallProps
        );
        propertySetAssignments.push({ elementIds: [wallEntityId], psetId: wallPset });

        // ----- Quantity Set: Qto_WallBaseQuantities -----
        const wallQProps: number[] = [];
        wallQProps.push(b.addPropertySingleValue('Length', null, ifcLengthMeasure(length), lengthUnit));
        wallQProps.push(b.addPropertySingleValue('Width', null, ifcPositiveLengthMeasure(wall.thickness), lengthUnit));
        wallQProps.push(b.addPropertySingleValue('Height', null, ifcPositiveLengthMeasure(wallHeight), lengthUnit));
        wallQProps.push(b.addPropertySingleValue('GrossVolume', null, ifcVolumeMeasure(length * wall.thickness * wallHeight / 1e9), volumeUnit));
        wallQProps.push(b.addPropertySingleValue('GrossSideArea', null, ifcAreaMeasure(length * wallHeight / 1e6), areaUnit));
        const wallQset = b.addPropertySet(
          shapeToIfcGuid(wall.id, 'qto'),
          ownerHistoryId,
          'Qto_WallBaseQuantities',
          'Wall base quantities',
          wallQProps
        );
        propertySetAssignments.push({ elementIds: [wallEntityId], psetId: wallQset });

        break;
      }

      case 'beam': {
        const beam = shape as BeamShape;
        const length = lineLength(beam.start, beam.end);
        if (length < 0.001) continue;
        const angle = lineAngle(beam.start, beam.end);

        // Determine profile dimensions
        const flangeWidth = beam.flangeWidth || 200;
        const depth = (beam.profileParameters?.depth as number) || (beam.profileParameters?.h as number) || flangeWidth;

        // ----- Axis representation (beam centerline) -----
        const beamAxisStart = b.addCartesianPoint(0, 0, 0);
        const beamAxisEnd = b.addCartesianPoint(0, 0, length);
        const beamAxisPolyline = b.addPolyline([beamAxisStart, beamAxisEnd]);
        const beamAxisRep = b.addShapeRepresentation(
          axisSubContext, 'Axis', 'Curve2D', [beamAxisPolyline]
        );

        // ----- Body representation -----
        // Profile: rectangle representing beam cross-section
        const beamProfile = b.addRectangleProfileDef(
          '.AREA.', null, profilePlacement2D,
          flangeWidth, depth
        );

        // Extrude along beam length
        const beamSolid = b.addExtrudedAreaSolid(
          beamProfile, identityPlacement, extrusionDir, length
        );

        const beamBodyRep = b.addShapeRepresentation(
          bodySubContext, 'Body', 'SweptSolid', [beamSolid]
        );
        const beamProdShape = b.addProductDefinitionShape(null, null, [beamAxisRep, beamBodyRep]);

        const placement = createElementPlacement(beam.start.x, beam.start.y, 0, angle);

        // Determine element name
        const beamName = beam.labelText || beam.presetName || 'Beam';

        // Use IfcColumn for vertical / section-view beams, IfcBeam otherwise
        const isColumn = beam.viewMode === 'section';
        const beamEntityId = isColumn
          ? b.addColumn(shapeToIfcGuid(beam.id), ownerHistoryId, beamName, placement, beamProdShape)
          : b.addBeam(shapeToIfcGuid(beam.id), ownerHistoryId, beamName, placement, beamProdShape);

        addElementToStorey(beamEntityId, resolveStoreyForShape(beam));

        // Track beam type by profile
        const typeKey = beam.presetId || beam.profileType || 'default-beam';
        if (!beamTypeIfcMap.has(typeKey)) {
          const btId = b.addBeamType(
            shapeToIfcGuid(typeKey, 'bt'),
            ownerHistoryId,
            beam.presetName || beam.profileType || 'Beam'
          );
          beamTypeIfcMap.set(typeKey, btId);
          beamTypeElements.set(typeKey, []);
        }
        beamTypeElements.get(typeKey)!.push(beamEntityId);

        // ----- Material assignment for beam -----
        const beamMatId = getOrCreateMaterial(beam.material);
        materialAssociations.push({ elementIds: [beamEntityId], materialId: beamMatId });

        // ----- Property Set: Pset_BeamCommon -----
        const beamProps: number[] = [];
        beamProps.push(b.addPropertySingleValue('Reference', null, ifcIdentifier(beamName), null));
        beamProps.push(b.addPropertySingleValue('IsExternal', null, ifcBoolean(false), null));
        beamProps.push(b.addPropertySingleValue('LoadBearing', null, ifcBoolean(true), null));
        beamProps.push(b.addPropertySingleValue('Span', null, ifcPositiveLengthMeasure(length), lengthUnit));
        const beamPset = b.addPropertySet(
          shapeToIfcGuid(beam.id, 'pset'),
          ownerHistoryId,
          isColumn ? 'Pset_ColumnCommon' : 'Pset_BeamCommon',
          isColumn ? 'Common column properties' : 'Common beam properties',
          beamProps
        );
        propertySetAssignments.push({ elementIds: [beamEntityId], psetId: beamPset });

        // ----- Custom property set for profile dimensions -----
        const beamDimProps: number[] = [];
        beamDimProps.push(b.addPropertySingleValue('ProfileType', null, ifcLabel(beam.profileType), null));
        beamDimProps.push(b.addPropertySingleValue('FlangeWidth', null, ifcPositiveLengthMeasure(flangeWidth), lengthUnit));
        beamDimProps.push(b.addPropertySingleValue('Depth', null, ifcPositiveLengthMeasure(depth), lengthUnit));
        beamDimProps.push(b.addPropertySingleValue('Material', null, ifcLabel(getMaterialDisplayName(beam.material)), null));
        if (beam.presetName) {
          beamDimProps.push(b.addPropertySingleValue('PresetName', null, ifcLabel(beam.presetName), null));
        }
        const beamDimPset = b.addPropertySet(
          shapeToIfcGuid(beam.id, 'dims'),
          ownerHistoryId,
          'OpenNDStudio_BeamDimensions',
          'Beam profile dimensions from Open nD Studio',
          beamDimProps
        );
        propertySetAssignments.push({ elementIds: [beamEntityId], psetId: beamDimPset });

        break;
      }

      case 'slab': {
        const slab = shape as SlabShape;
        if (slab.points.length < 3) continue;

        // Create polyline boundary from slab points (close the loop)
        const polylinePts: number[] = [];
        for (const pt of slab.points) {
          polylinePts.push(b.addCartesianPoint2D(pt.x, pt.y));
        }
        // Close the polyline
        polylinePts.push(b.addCartesianPoint2D(slab.points[0].x, slab.points[0].y));

        const polyline = b.addPolyline(polylinePts);
        const slabProfile = b.addArbitraryClosedProfileDef('.AREA.', null, polyline);

        // Extrude by slab thickness
        const thickness = slab.thickness || 200;
        const slabSolid = b.addExtrudedAreaSolid(
          slabProfile, identityPlacement, extrusionDir, thickness
        );

        const slabShapeRep = b.addShapeRepresentation(
          bodySubContext, 'Body', 'SweptSolid', [slabSolid]
        );
        const slabProdShape = b.addProductDefinitionShape(null, null, [slabShapeRep]);

        const elevation = slab.elevation || 0;
        const slabPlacePt = b.addCartesianPoint(0, 0, elevation);
        const slabAxisPlace = b.addAxis2Placement3D(slabPlacePt, zDir, xDir);
        const slabPlacement = b.addLocalPlacement(defaultStoreyPlacement, slabAxisPlace);

        const slabEntityId = b.addSlab(
          shapeToIfcGuid(slab.id),
          ownerHistoryId,
          slab.label || 'Slab',
          slabPlacement,
          slabProdShape
        );
        addElementToStorey(slabEntityId, resolveStoreyForShape(slab));

        // Track slab type (if we can match by properties)
        const matchingSlabType = slabTypes.find(
          st => st.thickness === slab.thickness && st.material === slab.material
        );
        if (matchingSlabType && slabTypeElements.has(matchingSlabType.id)) {
          slabTypeElements.get(matchingSlabType.id)!.push(slabEntityId);
        }

        // ----- Material Layer Set Usage for slab -----
        const slabMatId = getOrCreateMaterial(slab.material);
        const slabLayer = b.addMaterialLayer(slabMatId, thickness, null, 'Slab Layer');
        const slabLayerSet = b.addMaterialLayerSet([slabLayer], `${slab.label || 'Slab'} LayerSet`);
        const slabLayerSetUsage = b.addMaterialLayerSetUsage(
          slabLayerSet, 'AXIS3', 'POSITIVE', 0
        );
        layerSetUsageAssociations.push({ elementIds: [slabEntityId], usageId: slabLayerSetUsage });

        // ----- Property Set: Pset_SlabCommon -----
        const slabProps: number[] = [];
        slabProps.push(b.addPropertySingleValue('Reference', null, ifcIdentifier(slab.label || 'Slab'), null));
        slabProps.push(b.addPropertySingleValue('IsExternal', null, ifcBoolean(false), null));
        slabProps.push(b.addPropertySingleValue('LoadBearing', null, ifcBoolean(true), null));
        const slabPset = b.addPropertySet(
          shapeToIfcGuid(slab.id, 'pset'),
          ownerHistoryId,
          'Pset_SlabCommon',
          'Common slab properties',
          slabProps
        );
        propertySetAssignments.push({ elementIds: [slabEntityId], psetId: slabPset });

        // ----- Quantity Set: Qto_SlabBaseQuantities -----
        // Calculate slab area from polygon (Shoelace formula)
        let slabArea = 0;
        const pts = slab.points;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          slabArea += pts[i].x * pts[j].y;
          slabArea -= pts[j].x * pts[i].y;
        }
        slabArea = Math.abs(slabArea) / 2;

        const slabQProps: number[] = [];
        slabQProps.push(b.addPropertySingleValue('Depth', null, ifcPositiveLengthMeasure(thickness), lengthUnit));
        slabQProps.push(b.addPropertySingleValue('GrossArea', null, ifcAreaMeasure(slabArea / 1e6), areaUnit));
        slabQProps.push(b.addPropertySingleValue('GrossVolume', null, ifcVolumeMeasure(slabArea * thickness / 1e9), volumeUnit));
        const slabQset = b.addPropertySet(
          shapeToIfcGuid(slab.id, 'qto'),
          ownerHistoryId,
          'Qto_SlabBaseQuantities',
          'Slab base quantities',
          slabQProps
        );
        propertySetAssignments.push({ elementIds: [slabEntityId], psetId: slabQset });

        break;
      }

      case 'pile': {
        const pile = shape as PileShape;

        // Profile: circle
        const pileProfile = b.addCircleProfileDef(
          '.AREA.', null, profilePlacement2D,
          pile.diameter / 2
        );

        // Extrude: default pile length 10000mm (10m)
        const pileLength = 10000;
        const pileSolid = b.addExtrudedAreaSolid(
          pileProfile, identityPlacement, extrusionDir, pileLength
        );

        const pileShapeRep = b.addShapeRepresentation(
          bodySubContext, 'Body', 'SweptSolid', [pileSolid]
        );
        const pileProdShape = b.addProductDefinitionShape(null, null, [pileShapeRep]);

        const pilePlacePt = b.addCartesianPoint(pile.position.x, pile.position.y, 0);
        const pileAxisPlace = b.addAxis2Placement3D(pilePlacePt, zDir, xDir);
        const pilePlacement = b.addLocalPlacement(defaultStoreyPlacement, pileAxisPlace);

        const pileEntityId = b.addPile(
          shapeToIfcGuid(pile.id),
          ownerHistoryId,
          pile.label || 'Pile',
          pilePlacement,
          pileProdShape
        );
        addElementToStorey(pileEntityId, resolveStoreyForShape(pile));

        // ----- Material assignment for pile (concrete default) -----
        const pileMatId = getOrCreateMaterial('concrete');
        materialAssociations.push({ elementIds: [pileEntityId], materialId: pileMatId });

        // ----- Property Set: Pset_PileCommon -----
        const pileProps: number[] = [];
        pileProps.push(b.addPropertySingleValue('Reference', null, ifcIdentifier(pile.label || 'Pile'), null));
        pileProps.push(b.addPropertySingleValue('ConstructionType', null, ifcLabel('DRIVEN'), null));
        const pilePset = b.addPropertySet(
          shapeToIfcGuid(pile.id, 'pset'),
          ownerHistoryId,
          'Pset_PileCommon',
          'Common pile properties',
          pileProps
        );
        propertySetAssignments.push({ elementIds: [pileEntityId], psetId: pilePset });

        // ----- Custom property set with dimensions -----
        const pileDimProps: number[] = [];
        pileDimProps.push(b.addPropertySingleValue('Diameter', null, ifcPositiveLengthMeasure(pile.diameter), lengthUnit));
        pileDimProps.push(b.addPropertySingleValue('Length', null, ifcPositiveLengthMeasure(pileLength), lengthUnit));
        // Cross-sectional area
        const pileArea = Math.PI * (pile.diameter / 2) * (pile.diameter / 2);
        pileDimProps.push(b.addPropertySingleValue('CrossSectionalArea', null, ifcAreaMeasure(pileArea / 1e6), areaUnit));
        const pileDimPset = b.addPropertySet(
          shapeToIfcGuid(pile.id, 'dims'),
          ownerHistoryId,
          'OpenNDStudio_PileDimensions',
          'Pile dimensions from Open nD Studio',
          pileDimProps
        );
        propertySetAssignments.push({ elementIds: [pileEntityId], psetId: pileDimPset });

        break;
      }

      case 'gridline': {
        const gridline = shape as GridlineShape;

        // Only export gridlines from plan drawings (section gridlines are derived)
        if (!isShapeInPlanDrawing(gridline)) break;

        // Create axis curve (line from start to end in 3D)
        const startPt = b.addCartesianPoint(gridline.start.x, gridline.start.y, 0);
        const endPt = b.addCartesianPoint(gridline.end.x, gridline.end.y, 0);
        const axisCurve = b.addPolyline([startPt, endPt]);

        const axisId = b.addGridAxis(gridline.label, axisCurve, true);
        gridlineAxes.push({ axis: axisId, curve: axisCurve, shape: gridline });
        break;
      }

      // Levels are handled above as IfcBuildingStorey; also export as IfcAnnotation
      case 'level': {
        const level = shape as LevelShape;

        // Only export level annotations from plan drawings (section levels are derived)
        if (!isShapeInPlanDrawing(level)) break;
        const levelAnnotPt = b.addCartesianPoint(level.start.x, level.start.y, 0);
        const levelAnnotAxis = b.addAxis2Placement3D(levelAnnotPt, zDir, xDir);
        const levelAnnotPlacement = b.addLocalPlacement(defaultStoreyPlacement, levelAnnotAxis);

        // Geometry: line from start to end
        const lvlStartPt = b.addCartesianPoint(level.start.x, level.start.y, 0);
        const lvlEndPt = b.addCartesianPoint(level.end.x, level.end.y, 0);
        const lvlPolyline = b.addPolyline([lvlStartPt, lvlEndPt]);
        const lvlShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [lvlPolyline]
        );
        const lvlProdShape = b.addProductDefinitionShape(null, null, [lvlShapeRep]);

        const lvlAnnotId = b.addAnnotation(
          shapeToIfcGuid(level.id, 'annot'),
          ownerHistoryId,
          level.label || `Level ${level.elevation}`,
          `Elevation: ${level.elevation}mm`,
          levelAnnotPlacement,
          lvlProdShape
        );
        addElementToStorey(lvlAnnotId, resolveStoreyForShape(level));

        // Property set for level annotation
        const lvlAnnotProps: number[] = [];
        lvlAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('level'), null));
        lvlAnnotProps.push(b.addPropertySingleValue('Elevation', null, ifcLengthMeasure(level.elevation), lengthUnit));
        lvlAnnotProps.push(b.addPropertySingleValue('Label', null, ifcLabel(level.label || ''), null));
        if (level.description) {
          lvlAnnotProps.push(b.addPropertySingleValue('Description', null, ifcLabel(level.description), null));
        }
        const lvlAnnotPset = b.addPropertySet(
          shapeToIfcGuid(level.id, 'annot-pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Level annotation properties',
          lvlAnnotProps
        );
        propertySetAssignments.push({ elementIds: [lvlAnnotId], psetId: lvlAnnotPset });
        break;
      }

      case 'line': {
        const line = shape as LineShape;
        const lineStartPt = b.addCartesianPoint(line.start.x, line.start.y, 0);
        const lineEndPt = b.addCartesianPoint(line.end.x, line.end.y, 0);
        const linePolyline = b.addPolyline([lineStartPt, lineEndPt]);
        const lineShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [linePolyline]
        );
        const lineProdShape = b.addProductDefinitionShape(null, null, [lineShapeRep]);

        const linePlacePt = b.addCartesianPoint(0, 0, 0);
        const lineAxisPlace = b.addAxis2Placement3D(linePlacePt, zDir, xDir);
        const linePlacement = b.addLocalPlacement(defaultStoreyPlacement, lineAxisPlace);

        const lineAnnotId = b.addAnnotation(
          shapeToIfcGuid(line.id),
          ownerHistoryId,
          'Line',
          null,
          linePlacement,
          lineProdShape
        );
        addElementToStorey(lineAnnotId, resolveStoreyForShape(line));

        const lineAnnotProps: number[] = [];
        lineAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('line'), null));
        const lineAnnotPset = b.addPropertySet(
          shapeToIfcGuid(line.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Line annotation properties',
          lineAnnotProps
        );
        propertySetAssignments.push({ elementIds: [lineAnnotId], psetId: lineAnnotPset });
        break;
      }

      case 'arc': {
        const arc = shape as ArcShape;
        // Create an IFC circle and trim it
        const arcCenter2D = b.addCartesianPoint(arc.center.x, arc.center.y, 0);
        const arcAxisPlace = b.addAxis2Placement3D(arcCenter2D, zDir, xDir);
        const arcCircle = b.addCircleGeom(arcAxisPlace, arc.radius);

        // Trim using parameter values (angles in radians)
        const arcTrimmed = b.addTrimmedCurve(
          arcCircle,
          `IFCPARAMETERVALUE(${stepReal(arc.startAngle)})`,
          `IFCPARAMETERVALUE(${stepReal(arc.endAngle)})`,
          true,
          '.PARAMETER.'
        );

        const arcShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [arcTrimmed]
        );
        const arcProdShape = b.addProductDefinitionShape(null, null, [arcShapeRep]);

        const arcPlacePt = b.addCartesianPoint(0, 0, 0);
        const arcPlaceAxis = b.addAxis2Placement3D(arcPlacePt, zDir, xDir);
        const arcPlacement = b.addLocalPlacement(defaultStoreyPlacement, arcPlaceAxis);

        const arcAnnotId = b.addAnnotation(
          shapeToIfcGuid(arc.id),
          ownerHistoryId,
          'Arc',
          null,
          arcPlacement,
          arcProdShape
        );
        addElementToStorey(arcAnnotId, resolveStoreyForShape(arc));

        const arcAnnotProps: number[] = [];
        arcAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('arc'), null));
        arcAnnotProps.push(b.addPropertySingleValue('Radius', null, ifcPositiveLengthMeasure(arc.radius), lengthUnit));
        const arcAnnotPset = b.addPropertySet(
          shapeToIfcGuid(arc.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Arc annotation properties',
          arcAnnotProps
        );
        propertySetAssignments.push({ elementIds: [arcAnnotId], psetId: arcAnnotPset });
        break;
      }

      case 'circle': {
        const circle = shape as CircleShape;
        const circleCenterPt = b.addCartesianPoint(circle.center.x, circle.center.y, 0);
        const circleAxisPlace = b.addAxis2Placement3D(circleCenterPt, zDir, xDir);
        const circleGeom = b.addCircleGeom(circleAxisPlace, circle.radius);

        const circleShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [circleGeom]
        );
        const circleProdShape = b.addProductDefinitionShape(null, null, [circleShapeRep]);

        const circlePlacePt = b.addCartesianPoint(0, 0, 0);
        const circlePlaceAxis = b.addAxis2Placement3D(circlePlacePt, zDir, xDir);
        const circlePlacement = b.addLocalPlacement(defaultStoreyPlacement, circlePlaceAxis);

        const circleAnnotId = b.addAnnotation(
          shapeToIfcGuid(circle.id),
          ownerHistoryId,
          'Circle',
          null,
          circlePlacement,
          circleProdShape
        );
        addElementToStorey(circleAnnotId, resolveStoreyForShape(circle));

        const circleAnnotProps: number[] = [];
        circleAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('circle'), null));
        circleAnnotProps.push(b.addPropertySingleValue('Radius', null, ifcPositiveLengthMeasure(circle.radius), lengthUnit));
        const circleAnnotPset = b.addPropertySet(
          shapeToIfcGuid(circle.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Circle annotation properties',
          circleAnnotProps
        );
        propertySetAssignments.push({ elementIds: [circleAnnotId], psetId: circleAnnotPset });
        break;
      }

      case 'polyline': {
        const polyline = shape as PolylineShape;
        if (polyline.points.length < 2) break;

        const polyPts: number[] = [];
        for (const pt of polyline.points) {
          polyPts.push(b.addCartesianPoint(pt.x, pt.y, 0));
        }
        // Close the polyline if needed
        if (polyline.closed && polyline.points.length > 2) {
          polyPts.push(b.addCartesianPoint(polyline.points[0].x, polyline.points[0].y, 0));
        }
        const polyGeom = b.addPolyline(polyPts);

        const polyShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [polyGeom]
        );
        const polyProdShape = b.addProductDefinitionShape(null, null, [polyShapeRep]);

        const polyPlacePt = b.addCartesianPoint(0, 0, 0);
        const polyPlaceAxis = b.addAxis2Placement3D(polyPlacePt, zDir, xDir);
        const polyPlacement = b.addLocalPlacement(defaultStoreyPlacement, polyPlaceAxis);

        const polyAnnotId = b.addAnnotation(
          shapeToIfcGuid(polyline.id),
          ownerHistoryId,
          polyline.closed ? 'Closed Polyline' : 'Polyline',
          null,
          polyPlacement,
          polyProdShape
        );
        addElementToStorey(polyAnnotId, resolveStoreyForShape(polyline));

        const polyAnnotProps: number[] = [];
        polyAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('polyline'), null));
        polyAnnotProps.push(b.addPropertySingleValue('Closed', null, ifcBoolean(polyline.closed), null));
        polyAnnotProps.push(b.addPropertySingleValue('VertexCount', null, ifcLabel(String(polyline.points.length)), null));
        const polyAnnotPset = b.addPropertySet(
          shapeToIfcGuid(polyline.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Polyline annotation properties',
          polyAnnotProps
        );
        propertySetAssignments.push({ elementIds: [polyAnnotId], psetId: polyAnnotPset });
        break;
      }

      case 'rectangle': {
        const rect = shape as RectangleShape;
        // Create a closed polyline for the rectangle boundary
        const cosR = Math.cos(rect.rotation);
        const sinR = Math.sin(rect.rotation);
        const tl = rect.topLeft;

        // Rectangle corners: topLeft, topRight, bottomRight, bottomLeft
        const corners = [
          { x: tl.x, y: tl.y },
          { x: tl.x + rect.width * cosR, y: tl.y + rect.width * sinR },
          { x: tl.x + rect.width * cosR - rect.height * sinR, y: tl.y + rect.width * sinR + rect.height * cosR },
          { x: tl.x - rect.height * sinR, y: tl.y + rect.height * cosR },
        ];
        const rectPts: number[] = [];
        for (const c of corners) {
          rectPts.push(b.addCartesianPoint(c.x, c.y, 0));
        }
        // Close the rectangle
        rectPts.push(b.addCartesianPoint(corners[0].x, corners[0].y, 0));
        const rectPolyline = b.addPolyline(rectPts);

        const rectShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [rectPolyline]
        );
        const rectProdShape = b.addProductDefinitionShape(null, null, [rectShapeRep]);

        const rectPlacePt = b.addCartesianPoint(0, 0, 0);
        const rectPlaceAxis = b.addAxis2Placement3D(rectPlacePt, zDir, xDir);
        const rectPlacement = b.addLocalPlacement(defaultStoreyPlacement, rectPlaceAxis);

        const rectAnnotId = b.addAnnotation(
          shapeToIfcGuid(rect.id),
          ownerHistoryId,
          'Rectangle',
          null,
          rectPlacement,
          rectProdShape
        );
        addElementToStorey(rectAnnotId, resolveStoreyForShape(rect));

        const rectAnnotProps: number[] = [];
        rectAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('rectangle'), null));
        rectAnnotProps.push(b.addPropertySingleValue('Width', null, ifcPositiveLengthMeasure(rect.width), lengthUnit));
        rectAnnotProps.push(b.addPropertySingleValue('Height', null, ifcPositiveLengthMeasure(rect.height), lengthUnit));
        const rectAnnotPset = b.addPropertySet(
          shapeToIfcGuid(rect.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Rectangle annotation properties',
          rectAnnotProps
        );
        propertySetAssignments.push({ elementIds: [rectAnnotId], psetId: rectAnnotPset });
        break;
      }

      case 'dimension': {
        const dim = shape as DimensionShape;
        if (dim.points.length < 2) break;

        // Create polyline from dimension reference points
        const dimPts: number[] = [];
        for (const pt of dim.points) {
          dimPts.push(b.addCartesianPoint(pt.x, pt.y, 0));
        }
        const dimPolyline = b.addPolyline(dimPts);
        const dimShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [dimPolyline]
        );
        const dimProdShape = b.addProductDefinitionShape(null, null, [dimShapeRep]);

        const dimPlacePt = b.addCartesianPoint(0, 0, 0);
        const dimPlaceAxis = b.addAxis2Placement3D(dimPlacePt, zDir, xDir);
        const dimPlacement = b.addLocalPlacement(defaultStoreyPlacement, dimPlaceAxis);

        const dimAnnotId = b.addAnnotation(
          shapeToIfcGuid(dim.id),
          ownerHistoryId,
          `Dimension: ${dim.value}`,
          `${dim.dimensionType} dimension`,
          dimPlacement,
          dimProdShape
        );
        addElementToStorey(dimAnnotId, resolveStoreyForShape(dim));

        const dimAnnotProps: number[] = [];
        dimAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('dimension'), null));
        dimAnnotProps.push(b.addPropertySingleValue('DimensionType', null, ifcLabel(dim.dimensionType), null));
        dimAnnotProps.push(b.addPropertySingleValue('Value', null, ifcLabel(dim.value), null));
        if (dim.prefix) {
          dimAnnotProps.push(b.addPropertySingleValue('Prefix', null, ifcLabel(dim.prefix), null));
        }
        if (dim.suffix) {
          dimAnnotProps.push(b.addPropertySingleValue('Suffix', null, ifcLabel(dim.suffix), null));
        }
        const dimAnnotPset = b.addPropertySet(
          shapeToIfcGuid(dim.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Dimension annotation properties',
          dimAnnotProps
        );
        propertySetAssignments.push({ elementIds: [dimAnnotId], psetId: dimAnnotPset });
        break;
      }

      case 'text': {
        const text = shape as TextShape;

        // Text has no geometry curve; create a point representation at text position
        const textPt = b.addCartesianPoint(text.position.x, text.position.y, 0);
        const textPolyline = b.addPolyline([textPt, textPt]); // Degenerate polyline at text position
        const textShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [textPolyline]
        );
        const textProdShape = b.addProductDefinitionShape(null, null, [textShapeRep]);

        const textPlacePt = b.addCartesianPoint(0, 0, 0);
        const textPlaceAxis = b.addAxis2Placement3D(textPlacePt, zDir, xDir);
        const textPlacement = b.addLocalPlacement(defaultStoreyPlacement, textPlaceAxis);

        const textAnnotId = b.addAnnotation(
          shapeToIfcGuid(text.id),
          ownerHistoryId,
          text.text.substring(0, 50) || 'Text',
          'Text annotation',
          textPlacement,
          textProdShape
        );
        addElementToStorey(textAnnotId, resolveStoreyForShape(text));

        const textAnnotProps: number[] = [];
        textAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('text'), null));
        textAnnotProps.push(b.addPropertySingleValue('Content', null, ifcLabel(text.text), null));
        textAnnotProps.push(b.addPropertySingleValue('FontSize', null, ifcPositiveLengthMeasure(text.fontSize), lengthUnit));
        textAnnotProps.push(b.addPropertySingleValue('FontFamily', null, ifcLabel(text.fontFamily), null));
        const textAnnotPset = b.addPropertySet(
          shapeToIfcGuid(text.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Text annotation properties',
          textAnnotProps
        );
        propertySetAssignments.push({ elementIds: [textAnnotId], psetId: textAnnotPset });
        break;
      }

      case 'section-callout': {
        const sc = shape as SectionCalloutShape;

        // Create line from start to end of the section cut
        const scStartPt = b.addCartesianPoint(sc.start.x, sc.start.y, 0);
        const scEndPt = b.addCartesianPoint(sc.end.x, sc.end.y, 0);
        const scPolyline = b.addPolyline([scStartPt, scEndPt]);
        const scShapeRep = b.addShapeRepresentation(
          axisSubContext, 'Annotation', 'Curve2D', [scPolyline]
        );
        const scProdShape = b.addProductDefinitionShape(null, null, [scShapeRep]);

        const scPlacePt = b.addCartesianPoint(0, 0, 0);
        const scPlaceAxis = b.addAxis2Placement3D(scPlacePt, zDir, xDir);
        const scPlacement = b.addLocalPlacement(defaultStoreyPlacement, scPlaceAxis);

        const scAnnotId = b.addAnnotation(
          shapeToIfcGuid(sc.id),
          ownerHistoryId,
          `Section ${sc.label}`,
          `${sc.calloutType} callout`,
          scPlacement,
          scProdShape
        );
        addElementToStorey(scAnnotId, resolveStoreyForShape(sc));

        const scAnnotProps: number[] = [];
        // For section callouts in section drawings, add a property linking to the source drawing
        if (isShapeInSectionDrawing(sc)) {
          scAnnotProps.push(b.addPropertySingleValue('DrawingType', null, ifcLabel('section'), null));
        }
        scAnnotProps.push(b.addPropertySingleValue('ShapeType', null, ifcLabel('section-callout'), null));
        scAnnotProps.push(b.addPropertySingleValue('CalloutType', null, ifcLabel(sc.calloutType), null));
        scAnnotProps.push(b.addPropertySingleValue('Label', null, ifcLabel(sc.label), null));
        if (sc.targetDrawingId) {
          scAnnotProps.push(b.addPropertySingleValue('TargetDrawingId', null, ifcLabel(sc.targetDrawingId), null));
        }
        const scAnnotPset = b.addPropertySet(
          shapeToIfcGuid(sc.id, 'pset'),
          ownerHistoryId,
          'OpenNDStudio_Annotation',
          'Section callout annotation properties',
          scAnnotProps
        );
        propertySetAssignments.push({ elementIds: [scAnnotId], psetId: scAnnotPset });
        break;
      }

      default:
        // Remaining shapes (hatch, image, space, spline, point, ellipse) are not exported to IFC
        break;
    }
  }

  // -------------------------------------------------------------------------
  // 10. Create IfcGrid for gridlines (if any)
  //     Gridlines in Plan drawings are exported as IfcGrid (structural grid).
  //     Gridlines in other drawing types are also included in the grid.
  // -------------------------------------------------------------------------
  if (gridlineAxes.length > 0) {
    // Separate into U-axes (roughly horizontal) and V-axes (roughly vertical)
    const uAxes: number[] = [];
    const vAxes: number[] = [];

    for (const { axis, shape } of gridlineAxes) {
      const dx = Math.abs(shape.end.x - shape.start.x);
      const dy = Math.abs(shape.end.y - shape.start.y);
      if (dx >= dy) {
        uAxes.push(axis);
      } else {
        vAxes.push(axis);
      }
    }

    // IFC requires at least 1 axis in each list; if one is empty, put all in U
    if (uAxes.length === 0) {
      uAxes.push(vAxes.shift()!);
    }
    if (vAxes.length === 0) {
      vAxes.push(uAxes[uAxes.length - 1]);
    }

    const gridPlacePt = b.addCartesianPoint(0, 0, 0);
    const gridAxisPlace = b.addAxis2Placement3D(gridPlacePt, zDir, xDir);
    const gridPlacement = b.addLocalPlacement(defaultStoreyPlacement, gridAxisPlace);

    // Build a FootPrint representation so viewers (e.g. @thatopen) render grid lines.
    // Collect all axis curves into a GeometricCurveSet, wrapped in a ShapeRepresentation.
    const gridCurveIds = gridlineAxes.map(({ curve }) => curve);
    const gridCurveSet = b.addGeometricCurveSet(gridCurveIds);
    const gridFootprintRep = b.addShapeRepresentation(
      axisSubContext, 'FootPrint', 'GeometricCurveSet', [gridCurveSet]
    );
    const gridProdShape = b.addProductDefinitionShape(null, null, [gridFootprintRep]);

    // Use "Structural Grid" name, add "(Plan)" suffix if gridlines are in a plan drawing
    const hasPlanGridlines = gridlineAxes.some(({ shape }) => isShapeInPlanDrawing(shape));
    const gridName = hasPlanGridlines ? 'Structural Grid' : 'Grid';

    const gridId = b.addGrid(
      generateIfcGuid(), ownerHistoryId, gridName,
      gridPlacement, gridProdShape, uAxes, vAxes
    );

    // Route the grid to the storey of the first gridline's drawing
    const firstGridlineShape = gridlineAxes[0]?.shape;
    if (firstGridlineShape) {
      addElementToStorey(gridId, resolveStoreyForShape(firstGridlineShape));
    } else {
      addElementToStorey(gridId, defaultStoreyId);
    }

    // For plan drawings, add a property set marking this as an IFC grid system
    if (hasPlanGridlines) {
      const gridProps: number[] = [];
      gridProps.push(b.addPropertySingleValue('GridType', null, ifcLabel('IfcGrid'), null));
      gridProps.push(b.addPropertySingleValue('Source', null, ifcLabel('Plan Drawing'), null));
      const gridPset = b.addPropertySet(
        generateIfcGuid(),
        ownerHistoryId,
        'OpenNDStudio_GridSystem',
        'Grid system from Plan drawing',
        gridProps
      );
      propertySetAssignments.push({ elementIds: [gridId], psetId: gridPset });
    }
  }

  // -------------------------------------------------------------------------
  // 11. Contain elements in storeys (drawing-type-aware routing)
  //     Elements from Plan drawings with storeyId go to the linked storey.
  //     All other elements go to the default storey.
  // -------------------------------------------------------------------------
  for (const [storeyId, elems] of storeyElementsMap) {
    if (elems.length > 0) {
      b.addRelContainedInSpatialStructure(
        generateIfcGuid(), ownerHistoryId,
        storeyId === defaultStoreyId ? 'DefaultStoreyElements' : 'StoreyElements',
        elems, storeyId
      );
    }
  }
  // Fallback: if elementIds has entries not in any storey map (shouldn't happen, but safety net)
  if (elementIds.length > 0) {
    // Check if any elementIds are not yet in storeyElementsMap
    const allMappedElements = new Set<number>();
    for (const elems of storeyElementsMap.values()) {
      for (const e of elems) allMappedElements.add(e);
    }
    const unmappedElements = elementIds.filter(id => !allMappedElements.has(id));
    if (unmappedElements.length > 0) {
      b.addRelContainedInSpatialStructure(
        generateIfcGuid(), ownerHistoryId,
        'DefaultStoreyElements', unmappedElements, defaultStoreyId
      );
    }
  }

  // -------------------------------------------------------------------------
  // 12. Type assignments (IfcRelDefinesByType)
  // -------------------------------------------------------------------------

  // Wall type assignments
  for (const [typeId, elems] of wallTypeElements) {
    if (elems.length > 0) {
      const ifcTypeId = wallTypeIfcMap.get(typeId);
      if (ifcTypeId !== undefined) {
        b.addRelDefinesByType(
          generateIfcGuid(), ownerHistoryId, null, elems, ifcTypeId
        );
      }
    }
  }

  // Slab type assignments
  for (const [typeId, elems] of slabTypeElements) {
    if (elems.length > 0) {
      const ifcTypeId = slabTypeIfcMap.get(typeId);
      if (ifcTypeId !== undefined) {
        b.addRelDefinesByType(
          generateIfcGuid(), ownerHistoryId, null, elems, ifcTypeId
        );
      }
    }
  }

  // Beam type assignments
  for (const [typeKey, elems] of beamTypeElements) {
    if (elems.length > 0) {
      const ifcTypeId = beamTypeIfcMap.get(typeKey);
      if (ifcTypeId !== undefined) {
        b.addRelDefinesByType(
          generateIfcGuid(), ownerHistoryId, null, elems, ifcTypeId
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 13. Material associations (IfcRelAssociatesMaterial)
  // -------------------------------------------------------------------------

  // Group by materialId to minimize IfcRelAssociatesMaterial entities
  const matGrouped = new Map<number, number[]>();
  for (const assoc of materialAssociations) {
    for (const elemId of assoc.elementIds) {
      const existing = matGrouped.get(assoc.materialId) || [];
      existing.push(elemId);
      matGrouped.set(assoc.materialId, existing);
    }
  }
  for (const [matId, elemIds] of matGrouped) {
    b.addRelAssociatesMaterial(
      generateIfcGuid(), ownerHistoryId, 'MaterialAssociation',
      elemIds, matId
    );
  }

  // Layer set usage associations (one per element since usage may differ)
  for (const assoc of layerSetUsageAssociations) {
    b.addRelAssociatesMaterial(
      generateIfcGuid(), ownerHistoryId, 'MaterialLayerSetUsage',
      assoc.elementIds, assoc.usageId
    );
  }

  // -------------------------------------------------------------------------
  // 14. Property set assignments (IfcRelDefinesByProperties)
  // -------------------------------------------------------------------------
  for (const assoc of propertySetAssignments) {
    b.addRelDefinesByProperties(
      generateIfcGuid(), ownerHistoryId, null,
      assoc.elementIds, assoc.psetId
    );
  }

  // -------------------------------------------------------------------------
  // 15. Build STEP file with proper IFC4 header
  // -------------------------------------------------------------------------
  const ts = isoTimestamp();
  const entityCount = b.getEntityCount();

  const header = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION((${stepString('ViewDefinition [CoordinationView_V2.0]')},${stepString('ExchangeRequirement [Architecture]')}),'2;1');`,
    `FILE_NAME(${stepString('model.ifc')},${stepString(ts)},(${stepString('User')}),(${stepString('Open nD Studio')}),${stepString('Open nD Studio IFC Generator 1.0')},${stepString('Open nD Studio 1.0')},$);`,
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    '',
    'DATA;',
  ].join('\n');

  const footer = [
    'ENDSEC;',
    'END-ISO-10303-21;',
  ].join('\n');

  const content = header + '\n' + b.serialize() + '\n' + footer + '\n';

  return {
    content,
    entityCount,
    fileSize: new Blob([content]).size,
  };
}
