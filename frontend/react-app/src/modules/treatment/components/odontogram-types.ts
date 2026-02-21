// ── Tipos y constantes del Odontograma (estilo Aronin) ──────────────

export type Surface = 'O' | 'V' | 'L' | 'M' | 'D';

// ── Condiciones por SUPERFICIE ──────────────────────────────────────
export type SurfaceCondition =
  | 'none'
  | 'caries'
  | 'restauracion_buena'
  | 'restauracion_defectuosa'
  | 'restauracion_provisional'
  | 'sellante_indicado'
  | 'sellante_realizado';

// ── Condiciones por DIENTE COMPLETO ─────────────────────────────────
export type ToothCondition =
  | 'none'
  | 'exodoncia_indicada'
  | 'exodoncia_realizada'
  | 'endodoncia_indicada'
  | 'endodoncia_realizada'
  | 'corona_indicada'
  | 'corona_realizada'
  | 'corona_defectuosa'
  | 'implante_indicado'
  | 'implante_realizado'
  | 'erupcion_alterada'
  | 'erupcion_dental'
  | 'fractura'
  | 'diente_ausente';

// ── Estado completo de un diente ────────────────────────────────────
export interface ToothState {
  surfaces: Record<Surface, SurfaceCondition>;
  condition: ToothCondition;
}

export const EMPTY_SURFACES: Record<Surface, SurfaceCondition> = {
  O: 'none', V: 'none', L: 'none', M: 'none', D: 'none',
};

export const EMPTY_TOOTH_STATE: ToothState = {
  surfaces: { ...EMPTY_SURFACES },
  condition: 'none',
};

export function getToothState(
  states: Record<number, ToothState>,
  toothNum: number,
): ToothState {
  return states[toothNum] ?? { surfaces: { ...EMPTY_SURFACES }, condition: 'none' };
}

// ── Colores por condición de superficie ─────────────────────────────
export const SURFACE_FILL: Record<SurfaceCondition, string> = {
  none:                       '#ffffff',
  caries:                     '#ef4444',
  restauracion_buena:         '#3b82f6',
  restauracion_defectuosa:    '#3b82f6',
  restauracion_provisional:   'transparent',
  sellante_indicado:          '#ef4444',
  sellante_realizado:         '#3b82f6',
};

export const SURFACE_STROKE: Record<SurfaceCondition, string> = {
  none:                       '#cbd5e1',
  caries:                     '#dc2626',
  restauracion_buena:         '#2563eb',
  restauracion_defectuosa:    '#dc2626',
  restauracion_provisional:   '#dc2626',
  sellante_indicado:          '#dc2626',
  sellante_realizado:         '#2563eb',
};

// ── Colores por condición de diente completo ────────────────────────
export function toothConditionColor(cond: ToothCondition): string {
  switch (cond) {
    case 'exodoncia_indicada':
    case 'endodoncia_indicada':
    case 'corona_indicada':
    case 'implante_indicado':
    case 'erupcion_alterada':
    case 'fractura':
      return '#ef4444'; // rojo
    case 'exodoncia_realizada':
    case 'endodoncia_realizada':
    case 'corona_realizada':
    case 'implante_realizado':
    case 'erupcion_dental':
      return '#2563eb'; // azul
    case 'corona_defectuosa':
      return '#2563eb'; // relleno azul (borde rojo se agrega aparte)
    case 'diente_ausente':
      return '#94a3b8'; // gris
    default:
      return 'transparent';
  }
}

// ── Definición del menú radial ──────────────────────────────────────

export interface RadialMenuSubItem {
  id: string;
  label: string;
  color: string;           // color del ícono
  /** Acción: aplica SurfaceCondition o ToothCondition */
  surfaceAction?: SurfaceCondition;
  toothAction?: ToothCondition;
}

export interface RadialMenuItem {
  id: string;
  label: string;
  icon: string;            // emoji o clave de ícono
  /** Si no tiene sub-items, es acción directa */
  surfaceAction?: SurfaceCondition;
  toothAction?: ToothCondition;
  /** Si hay sub-items, se expanden al hacer click */
  subItems?: RadialMenuSubItem[];
  /** 'surface' = solo aparece si se clicó una superficie, 'tooth' = siempre, 'both' = ambos */
  scope: 'surface' | 'tooth' | 'both';
}

