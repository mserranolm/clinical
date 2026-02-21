import { OrbitControls } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

type Surface = 'O' | 'V' | 'L' | 'M' | 'D';
type ViewMode = '2d' | '3d';
type ToothKind = 'central-incisor' | 'lateral-incisor' | 'canine' | 'premolar' | 'molar';

/** Genera puntos de un arco parabólico anatómico (Catenaria/Parábola) */
function getArchPoint(t: number, scale: number = 1): THREE.Vector3 {
  // t es la posición X aproximada a lo largo del arco (0 en el centro)
  const x = t * scale;
  // Parábola: z = -a * x^2
  // Ajustamos el coeficiente para la forma de la arcada
  const z = -0.38 * Math.pow(Math.abs(x), 2.1) * (1/scale);
  return new THREE.Vector3(x, 0, z);
}

/* ── Encía festoneada (TubeGeometry con ondulación Y) ─────────── */
const GumArch: React.FC<{
  toothPositions: { x: number, z: number, w: number }[];
  y: number; jaw: 'upper' | 'lower';
}> = ({ toothPositions, y, jaw }) => {
  const isUpper = jaw === 'upper';

  const { curvePoints, marginPoints } = useMemo(() => {
    if (toothPositions.length === 0) return { curvePoints: [], marginPoints: [] };

    // Crear una curva que pase por todos los dientes
    // Ordenamos por X (aunque ya deberían venir ordenados por el cálculo de DentalArch3D)
    // Pero DentalArch3D los calcula por cuadrantes, así que el orden en la lista puede no ser lineal de izq a der.
    // Mejor ordenarlos por X para trazar la curva correctamente.
    const sortedTeeth = [...toothPositions].sort((a, b) => a.x - b.x);

    const points: THREE.Vector3[] = [];
    const margins: THREE.Vector3[] = [];
    
    // Interpolación para suavidad: recorrer desde el primer diente hasta el último
    const minX = sortedTeeth[0].x - 0.5;
    const maxX = sortedTeeth[sortedTeeth.length-1].x + 0.5;
    const totalLen = maxX - minX;
    
    // Usamos más puntos para una curva suave
    for (let i = 0; i <= 200; i++) {
      const tX = minX + (i / 200) * totalLen;
      
      // Encontrar la posición Z base usando la misma función que los dientes
      const p = getArchPoint(tX, 1);
      
      // Calcular ondulación (festoneado)
      let closestDist = 100;
      let closestToothW = 1.0;
      
      for (const tp of sortedTeeth) {
        const dist = Math.abs(tX - tp.x);
        if (dist < closestDist) {
          closestDist = dist;
          closestToothW = tp.w;
        }
      }
      
      // Normalizamos la distancia: 0 en centro diente, 1 en borde (w/2)
      // Ampliamos un poco el rango (0.6 * w) para que las papilas se toquen
      const normDist = Math.min(1, closestDist / (closestToothW * 0.5));
      // Función de forma de festón más pronunciada (parabólica)
      const waveShape = Math.pow(Math.sin(normDist * Math.PI * 0.5), 2.0);
      
      const waveAmp = 0.22; // Papilas más largas y saludables
      
      let waveY = y;
      if (isUpper) {
        // Upper: Cenit arriba (base), Papila abajo (incisal)
        waveY = y - waveAmp * waveShape; 
      } else {
        // Lower: Cenit abajo (base), Papila arriba (incisal)
        waveY = y + waveAmp * waveShape;
      }

      points.push(new THREE.Vector3(p.x, waveY, p.z));
      margins.push(new THREE.Vector3(p.x, waveY, p.z));
    }
    
    return { curvePoints: points, marginPoints: margins };
  }, [toothPositions, y, isUpper]);

  const bodyGeo = useMemo(() => {
    // El cuerpo alveolar está desplazado hacia la raíz para no cubrir la corona
    // Upper: desplazar hacia arriba (+Y). Lower: hacia abajo (-Y).
    const bodyPts = curvePoints.map(p => new THREE.Vector3(p.x, isUpper ? p.y + 0.5 : p.y - 0.5, p.z - 0.1));
    const curve = new THREE.CatmullRomCurve3(bodyPts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 200, 1, 16, false);
  }, [curvePoints, isUpper]);

  const marginGeo = useMemo(() => {
    if (marginPoints.length === 0) return new THREE.BufferGeometry();
    const curve = new THREE.CatmullRomCurve3(marginPoints, false, 'catmullrom', 0.5);
    // Margen fino (rodete gingival)
    return new THREE.TubeGeometry(curve, 200, 0.12, 14, false);
  }, [marginPoints]);

  return (
    <group>
      <mesh geometry={bodyGeo} receiveShadow castShadow>
        <meshStandardMaterial color={GINGIVA} roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh geometry={marginGeo} position={[0, 0, 0.05]} castShadow receiveShadow>
        <meshStandardMaterial color={GINGIVA} roughness={0.3} metalness={0.05} />
      </mesh>
    </group>
  );
};

