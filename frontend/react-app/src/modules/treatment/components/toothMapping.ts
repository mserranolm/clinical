/**
 * Mapeo entre números FDI y metadata anatómica del diente.
 *
 * Sistema FDI (ISO 3950):
 *   - Permanentes: 11-18 (sup. der.), 21-28 (sup. izq.), 31-38 (inf. izq.), 41-48 (inf. der.)
 *   - Temporales:  51-55, 61-65, 71-75, 81-85
 *
 * Cuando dropees un GLB en /public/models/dental-arch.glb, completá MESH_TO_FDI
 * con los nombres reales de los meshes que use el modelo.
 */

export type Quadrant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Jaw = "upper" | "lower";

/** Todos los números FDI de dientes permanentes (32). */
export const PERMANENT_FDI: readonly number[] = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

/** Todos los números FDI de dientes temporales (20). */
export const TEMPORARY_FDI: readonly number[] = [
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
  85, 84, 83, 82, 81, 71, 72, 73, 74, 75,
];

/** Es un diente del maxilar superior (sup.). */
export function isUpperJaw(fdi: number): boolean {
  const q = Math.floor(fdi / 10);
  return q === 1 || q === 2 || q === 5 || q === 6;
}

export function jawOf(fdi: number): Jaw {
  return isUpperJaw(fdi) ? "upper" : "lower";
}

export function isPermanent(fdi: number): boolean {
  const q = Math.floor(fdi / 10);
  return q >= 1 && q <= 4;
}

export function quadrantOf(fdi: number): Quadrant {
  return Math.floor(fdi / 10) as Quadrant;
}

/** Tipo anatómico funcional (compatible con la visualización 3D actual). */
export type ToothKind =
  | "central-incisor"
  | "lateral-incisor"
  | "canine"
  | "premolar"
  | "molar";

export function toothKindOf(fdi: number, isTemporary?: boolean): ToothKind {
  const unit = fdi % 10;
  if (unit === 1) return "central-incisor";
  if (unit === 2) return "lateral-incisor";
  if (unit === 3) return "canine";
  if (isTemporary) return "molar";
  if (unit <= 5) return "premolar";
  return "molar";
}

/** Nombre clínico en español para mostrar al usuario. */
export const FDI_ANATOMICAL_NAME: Record<number, string> = {
  // Maxilar superior derecho (Q1)
  18: "Tercer molar superior derecho",
  17: "Segundo molar superior derecho",
  16: "Primer molar superior derecho",
  15: "Segundo premolar superior derecho",
  14: "Primer premolar superior derecho",
  13: "Canino superior derecho",
  12: "Incisivo lateral superior derecho",
  11: "Incisivo central superior derecho",
  // Maxilar superior izquierdo (Q2)
  21: "Incisivo central superior izquierdo",
  22: "Incisivo lateral superior izquierdo",
  23: "Canino superior izquierdo",
  24: "Primer premolar superior izquierdo",
  25: "Segundo premolar superior izquierdo",
  26: "Primer molar superior izquierdo",
  27: "Segundo molar superior izquierdo",
  28: "Tercer molar superior izquierdo",
  // Mandíbula inferior izquierda (Q3)
  31: "Incisivo central inferior izquierdo",
  32: "Incisivo lateral inferior izquierdo",
  33: "Canino inferior izquierdo",
  34: "Primer premolar inferior izquierdo",
  35: "Segundo premolar inferior izquierdo",
  36: "Primer molar inferior izquierdo",
  37: "Segundo molar inferior izquierdo",
  38: "Tercer molar inferior izquierdo",
  // Mandíbula inferior derecha (Q4)
  41: "Incisivo central inferior derecho",
  42: "Incisivo lateral inferior derecho",
  43: "Canino inferior derecho",
  44: "Primer premolar inferior derecho",
  45: "Segundo premolar inferior derecho",
  46: "Primer molar inferior derecho",
  47: "Segundo molar inferior derecho",
  48: "Tercer molar inferior derecho",
  // Temporales superiores
  55: "Segundo molar temporal superior derecho",
  54: "Primer molar temporal superior derecho",
  53: "Canino temporal superior derecho",
  52: "Incisivo lateral temporal superior derecho",
  51: "Incisivo central temporal superior derecho",
  61: "Incisivo central temporal superior izquierdo",
  62: "Incisivo lateral temporal superior izquierdo",
  63: "Canino temporal superior izquierdo",
  64: "Primer molar temporal superior izquierdo",
  65: "Segundo molar temporal superior izquierdo",
  // Temporales inferiores
  85: "Segundo molar temporal inferior derecho",
  84: "Primer molar temporal inferior derecho",
  83: "Canino temporal inferior derecho",
  82: "Incisivo lateral temporal inferior derecho",
  81: "Incisivo central temporal inferior derecho",
  71: "Incisivo central temporal inferior izquierdo",
  72: "Incisivo lateral temporal inferior izquierdo",
  73: "Canino temporal inferior izquierdo",
  74: "Primer molar temporal inferior izquierdo",
  75: "Segundo molar temporal inferior izquierdo",
};

export function fdiToName(fdi: number): string {
  return FDI_ANATOMICAL_NAME[fdi] ?? `Diente ${fdi}`;
}

/**
 * Mesh-name → FDI number.
 *
 * Completar después de inspeccionar el GLB con:
 *   const { scene } = useGLTF('/models/dental-arch.glb');
 *   scene.traverse(o => { if (o.type === 'Mesh') console.log(o.name); });
 *
 * Convenciones comunes en modelos dentales:
 *   - "tooth_11", "tooth_12"…  (FDI directo)
 *   - "tooth_1", "tooth_2"…    (Universal — convertir a FDI)
 *   - "Upper_Right_3rd_Molar"  (descriptivo)
 */
export const MESH_TO_FDI: Record<string, number> = {};

export function fdiFromMeshName(meshName: string): number | null {
  if (MESH_TO_FDI[meshName] !== undefined) return MESH_TO_FDI[meshName];

  // Heurísticas comunes — `tooth_NN`, `tooth-NN`, `Tooth_NN`, etc.
  const m = meshName.match(/(?:tooth|diente|t)[_\-]?(\d{1,2})/i);
  if (m) {
    const n = Number(m[1]);
    if (PERMANENT_FDI.includes(n) || TEMPORARY_FDI.includes(n)) return n;
    if (n >= 1 && n <= 32) return universalToFDI(n);
  }
  return null;
}

/** Numeración Universal (1-32) → FDI. 1=18 (M3 sup.der.), 16=28, 17=38, 32=48. */
export function universalToFDI(universal: number): number | null {
  if (universal < 1 || universal > 32) return null;
  if (universal <= 8) return 18 - (universal - 1); // 1→18, 8→11
  if (universal <= 16) return 21 + (universal - 9); // 9→21, 16→28
  if (universal <= 24) return 38 - (universal - 17); // 17→38, 24→31
  return 41 + (universal - 25); // 25→41, 32→48
}