export const RADIAL_MENU_ITEMS: RadialMenuItem[] = [
  {
    id: 'sano',
    label: 'Diente Sano',
    icon: '✦',
    scope: 'both',
    // Acción directa: resetear todo
    surfaceAction: 'none',
    toothAction: 'none',
  },
  {
    id: 'caries',
    label: 'Caries',
    icon: '●',
    scope: 'both',
    surfaceAction: 'caries',
  },
  {
    id: 'restauracion',
    label: 'Restauración',
    icon: '◗',
    scope: 'both',
    subItems: [
      { id: 'rest_buena', label: 'Buen estado', color: '#2563eb', surfaceAction: 'restauracion_buena' },
      { id: 'rest_defect', label: 'Defectuosa', color: '#ef4444', surfaceAction: 'restauracion_defectuosa' },
      { id: 'rest_prov', label: 'Provisional', color: '#f97316', surfaceAction: 'restauracion_provisional' },
    ],
  },
  {
    id: 'exodoncia',
    label: 'Exodoncia',
    icon: '✕',
    scope: 'both',
    subItems: [
      { id: 'exo_ind', label: 'Indicada', color: '#ef4444', toothAction: 'exodoncia_indicada' },
      { id: 'exo_real', label: 'Realizada', color: '#2563eb', toothAction: 'exodoncia_realizada' },
    ],
  },
  {
    id: 'endodoncia',
    label: 'Endodoncia',
    icon: '│',
    scope: 'both',
    subItems: [
      { id: 'endo_ind', label: 'Indicada', color: '#ef4444', toothAction: 'endodoncia_indicada' },
      { id: 'endo_real', label: 'Realizada', color: '#2563eb', toothAction: 'endodoncia_realizada' },
    ],
  },
  {
    id: 'corona',
    label: 'Corona',
    icon: '⊙',
    scope: 'both',
    subItems: [
      { id: 'cor_ind', label: 'Indicada', color: '#ef4444', toothAction: 'corona_indicada' },
      { id: 'cor_real', label: 'Realizada', color: '#2563eb', toothAction: 'corona_realizada' },
      { id: 'cor_def', label: 'Defectuosa', color: '#f97316', toothAction: 'corona_defectuosa' },
    ],
  },
  {
    id: 'implante',
    label: 'Implante',
    icon: '▼',
    scope: 'both',
    subItems: [
      { id: 'imp_ind', label: 'Indicado', color: '#ef4444', toothAction: 'implante_indicado' },
      { id: 'imp_real', label: 'Realizado', color: '#2563eb', toothAction: 'implante_realizado' },
    ],
  },
  {
    id: 'erupcion',
    label: 'Erupción',
    icon: '○',
    scope: 'both',
    subItems: [
      { id: 'erup_alt', label: 'Alterada', color: '#ef4444', toothAction: 'erupcion_alterada' },
      { id: 'erup_den', label: 'Dental', color: '#2563eb', toothAction: 'erupcion_dental' },
    ],
  },
  {
    id: 'sellante',
    label: 'Sellante',
    icon: '■',
    scope: 'surface',
    subItems: [
      { id: 'sel_ind', label: 'Indicado', color: '#ef4444', surfaceAction: 'sellante_indicado' },
      { id: 'sel_real', label: 'Realizado', color: '#2563eb', surfaceAction: 'sellante_realizado' },
    ],
  },
  {
    id: 'fractura',
    label: 'Fractura',
    icon: '⚡',
    scope: 'both',
    toothAction: 'fractura',
  },
  {
    id: 'ausente',
    label: 'Ausente',
    icon: '⊘',
    scope: 'both',
    toothAction: 'diente_ausente',
  },
  {
    id: 'borrar',
    label: 'Borrar todo',
    icon: '🗑',
    scope: 'both',
    // Acción especial: resetear completamente
    surfaceAction: 'none',
    toothAction: 'none',
  },
];

// ── Mapeo frontend → backend API ────────────────────────────────────

interface BackendSurface {
  surface: string;
  condition: string;
  severity: number;
  notes: string;
}

export function surfaceConditionToBackend(
  surfKey: Surface,
  cond: SurfaceCondition,
): BackendSurface | null {
  if (cond === 'none') return null;
  const surfMap: Record<Surface, string> = {
    O: 'oclusal', V: 'vestibular', L: 'lingual', M: 'mesial', D: 'distal',
  };
  switch (cond) {
    case 'caries':
      return { surface: surfMap[surfKey], condition: 'caries', severity: 1, notes: '' };
    case 'restauracion_buena':
      return { surface: surfMap[surfKey], condition: 'filled', severity: 2, notes: '' };
    case 'restauracion_defectuosa':
      return { surface: surfMap[surfKey], condition: 'filled', severity: 3, notes: 'defectuosa' };
    case 'restauracion_provisional':
      return { surface: surfMap[surfKey], condition: 'filled', severity: 4, notes: 'provisional' };
    case 'sellante_indicado':
      return { surface: surfMap[surfKey], condition: 'sealant', severity: 1, notes: '' };
    case 'sellante_realizado':
      return { surface: surfMap[surfKey], condition: 'sealant', severity: 2, notes: '' };
    default:
      return null;
  }
}