const CONDITION_COLORS: Record<string, string> = {
  none:      '#ffffff',
  caries:    '#ef4444',
  restored:  '#3b82f6',
  completed: '#10b981',
};

const CONDITION_STROKE: Record<string, string> = {
  none:      '#cbd5e1',
  caries:    '#dc2626',
  restored:  '#2563eb',
  completed: '#059669',
};

const EMPTY_SURFACES: Record<Surface, string> = { O: 'none', V: 'none', L: 'none', M: 'none', D: 'none' };

const getToothKind = (toothNumber: number, isTemporary?: boolean): ToothKind => {
  const unit = toothNumber % 10;
  if (unit === 1) return 'central-incisor';
  if (unit === 2) return 'lateral-incisor';
  if (unit === 3) return 'canine';
  if (isTemporary) return 'molar';
  if (unit <= 5) return 'premolar';
  return 'molar';
};

interface ToothProps {
  number: number;
  conditions?: Record<Surface, string>;
  onSurfaceClick?: (toothNumber: number, surface: Surface) => void;
  isTemporary?: boolean;
  arch?: 'upper' | 'lower' | 'temp';
}

const Tooth: React.FC<ToothProps> = ({
  number,
  conditions = {} as Record<Surface, string>,
  onSurfaceClick,
  isTemporary,
  arch = 'upper',
}) => {
  const get = (s: Surface) => conditions[s] ?? 'none';
  const click = (s: Surface) => onSurfaceClick?.(number, s);
  const size = isTemporary ? 44 : 56;
  const enamelGradientId = `enamel-${arch}-${number}`;

  return (
    <div className={`odn-tooth odn-tooth--${arch}`} style={{ width: size, flexShrink: 0 }}>
      <span className="odn-tooth-num" style={{ fontSize: isTemporary ? '0.55rem' : '0.62rem' }}>{number}</span>
      <svg
        viewBox="0 0 64 72"
        width={size}
        height={size}
        className="odn-tooth-svg"
      >
        <defs>
          <linearGradient id={enamelGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>

        <path
          d="M11 12 C14 6, 50 6, 53 12 L56 28 C58 44, 52 62, 32 66 C12 62, 6 44, 8 28 Z"
          fill={`url(#${enamelGradientId})`}
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />

        <path
          d="M20 13 C24 10, 40 10, 44 13"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="1.3"
          fill="none"
        />

        {/* Vestibular — top */}
        <polygon
          points="14,16 50,16 43,26 21,26"
          fill={CONDITION_COLORS[get('V')]}
          stroke={CONDITION_STROKE[get('V')]}
          strokeWidth="1.5"
          onClick={() => click('V')}
          className="odn-surface"
        />
        {/* Lingual — bottom */}
        <polygon
          points="18,50 46,50 40,60 24,60"
          fill={CONDITION_COLORS[get('L')]}
          stroke={CONDITION_STROKE[get('L')]}
          strokeWidth="1.5"
          onClick={() => click('L')}
          className="odn-surface"
        />
        {/* Mesial — left */}
        <polygon
          points="14,16 21,26 24,50 18,60 12,50 10,30"
          fill={CONDITION_COLORS[get('M')]}
          stroke={CONDITION_STROKE[get('M')]}
          strokeWidth="1.5"
          onClick={() => click('M')}
          className="odn-surface"
        />
        {/* Distal — right */}
        <polygon
          points="50,16 43,26 40,50 46,60 52,50 54,30"
          fill={CONDITION_COLORS[get('D')]}
          stroke={CONDITION_STROKE[get('D')]}
          strokeWidth="1.5"
          onClick={() => click('D')}
          className="odn-surface"
        />
        {/* Occlusal — center */}
        <rect
          x="22" y="27" width="20" height="22" rx="4"
          fill={CONDITION_COLORS[get('O')]}
          stroke={CONDITION_STROKE[get('O')]}
          strokeWidth="1.5"
          onClick={() => click('O')}
          className="odn-surface"
        />
      </svg>
    </div>
  );
};

/* ── Main chart ─────────────────────────────────────────────── */
export const OdontogramChart: React.FC<{
  toothStates?: Record<number, Record<Surface, string>>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
  patientAge?: number | null;
}> = ({ toothStates = {}, onToothClick, patientAge }) => {
  const isChildProfile = typeof patientAge === 'number' && patientAge >= 0 && patientAge < 12;
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [jawOpen, setJawOpen] = useState(false);
  const [markMode, setMarkMode] = useState(false);
  const [hideTemporary, setHideTemporary] = useState(!isChildProfile);
  const showTemporary = !hideTemporary;
  const showPermanent = !isChildProfile || hideTemporary;

  useEffect(() => {
    setHideTemporary(!isChildProfile);
  }, [isChildProfile]);

  return (
    <div className="odn-mode-wrapper">
      <div className="odn-view-switch" role="tablist" aria-label="Modo de visualizacion del odontograma">
        <button
          type="button"
          className={`odn-view-btn ${viewMode === '2d' ? 'active' : ''}`}
          onClick={() => setViewMode('2d')}
        >
          Vista 2D clinica
        </button>
        <button
          type="button"
          className={`odn-view-btn ${viewMode === '3d' ? 'active' : ''}`}
          onClick={() => setViewMode('3d')}
        >
          Vista 3D anatomica
        </button>
      </div>

      <div className="odn-visibility-controls">
        <label className="odn-toggle-check" htmlFor="odn-hide-temp">
          <input
            id="odn-hide-temp"
            type="checkbox"
            checked={hideTemporary}
            onChange={(event) => setHideTemporary(event.target.checked)}
          />
          <span>Ocultar dientes temporales</span>
        </label>
        <small className="odn-profile-hint">
          Perfil por edad: {isChildProfile ? 'nino' : 'adulto'}
        </small>
      </div>

      {viewMode === '3d' && (
        <div className="odn-3d-toolbar">
          <button
            type="button"
            className={`odn-jaw-btn ${jawOpen ? 'open' : ''}`}
            onClick={() => setJawOpen(v => !v)}
          >
            {jawOpen ? '🦷 Cerrar boca' : '🦷 Abrir boca'}
          </button>
          <label className={`odn-toggle-check odn-mark-mode-toggle ${markMode ? 'active' : ''}`} htmlFor="odn-mark-mode">
            <input
              id="odn-mark-mode"
              type="checkbox"
              checked={markMode}
              onChange={(event) => setMarkMode(event.target.checked)}
            />
            <span>✏️ Marcar caras</span>
          </label>
        </div>
      )}

      {viewMode === '2d' ? (
        <Odontogram2D
          toothStates={toothStates}
          onToothClick={onToothClick}
          showTemporary={showTemporary}
          showPermanent={showPermanent}
        />
      ) : (
        <Odontogram3D
          toothStates={toothStates}
          onToothClick={onToothClick}
          jawOpen={jawOpen ? 1 : 0}
          showTemporary={showTemporary}
          showPermanent={showPermanent}
          markMode={markMode}
        />
      )}
    </div>
  );
};
/* ── Colores ─────────────────────────────────────────────────── */
const ENAMEL = '#fdfaf0'; // Blanco marfil más limpio y brillante
const GINGIVA = '#e88a9a'; // Rosado encía más natural y suave

function makeAnatomicalToothGeo(w: number, h: number, d: number, kind: ToothKind, seed: number = 0): THREE.BufferGeometry {
  const radSeg = 44;
  const hSeg = 36;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, radSeg, hSeg, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  
  const isInc = kind === 'central-incisor' || kind === 'lateral-incisor';

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i); 
    let z = pos.getZ(i);
    
    const yNorm = (y + 0.5); 
    const angle = Math.atan2(z, x);
    
    // 1. Sección transversal superelíptica anatómica
    // Incisivos: más planos, Molares: más cuadrados
    const p = kind === 'molar' ? 5.0 : kind === 'premolar' ? 4.5 : 2.6;
    const absCos = Math.pow(Math.abs(Math.cos(angle)), p);
    const absSin = Math.pow(Math.abs(Math.sin(angle)), p);
    let r = 1.0 / Math.pow(absCos + absSin, 1/p);
    
    // Facetas de contacto laterales (mesial/distal)
    // Aplanamos los lados para que los dientes se toquen en una superficie, no en un punto
    const sideFactor = Math.abs(Math.cos(angle));
    if (sideFactor > 0.6) {
      const flatten = 1.0 + (sideFactor - 0.6) * 0.35;
      r *= flatten;
    }

    // 2. Cuello dental (emergencia gingival)
    // El cuello es la parte más estrecha para una integración real con la encía
    const neckScale = kind === 'molar' ? 0.85 : 0.55;
    const taper = neckScale + (1.0 - neckScale) * Math.pow(yNorm, 0.35);
    
    // 3. Perfil sagital (espesor)
    let dTaper = 1.0;
    if (isInc || kind === 'canine') {
      dTaper = 1.0 - Math.pow(yNorm, 3.0) * 0.90; 
      // Forma de pala para incisivos (concavidad lingual)
      if (z < -0.02 && isInc && yNorm > 0.2) {
        const concavity = Math.sin((yNorm - 0.2) / 0.8 * Math.PI) * (d * 0.35);
        z += concavity * (1.0 - Math.pow(x / (w * 0.45), 2));
      }
    } else {
      dTaper = 1.0 - Math.pow(yNorm, 4.0) * 0.25;
    }

    x = Math.cos(angle) * r * (w * 0.5) * taper;
    z = Math.sin(angle) * r * (d * 0.5) * taper * dTaper;

    // 4. Abombado labial (vestibular) - Máximo en el tercio medio
    if (z > 0) {
      const bulge = Math.sin(yNorm * Math.PI * 0.85) * (d * 0.25);
      z += bulge * (1.0 - Math.pow(x / (w * 0.55), 2));
    }

    // 5. Detalles oclusales esculpidos
    if (yNorm > 0.6) {
      const liftT = (yNorm - 0.6) / 0.4;
      if (kind === 'canine') {
        const dist = Math.sqrt(x*x + z*z) / (w * 0.4);
        y += Math.max(0, 1.0 - dist * 2.2) * liftT * 0.12;
      } else if (isInc) {
        const edgeCurve = Math.cos(x / (w * 0.55) * Math.PI * 0.5);
        y += edgeCurve * liftT * 0.06;
      } else if (kind === 'molar' || kind === 'premolar') {
        const nx = x / (w * 0.5);
        const nz = z / (d * 0.5);
        const c1 = Math.max(0, 1 - Math.sqrt(Math.pow(nx-0.5, 2) + Math.pow(nz-0.5, 2)) * 3.5);
        const c2 = Math.max(0, 1 - Math.sqrt(Math.pow(nx+0.5, 2) + Math.pow(nz-0.5, 2)) * 3.5);
        const c3 = Math.max(0, 1 - Math.sqrt(Math.pow(nx-0.5, 2) + Math.pow(nz+0.5, 2)) * 3.5);
        const c4 = Math.max(0, 1 - Math.sqrt(Math.pow(nx+0.5, 2) + Math.pow(nz+0.5, 2)) * 3.5);
        
        const groove = (Math.max(0, 1 - Math.abs(nx) * 8) + Math.max(0, 1 - Math.abs(nz) * 8)) * 0.08;
        const pit = Math.max(0, 1 - (Math.abs(nx) * 3 + Math.abs(nz) * 3)) * 0.25;
        
        const m = kind === 'molar' ? 0.15 : 0.20;
        y += ((c1 + c2 + (kind === 'molar' ? c3 + c4 : 0)) - (pit + groove)) * liftT * m;
      }
    }

    // Micro-variación sutil orgánica
    const noise = (Math.sin(x * 25 + seed) * Math.cos(z * 20 + seed)) * 0.005;
    pos.setXYZ(i, x + noise, y * h, z + noise);
  }
  
  geo.computeVertexNormals();
  return geo;
}

