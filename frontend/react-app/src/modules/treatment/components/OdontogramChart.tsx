import { OrbitControls } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

type Surface = 'O' | 'V' | 'L' | 'M' | 'D';
type ViewMode = '2d' | '3d';
type ToothKind = 'central-incisor' | 'lateral-incisor' | 'canine' | 'premolar' | 'molar';

/* ── Constantes del arco dental parabólico ────────────────────── */
const ARCH_WIDTH = 3.10; // Un poco más ancho
const ARCH_DEPTH = 3.30; // Menos profundo, más parabólico
const ARCH_SPAN  = Math.PI * 0.85;

/** Genera puntos de un arco parabólico anatómico */
function getArchPoint(theta: number, archRx: number, archRz: number): THREE.Vector3 {
  const x = Math.sin(theta) * archRx;
  // Curva de potencia para una "U" natural (parábola)
  const z = -Math.pow(Math.abs(Math.sin(theta)), 2.0) * archRz;
  return new THREE.Vector3(x, 0, z);
}

/* ── Encía festoneada (TubeGeometry con ondulación Y) ─────────── */
const GumArch: React.FC<{
  archRx: number; archRz: number; archSpan: number;
  y: number; jaw: 'upper' | 'lower';
  toothThetas: number[];
}> = ({ archRx, archRz, archSpan, y, jaw, toothThetas }) => {
  const isUpper = jaw === 'upper';

  const bodyGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const waveAmp = 0.12;

    for (let i = 0; i <= 140; i++) {
      const ratio = i / 140;
      const theta = (ratio - 0.5) * archSpan;
      
      // Encontrar la distancia al centro del diente más cercano
      let minDist = 100;
      toothThetas.forEach(tTheta => {
        const d = Math.abs(theta - tTheta);
        if (d < minDist) minDist = d;
      });

      // El valle (punto más bajo/alto de encía) está en el centro del diente
      // El pico (papila) está entre los dientes. 
      // Aproximamos la ondulación basándonos en la distancia al diente más cercano.
      // Distancia típica entre centros es aprox archSpan / toothCount
      const avgGap = archSpan / toothThetas.length;
      const wave = Math.cos((minDist / avgGap) * Math.PI) * waveAmp;
      const yWavy = isUpper ? y - wave : y + wave;

      const p = getArchPoint(theta, archRx, archRz);
      pts.push(new THREE.Vector3(p.x, yWavy, p.z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 160, 0.82, 16, false);
  }, [archRx, archRz, archSpan, y, isUpper, toothThetas]);

  const marginGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const waveAmp = 0.08;

    for (let i = 0; i <= 140; i++) {
      const ratio = i / 140;
      const theta = (ratio - 0.5) * archSpan;
      
      let minDist = 100;
      toothThetas.forEach(tTheta => {
        const d = Math.abs(theta - tTheta);
        if (d < minDist) minDist = d;
      });

      const avgGap = archSpan / toothThetas.length;
      const wave = Math.cos((minDist / avgGap) * Math.PI) * waveAmp;
      const yWavy = isUpper ? y - wave : y + wave;

      const p = getArchPoint(theta, archRx, archRz);
      pts.push(new THREE.Vector3(p.x, yWavy, p.z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 160, 0.28, 14, false);
  }, [archRx, archRz, archSpan, y, isUpper, toothThetas]);

  return (
    <group>
      <mesh geometry={bodyGeo} position={[0, 0, -0.22]} receiveShadow castShadow>
        <meshStandardMaterial color={GINGIVA} roughness={0.8} metalness={0.01} />
      </mesh>
      <mesh geometry={marginGeo} position={[0, 0, 0.02]} castShadow receiveShadow>
        <meshStandardMaterial color={GINGIVA} roughness={0.6} metalness={0.02} />
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
        y += Math.max(0, 1.0 - dist * 2.2) * liftT * 0.18;
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
  kind: ToothKind; w: number; d: number; crownH: number; rootH: number; toothNum: number;
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
  const dims: Record<ToothKind, { w: number; d: number; crownH: number; rootH: number }> = {
    'central-incisor': { w: 0.94 * ts, d: 0.54 * ts, crownH: 1.10 * ts, rootH: 1.30 * ts },
    'lateral-incisor': { w: 0.80 * ts, d: 0.48 * ts, crownH: 1.05 * ts, rootH: 1.25 * ts },
    canine:            { w: 0.88 * ts, d: 0.64 * ts, crownH: 1.08 * ts, rootH: 1.60 * ts },
    premolar:          { w: 0.98 * ts, d: 0.82 * ts, crownH: 0.90 * ts, rootH: 1.20 * ts },
    molar:             { w: 1.18 * ts, d: 0.98 * ts, crownH: 0.85 * ts, rootH: 1.10 * ts },
  };
  const { w, d, crownH, rootH } = dims[toothKind];

  // Posición Y de la superficie oclusal (punta de corona extruida)
  const isInc = toothKind === 'central-incisor' || toothKind === 'lateral-incisor';
  const topY = toothKind === 'canine' ? crownH * 0.59 : isInc ? crownH * 0.54 : crownH * 0.52;

  const stopAndClick = (event: ThreeEvent<PointerEvent>, surface: Surface) => {
    event.stopPropagation();
    click(surface);
  };

  // Superior: corona apunta hacia abajo (rotX=PI), inferior: hacia arriba
  const rotX = jaw === 'upper' ? Math.PI : 0;

  // Desplazar el diente hacia la cúspide para enterrar la base en la encía
  // 48% de la altura queda enterrada para un nacimiento natural
  const yOffset = crownH * 0.48;

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
          rootH={rootH}
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
  const archRx = isTemporary ? 2.3 : ARCH_WIDTH;
  const archRz = isTemporary ? 2.4 : ARCH_DEPTH;
  const archSpan = ARCH_SPAN;

  // 1. Obtener tipos y anchos para calcular distribución natural
  const toothData = useMemo(() => {
    return numbers.map(n => {
      const kind = getToothKind(n, isTemporary);
      // Estos anchos deben coincidir con los de dims en Tooth3D
      let w = 0;
      if (kind === 'central-incisor') w = 0.94;
      else if (kind === 'lateral-incisor') w = 0.80;
      else if (kind === 'canine') w = 0.88;
      else if (kind === 'premolar') w = 0.98;
      else w = 1.18;
      return { number: n, kind, w: w * ts };
    });
  }, [numbers, isTemporary, ts]);

  // 2. Calcular posiciones (theta) basadas en anchos acumulados
  // Queremos que los dientes se toquen, por lo que la distancia entre centros
  // es (w1/2 + w2/2) * factor_de_contacto
  const positions = useMemo(() => {
    const posMap: Record<number, { theta: number; w: number }> = {};
    const totalW = toothData.reduce((acc, t) => acc + t.w, 0);
    // spFactor = 1.0 para que los dientes se toquen perfectamente basándose en sus anchos
    const spFactor = 1.0; 
    
    let currentW = 0;
    toothData.forEach((t) => {
      const centerW = currentW + t.w * 0.5;
      const ratio = centerW / totalW;
      const theta = (ratio - 0.5) * archSpan * spFactor;
      posMap[t.number] = { theta, w: t.w };
      currentW += t.w;
    });
    return posMap;
  }, [toothData, archSpan]);

  const maxShift = 1.8;
  const yShift = jaw === 'upper' ? jawOpen * maxShift : -jawOpen * maxShift;
  const zShift = jaw === 'upper' ? 0.15 : 0; 

  const avgCrownH = isTemporary ? 0.90 * 0.86 : 0.90;
  const toothYOffset = avgCrownH * 0.48; 
  const gumY = jaw === 'upper'
    ? y + toothYOffset + avgCrownH * 0.02
    : y - toothYOffset - avgCrownH * 0.02;

  const toothThetas = useMemo(() => Object.values(positions).map(p => p.theta), [positions]);

  return (
    <group position={[0, yShift, zShift]}>
      {/* Encía — se mueve junto con los dientes */}
      <GumArch
        archRx={archRx}
        archRz={archRz}
        archSpan={archSpan}
        y={gumY}
        jaw={jaw}
        toothThetas={toothThetas}
      />
      {numbers.map((n) => {
        const { theta } = positions[n];
        const p = getArchPoint(theta, archRx, archRz);
        const rotationY = -theta * 0.95;

        return (
          <Tooth3D
            key={n}
            number={n}
            isTemporary={isTemporary}
            conditions={toothStates[n]}
            onSurfaceClick={onToothClick}
            position={[p.x, y, p.z]}
            rotationY={rotationY}
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
                y={0.34}
                jaw="upper"
                jawOpen={jawOpen}
                toothStates={toothStates}
                onToothClick={onToothClick}
                markMode={markMode}
              />
              <DentalArch3D
                numbers={[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]}
                y={-0.34}
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
                y={0.28}
                jaw="upper"
                jawOpen={jawOpen}
                isTemporary
                toothStates={toothStates}
                onToothClick={onToothClick}
                markMode={markMode}
              />
              <DentalArch3D
                numbers={[85, 84, 83, 82, 81, 71, 72, 73, 74, 75]}
                y={-0.28}
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