export function toothConditionToBackend(cond: ToothCondition): { condition: string; severity: number } | null {
  switch (cond) {
    case 'none': return null;
    case 'exodoncia_indicada': return { condition: 'extracted', severity: 1 };
    case 'exodoncia_realizada': return { condition: 'extracted', severity: 2 };
    case 'endodoncia_indicada': return { condition: 'endodontic', severity: 1 };
    case 'endodoncia_realizada': return { condition: 'endodontic', severity: 2 };
    case 'corona_indicada': return { condition: 'crown', severity: 1 };
    case 'corona_realizada': return { condition: 'crown', severity: 2 };
    case 'corona_defectuosa': return { condition: 'crown', severity: 3 };
    case 'implante_indicado': return { condition: 'implant', severity: 1 };
    case 'implante_realizado': return { condition: 'implant', severity: 2 };
    case 'erupcion_alterada': return { condition: 'eruption', severity: 1 };
    case 'erupcion_dental': return { condition: 'eruption', severity: 2 };
    case 'fractura': return { condition: 'fracture', severity: 1 };
    case 'diente_ausente': return { condition: 'missing', severity: 1 };
    default: return null;
  }
}

export function backendToSurfaceCondition(condition: string, severity: number): SurfaceCondition {
  switch (condition) {
    case 'caries': return 'caries';
    case 'filled':
      if (severity === 3) return 'restauracion_defectuosa';
      if (severity === 4) return 'restauracion_provisional';
      return 'restauracion_buena';
    case 'sealant':
      return severity === 1 ? 'sellante_indicado' : 'sellante_realizado';
    default: return 'none';
  }
}

export function backendToToothCondition(condition: string, severity: number): ToothCondition {
  switch (condition) {
    case 'extracted': return severity === 1 ? 'exodoncia_indicada' : 'exodoncia_realizada';
    case 'endodontic': return severity === 1 ? 'endodoncia_indicada' : 'endodoncia_realizada';
    case 'crown':
      if (severity === 3) return 'corona_defectuosa';
      return severity === 1 ? 'corona_indicada' : 'corona_realizada';
    case 'implant': return severity === 1 ? 'implante_indicado' : 'implante_realizado';
    case 'eruption': return severity === 1 ? 'erupcion_alterada' : 'erupcion_dental';
    case 'fracture': return 'fractura';
    case 'missing': return 'diente_ausente';
    default: return 'none';
  }
}

// Condiciones de diente que se guardan como "general" (no por superficie)
export const TOOTH_LEVEL_CONDITIONS = new Set<string>([
  'extracted', 'endodontic', 'crown', 'implant', 'eruption', 'fracture', 'missing',
]);

// ── Serializar ToothState completo al formato del API ───────────────
export function serializeToothState(toothNum: number, state: ToothState) {
  const surfaces: BackendSurface[] = [];

  // Superficies
  for (const [key, cond] of Object.entries(state.surfaces)) {
    const mapped = surfaceConditionToBackend(key as Surface, cond);
    if (mapped) surfaces.push(mapped);
  }

  // Condición de diente completo → se agrega en generalNotes como JSON
  const toothBackend = toothConditionToBackend(state.condition);
  const isPresent = state.condition !== 'diente_ausente' && state.condition !== 'exodoncia_realizada';

  return {
    toothNumber: toothNum,
    isPresent,
    surfaces,
    generalNotes: toothBackend ? JSON.stringify({ condition: toothBackend.condition, severity: toothBackend.severity }) : '',
  };
}

// ── Deserializar del API a ToothState ───────────────────────────────
export function deserializeToothState(apiTooth: {
  toothNumber: number;
  isPresent?: boolean;
  surfaces?: Array<{ surface: string; condition: string; severity?: number }>;
  generalNotes?: string;
}): ToothState {
  const surfaces: Record<Surface, SurfaceCondition> = { ...EMPTY_SURFACES };

  if (apiTooth.surfaces) {
    for (const s of apiTooth.surfaces) {
      const key = s.surface.charAt(0).toUpperCase() as Surface;
      if (key in surfaces) {
        surfaces[key] = backendToSurfaceCondition(s.condition, s.severity ?? 2);
      }
    }
  }

  let condition: ToothCondition = 'none';

  // Intentar parsear generalNotes como JSON de condición de diente
  if (apiTooth.generalNotes) {
    try {
      const parsed = JSON.parse(apiTooth.generalNotes);
      if (parsed.condition) {
        condition = backendToToothCondition(parsed.condition, parsed.severity ?? 2);
      }
    } catch {
      // No es JSON, ignorar
    }
  }

  // Si isPresent es false y no tiene condición, marcar como ausente
  if (apiTooth.isPresent === false && condition === 'none') {
    condition = 'diente_ausente';
  }

  return { surfaces, condition };
}