/* ── OrganicTooth: Geometría anatómica procedural ────────────── */
const OrganicTooth: React.FC<{
  kind: ToothKind; w: number; d: number; crownH: number; toothNum: number;
}> = ({ kind, w, d, crownH, toothNum }) => {
  const bodyGeo = useMemo(() => makeAnatomicalToothGeo(w, crownH, d, kind, toothNum), [w, crownH, d, kind, toothNum]);

  return (
    <group>
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshStandardMaterial 
          color={ENAMEL} 
          roughness={0.10} 
          metalness={0.06}
          envMapIntensity={1.4}
        />
      </mesh>
    </group>
  );
};


/* ── Tooth3D ─────────────────────────────────────────────────── */
interface Tooth3DProps {
  number: number;
  conditions?: Record<Surface, string>;
  onSurfaceClick?: (toothNumber: number, surface: Surface) => void;
  isTemporary?: boolean;
  position: [number, number, number];
  rotationY?: number;
  jaw: 'upper' | 'lower';
  markMode?: boolean;
}

const Tooth3D: React.FC<Tooth3DProps> = ({
  number,
  conditions = EMPTY_SURFACES,
  onSurfaceClick,
  isTemporary,
  position,
  rotationY = 0,
  jaw,
  markMode = false,
}) => {
  const get = (s: Surface) => conditions[s] ?? 'none';
  const click = (s: Surface) => onSurfaceClick?.(number, s);
  const toothKind = getToothKind(number, isTemporary);
  const ts = isTemporary ? 0.86 : 1;

  // Dimensiones anatómicas por tipo (en unidades de escena)
  const dims: Record<ToothKind, { w: number; d: number; crownH: number }> = {
    'central-incisor': { w: 0.94 * ts, d: 0.54 * ts, crownH: 1.10 * ts },
    'lateral-incisor': { w: 0.80 * ts, d: 0.48 * ts, crownH: 1.05 * ts },
    canine:            { w: 0.88 * ts, d: 0.64 * ts, crownH: 1.04 * ts },
    premolar:          { w: 0.98 * ts, d: 0.82 * ts, crownH: 0.90 * ts },
    molar:             { w: 1.18 * ts, d: 0.98 * ts, crownH: 0.85 * ts },
  };
  const { w, d, crownH } = dims[toothKind];

  // Posición Y de la superficie oclusal (punta de corona extruida)
  const topY = toothKind === 'canine' ? crownH * 0.59 : toothKind === 'central-incisor' || toothKind === 'lateral-incisor' ? crownH * 0.54 : crownH * 0.52;

  const stopAndClick = (event: ThreeEvent<PointerEvent>, surface: Surface) => {
    event.stopPropagation();
    click(surface);
  };

  // Superior: corona apunta hacia abajo (rotX=PI), inferior: hacia arriba
  const rotX = jaw === 'upper' ? Math.PI : 0;

  // Desplazar el diente hacia la cúspide para enterrar la base en la encía
  // 20% de la altura queda desplazada (suficiente para que no flote, pero visible)
  const yOffset = crownH * 0.20; 

  // Variación natural: cada diente tiene una ligera rotación y posición única
  const seed = number * 1.48;
  const randRot = (Math.sin(seed) * 0.04);
  const randOff = (Math.cos(seed) * 0.02);

  return (
    <group position={[position[0] + randOff, position[1], position[2] + randOff]} rotation={[rotX, rotationY + randRot, 0]}>
      {/* Todo el diente (malla + superficies) desplazado para enterrar la base */}
      <group position={[0, yOffset, 0]}>
        <OrganicTooth
          kind={toothKind}
          w={w} d={d}
          crownH={crownH}
          toothNum={number}
        />

        {/* Superficies interactivas (dentro del offset para seguir al diente) */}
        {markMode && (
          <>
            {/* Oclusal / Incisal */}
            <mesh
              position={[0, topY, 0]}
              onPointerDown={(e) => stopAndClick(e, 'O')}
            >
              <boxGeometry args={[w * 0.7, 0.06, d * 0.7]} />
              <meshStandardMaterial color={CONDITION_COLORS[get('O')]} roughness={0.45} metalness={0.02} transparent opacity={0.82} />
            </mesh>
            {/* Vestibular */}
            <mesh
              position={[0, 0, d * 0.52]}
              onPointerDown={(e) => stopAndClick(e, 'V')}
            >
              <boxGeometry args={[w * 0.7, crownH * 0.55, 0.06]} />
              <meshStandardMaterial color={CONDITION_COLORS[get('V')]} roughness={0.45} metalness={0.02} transparent opacity={0.82} />
            </mesh>
            {/* Lingual/Palatino */}
            <mesh
              position={[0, 0, -d * 0.52]}
              onPointerDown={(e) => stopAndClick(e, 'L')}
            >
              <boxGeometry args={[w * 0.7, crownH * 0.55, 0.06]} />
              <meshStandardMaterial color={CONDITION_COLORS[get('L')]} roughness={0.45} metalness={0.02} transparent opacity={0.82} />
            </mesh>
            {/* Mesial */}
            <mesh
              position={[-w * 0.52, 0, 0]}
              onPointerDown={(e) => stopAndClick(e, 'M')}
            >
              <boxGeometry args={[0.06, crownH * 0.55, d * 0.7]} />
              <meshStandardMaterial color={CONDITION_COLORS[get('M')]} roughness={0.45} metalness={0.02} transparent opacity={0.82} />
            </mesh>
            {/* Distal */}
            <mesh
              position={[w * 0.52, 0, 0]}
              onPointerDown={(e) => stopAndClick(e, 'D')}
            >
              <boxGeometry args={[0.06, crownH * 0.55, d * 0.7]} />
              <meshStandardMaterial color={CONDITION_COLORS[get('D')]} roughness={0.45} metalness={0.02} transparent opacity={0.82} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

const DentalArch3D: React.FC<{
  numbers: number[];
  y: number;
  jaw: 'upper' | 'lower';
  jawOpen: number;
  isTemporary?: boolean;
  toothStates: Record<number, Record<Surface, string>>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
  markMode?: boolean;
}> = ({ numbers, y, jaw, jawOpen, isTemporary, toothStates, onToothClick, markMode }) => {
  const ts = isTemporary ? 0.86 : 1;

  // 1. Calcular distribución natural basada en anchos reales
  const { positions, toothPosList } = useMemo(() => {
    const posMap: Record<number, { x: number; z: number; rotY: number; w: number; kind: ToothKind }> = {};
    const posList: { x: number, z: number, w: number }[] = [];
    
    // Separar por cuadrantes para calcular desde la línea media
    // Ordenar: línea media -> atrás
    const sortedNumbers = [...numbers].sort((a, b) => {
      const unitA = a % 10;
      const unitB = b % 10;
      return unitA - unitB; // 1 (central) a 8 (molar)
    });

    // Dividir en izquierda (x > 0) y derecha (x < 0)
    // FDI: 1x, 5x (derecha paciente -> izquierda pantalla? No, ThreeJS x+)
    // 1x, 4x, 5x, 8x -> Derecha del paciente (X negativo en mi sistema si 11 está en 0?)
    // Vamos a asumir: 11, 21 son centrales.
    // 1x, 5x: Derecha paciente -> X negativo
    // 2x, 6x: Izquierda paciente -> X positivo
    // 4x, 8x: Derecha paciente -> X negativo
    // 3x, 7x: Izquierda paciente -> X positivo
    
    const leftSide = sortedNumbers.filter(n => { const q = Math.floor(n/10); return q === 2 || q === 3 || q === 6 || q === 7; });
    const rightSide = sortedNumbers.filter(n => { const q = Math.floor(n/10); return q === 1 || q === 4 || q === 5 || q === 8; });

    // Función para posicionar un lado
    const placeSide = (teeth: number[], sign: number) => {
      let currentX = 0.0; // Empezar en línea media
      
      teeth.forEach((n, idx) => {
        const kind = getToothKind(n, isTemporary);
        let w = 0;
        // Anchos anatómicos
        if (kind === 'central-incisor') w = 0.96;
        else if (kind === 'lateral-incisor') w = 0.82;
        else if (kind === 'canine') w = 0.90;
        else if (kind === 'premolar') w = 0.98;
        else w = 1.20;
        w *= ts;

        // Gap mínimo para papila (ajustado para contacto estrecho)
        // Primer diente (central) se aleja muy poco de la línea media
        const gap = idx === 0 ? w * 0.505 : w * 0.5; 
        currentX += gap;
        
        // Posición en la curva parabólica
        const xPos = currentX * sign;
        const p = getArchPoint(xPos, 1); // Usamos xPos directamente como t
        
        // Calcular rotación basada en la tangente de la curva
        // Derivada de z = -0.38 * x^2.1
        // dz/dx approx -0.8 * x.
        const dzdx = -0.38 * 2.1 * Math.sign(p.x) * Math.pow(Math.abs(p.x), 1.1);
        const tanAngle = Math.atan(dzdx);
        const rotY = -tanAngle; 

        posMap[n] = { x: p.x, z: p.z, rotY, w, kind };
        posList.push({ x: p.x, z: p.z, w });
        
        currentX += w * 0.5; // Sin espacio extra, contacto puro
      });
    };

    placeSide(leftSide, 1);
    placeSide(rightSide, -1);

    return { positions: posMap, toothPosList: posList };
  }, [numbers, isTemporary, ts]);

  const maxShift = 1.8;
  const yShift = jaw === 'upper' ? jawOpen * maxShift : -jawOpen * maxShift;
  const zShift = jaw === 'upper' ? 0.15 : 0; 

  const avgCrownH = isTemporary ? 0.90 * 0.86 : 0.90;
  // La encía se posiciona ligeramente desplazada de la base calculada
  const gumY = jaw === 'upper'
    ? y + avgCrownH * 0.65 
    : y - avgCrownH * 0.65;

  return (
    <group position={[0, yShift, zShift]}>
      <GumArch
        toothPositions={toothPosList}
        y={gumY}
        jaw={jaw}
      />
      {numbers.map((n) => {
        const pos = positions[n];
        if (!pos) return null;

        return (
          <Tooth3D
            key={n}
            number={n}
            isTemporary={isTemporary}
            conditions={toothStates[n]}
            onSurfaceClick={onToothClick}
            position={[pos.x, y, pos.z]}
            rotationY={pos.rotY}
            jaw={jaw}
            markMode={markMode}
          />
        );
      })}
    </group>
  );
};

const Odontogram3D: React.FC<{
  toothStates: Record<number, Record<Surface, string>>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
  jawOpen: number;
  showTemporary: boolean;
  showPermanent: boolean;
  markMode: boolean;
}> = ({ toothStates, onToothClick, jawOpen, showTemporary, showPermanent, markMode }) => (
  <div className="odn-3d-shell">
    <Canvas shadows camera={{ position: [0, 0, 10.5], fov: 36 }}>
      <color attach="background" args={['#f8f9fa']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[0, 5, 10]} intensity={1.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-5, 2, 5]} intensity={0.4} color="#fff0e8" />
      <directionalLight position={[5, 2, 5]}  intensity={0.3} color="#e8f4ff" />
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#ffffff" />

      <Suspense fallback={null}>
        <group>
          {showPermanent && (
            <>
              <DentalArch3D
                numbers={[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]}
                y={0.68}
                jaw="upper"
                jawOpen={jawOpen}
                toothStates={toothStates}
                onToothClick={onToothClick}
                markMode={markMode}
              />
              <DentalArch3D
                numbers={[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]}
                y={-0.68}
                jaw="lower"
                jawOpen={jawOpen}
                toothStates={toothStates}
                onToothClick={onToothClick}
                markMode={markMode}
              />
            </>
          )}

          {showTemporary && (
            <>
              <DentalArch3D
                numbers={[55, 54, 53, 52, 51, 61, 62, 63, 64, 65]}
                y={0.62}
                jaw="upper"
                jawOpen={jawOpen}
                isTemporary
                toothStates={toothStates}
                onToothClick={onToothClick}
                markMode={markMode}
              />
              <DentalArch3D
                numbers={[85, 84, 83, 82, 81, 71, 72, 73, 74, 75]}
                y={-0.62}
                jaw="lower"
                jawOpen={jawOpen}
                isTemporary
                toothStates={toothStates}
                onToothClick={onToothClick}
                markMode={markMode}
              />
            </>
          )}
        </group>
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={16}
        target={[0, 0, 0]}
      />
    </Canvas>
  </div>
);

/* ── Quadrant label ─────────────────────────────────────────── */
const QuadrantLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="odn-quadrant-label">{label}</div>
);

/* ── Divider ────────────────────────────────────────────────── */
const HDivider: React.FC = () => <div className="odn-h-divider" />;
const VDivider: React.FC = () => <div className="odn-v-divider" />;

const Odontogram2D: React.FC<{
  toothStates?: Record<number, Record<Surface, string>>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
  showTemporary: boolean;
  showPermanent: boolean;
}> = ({ toothStates = {}, onToothClick, showTemporary, showPermanent }) => {

  const renderRow = (numbers: number[], rowClass: string, isTemp = false, arch: 'upper' | 'lower' | 'temp' = 'upper') => (
    <div className={`odn-row ${rowClass}`}>
      {numbers.map(n => (
        <Tooth
          key={n}
          number={n}
          isTemporary={isTemp}
          arch={arch}
          conditions={toothStates[n]}
          onSurfaceClick={onToothClick}
        />
      ))}
    </div>
  );

  return (
    <div className="odn-chart">
      <div className="odn-mouth-shell">
        {showPermanent && (
          <>
            {/* ── Upper arch ── */}
            <div className="odn-arch-label">SUPERIOR</div>
            <div className="odn-jaw odn-jaw--upper">
              <div className="odn-half">
                <QuadrantLabel label="Q1 — Sup. Derecho" />
                {renderRow([18, 17, 16, 15, 14, 13, 12, 11], 'odn-row--upper')}
              </div>
              <VDivider />
              <div className="odn-half">
                <QuadrantLabel label="Q2 — Sup. Izquierdo" />
                {renderRow([21, 22, 23, 24, 25, 26, 27, 28], 'odn-row--upper')}
              </div>
            </div>
          </>
        )}

        {showTemporary && (
          <>
            {/* ── Temporary teeth ── */}
            <div className="odn-temp-section">
              <div className="odn-arch-label odn-arch-label--temp">TEMPORALES</div>
              <div className="odn-jaw odn-jaw--temp">
                <div className="odn-half">
                  <div className="odn-temp-pair">
                    {renderRow([55, 54, 53, 52, 51], 'odn-row--temp-upper', true, 'temp')}
                    {renderRow([85, 84, 83, 82, 81], 'odn-row--temp-lower', true, 'temp')}
                  </div>
                </div>
                <VDivider />
                <div className="odn-half">
                  <div className="odn-temp-pair">
                    {renderRow([61, 62, 63, 64, 65], 'odn-row--temp-upper', true, 'temp')}
                    {renderRow([71, 72, 73, 74, 75], 'odn-row--temp-lower', true, 'temp')}
                  </div>
                </div>
              </div>
            </div>

            {showPermanent && <HDivider />}
          </>
        )}

        {showPermanent && (
          <>
            {/* ── Lower arch ── */}
            <div className="odn-jaw odn-jaw--lower">
              <div className="odn-half">
                <QuadrantLabel label="Q4 — Inf. Derecho" />
                {renderRow([48, 47, 46, 45, 44, 43, 42, 41], 'odn-row--lower', false, 'lower')}
              </div>
              <VDivider />
              <div className="odn-half">
                <QuadrantLabel label="Q3 — Inf. Izquierdo" />
                {renderRow([31, 32, 33, 34, 35, 36, 37, 38], 'odn-row--lower', false, 'lower')}
              </div>
            </div>
            <div className="odn-arch-label">INFERIOR</div>
          </>
        )}
      </div>
    </div>
  );
};
