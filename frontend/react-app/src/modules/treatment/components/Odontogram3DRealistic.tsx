import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { animated, useSpring } from "@react-spring/three";
import React, { Suspense, useCallback, useMemo, useState } from "react";
import * as THREE from "three";
import {
  EMPTY_SURFACES,
  type ToothState,
  toothConditionColor,
} from "./odontogram-types";
import {
  fdiFromMeshName,
  fdiToName,
  isUpperJaw,
  PERMANENT_FDI,
  TEMPORARY_FDI,
  toothKindOf,
  type ToothKind,
} from "./toothMapping";

const GLB_URL = "/models/dental-arch.glb";

/** Error boundary: si el GLTF crashea por cualquier razón, hacemos fallback al procedural. */
class GLTFErrorBoundary extends React.Component<
  { fallback: React.ReactNode; onError?: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Paleta clínica
const ENAMEL = "#fbf6e8";
const GINGIVA = "#d77c8a";

const CONDITION_TINT: Record<string, string | null> = {
  caries: "#ef4444",
  restauracion_buena: "#3b82f6",
  restauracion_defectuosa: "#dc2626",
  restauracion_provisional: "#f97316",
  sellante_indicado: "#fca5a5",
  sellante_realizado: "#93c5fd",
};

/** Color final del diente según condición + caras (mostrar la "peor" en el render). */
function toothDisplayColor(state: ToothState | undefined): string {
  if (!state) return ENAMEL;

  // Condición de diente completo prevalece
  const c = toothConditionColor(state.condition);
  if (c !== "transparent") return c;

  // Caras: si hay caries, mostrarlo
  const surfaces = state.surfaces ?? EMPTY_SURFACES;
  if (Object.values(surfaces).includes("caries")) return CONDITION_TINT.caries!;
  for (const cond of Object.values(surfaces)) {
    const tint = CONDITION_TINT[cond];
    if (tint) return tint;
  }
  return ENAMEL;
}

function isToothMeshName(name: string): boolean {
  return /tooth|diente|t_\d+/i.test(name);
}

function isGumMeshName(name: string): boolean {
  return /gum|gingiva|encia|tongue/i.test(name);
}

function isLowerName(name: string): boolean {
  return /lower|mandib|inf(?:erior)?/i.test(name);
}

// ─────────────────────────────────────────────────────────────────────────
// Variante 1 — GLTF realista (cuando exista /models/dental-arch.glb)
// ─────────────────────────────────────────────────────────────────────────

interface RealisticGLTFSceneProps {
  toothStates: Record<number, ToothState>;
  jawOpen: number;
  gumOpacity: number;
  hoveredFDI: number | null;
  selectedFDI: number | null;
  onToothHover: (fdi: number | null) => void;
  onToothClick: (fdi: number) => void;
}

/** Heurística: clasificar un mesh como diente vs encía vs lengua según color y nombre. */
function classifyMesh(mesh: THREE.Mesh): "tooth" | "gum" | "tongue" | "other" {
  const name = mesh.name.toLowerCase();
  if (/tongue|lengua/.test(name)) return "tongue";
  if (isToothMeshName(name)) return "tooth";
  if (isGumMeshName(name)) return "gum";

  // Fallback por color del material — encía suele ser rosa, dientes blancos.
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat && "color" in mat && mat.color) {
    const c = mat.color;
    const r = c.r;
    const g = c.g;
    const b = c.b;
    // Rosado/pinkish: rojo > verde, rojo > azul, no blanco brillante
    if (r > 0.5 && r > g + 0.05 && r > b + 0.05 && r < 0.95) return "gum";
    // Casi blanco / cálido marfil → diente
    if (r > 0.7 && g > 0.7 && b > 0.6) return "tooth";
  }
  return "other";
}

const RealisticGLTFScene: React.FC<RealisticGLTFSceneProps> = ({
  toothStates,
  jawOpen,
  gumOpacity,
  hoveredFDI,
  selectedFDI,
  onToothHover,
  onToothClick,
}) => {
  const { scene } = useGLTF(GLB_URL);

  // Clonamos la escena una sola vez para no mutar el cache de useGLTF.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Procesamiento principal: aislar UNA sola dentadura, indexar meshes y centrar la cámara.
  const { teethMeshes, gumMeshes, tongueMeshes, lowerMeshes, lowerPlanes, yEquator, sceneRoot } = useMemo(() => {
    const teeth: Record<number, THREE.Mesh> = {};
    const allMeshes: THREE.Mesh[] = [];
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) allMeshes.push(obj);
    });

    // Log diagnóstico
    console.groupCollapsed(`🦷 GLB cargado — ${allMeshes.length} meshes encontrados`);
    allMeshes.forEach((m) => {
      const bbox = new THREE.Box3().setFromObject(m);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      console.log(
        `${m.name || "<sin nombre>"} — center [${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}] size [${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}] → ${classifyMesh(m)}`,
      );
    });
    console.groupEnd();

    // Bounding box global ANTES de filtrar — para detectar outliers
    const globalBoxAll = new THREE.Box3();
    for (const m of allMeshes) globalBoxAll.expandByObject(m);
    const globalCenter = globalBoxAll.getCenter(new THREE.Vector3());
    const globalSize = globalBoxAll.getSize(new THREE.Vector3());

    // Filtrar outliers: meshes cuyo centro Z está muy lejos del cluster principal
    // (en este modelo, Cube.010/011/012 están a Z=-150)
    const filteredMeshes = allMeshes.filter((m) => {
      const bbox = new THREE.Box3().setFromObject(m);
      const center = bbox.getCenter(new THREE.Vector3());
      const dz = Math.abs(center.z - globalCenter.z);
      const isOutlier = dz > globalSize.z * 0.6;
      if (isOutlier) {
        m.visible = false;
        console.log(`🦷 Outlier oculto: "${m.name}" (dz=${dz.toFixed(1)})`);
      }
      return !isOutlier;
    });

    // Dedupe: meshes con bounding box idéntico → ocultar duplicados
    const seenBoxes = new Map<string, THREE.Mesh>();
    const dedupedMeshes: THREE.Mesh[] = [];
    for (const m of filteredMeshes) {
      const bbox = new THREE.Box3().setFromObject(m);
      const key = [
        bbox.min.x.toFixed(2), bbox.min.y.toFixed(2), bbox.min.z.toFixed(2),
        bbox.max.x.toFixed(2), bbox.max.y.toFixed(2), bbox.max.z.toFixed(2),
      ].join(",");
      const existing = seenBoxes.get(key);
      if (existing) {
        m.visible = false;
        console.log(`🦷 Duplicado oculto: "${m.name}" (bbox idéntico a "${existing.name}")`);
      } else {
        seenBoxes.set(key, m);
        dedupedMeshes.push(m);
      }
    }

    // Recalcular bounding box global con meshes ya filtrados
    const globalBox = new THREE.Box3();
    for (const m of dedupedMeshes) globalBox.expandByObject(m);
    const equator = (globalBox.min.y + globalBox.max.y) / 2;
    const totalH = globalBox.max.y - globalBox.min.y;

    const gums: THREE.Mesh[] = [];
    const tongue: THREE.Mesh[] = [];
    const lower: THREE.Mesh[] = [];
    const lowerClipPlanes: THREE.Plane[] = [];

    for (const mesh of dedupedMeshes) {
      const kind = classifyMesh(mesh);
      const bbox = new THREE.Box3().setFromObject(mesh);
      const sy = bbox.max.y - bbox.min.y;
      const centerY = (bbox.min.y + bbox.max.y) / 2;
      const spanRatio = sy / totalH;
      const isSpanning = spanRatio > 0.4 && bbox.min.y < equator && bbox.max.y > equator;

      if (isSpanning) {
        // Mesh que abarca arriba y abajo: cortar por el ecuador con clipping planes.
        // Mesh original → mitad superior (plano que mantiene y > equator)
        // Clon → mitad inferior (plano que mantiene y < equator + yShift, animable)
        const upperPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -equator);
        const lowerPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), equator);

        const origMat = mesh.material as THREE.MeshStandardMaterial;
        const upperMat = origMat.clone();
        upperMat.clippingPlanes = [upperPlane];
        upperMat.clipShadows = true;
        upperMat.side = THREE.DoubleSide; // evita huecos en el corte
        mesh.material = upperMat;

        const lowerMesh = mesh.clone();
        const lowerMat = origMat.clone();
        lowerMat.clippingPlanes = [lowerPlane];
        lowerMat.clipShadows = true;
        lowerMat.side = THREE.DoubleSide;
        lowerMesh.material = lowerMat;
        lowerMesh.name = `${mesh.name}_lowerHalf`;
        if (mesh.parent) mesh.parent.add(lowerMesh);

        if (kind === "gum") gums.push(mesh, lowerMesh);
        else if (kind === "tongue") tongue.push(lowerMesh);

        lower.push(lowerMesh);
        lowerClipPlanes.push(lowerPlane);
        console.log(`🦷 Spanning mesh "${mesh.name}" cortado por ecuador (sy=${sy.toFixed(1)}, ratio=${spanRatio.toFixed(2)})`);
      } else {
        const isLowerHalf = isLowerName(mesh.name) || centerY < equator;
        if (kind === "tooth") {
          const fdi = fdiFromMeshName(mesh.name);
          if (fdi !== null) teeth[fdi] = mesh;
          if (isLowerHalf || (fdi !== null && !isUpperJaw(fdi))) lower.push(mesh);
        } else if (kind === "gum") {
          gums.push(mesh);
          if (isLowerHalf) lower.push(mesh);
        } else if (kind === "tongue") {
          tongue.push(mesh);
          lower.push(mesh);
        } else if (isLowerHalf) {
          // "other" pero abajo del ecuador — animarlo igual
          lower.push(mesh);
        }
      }
    }

    console.log(
      `🦷 Clasificación: ${Object.keys(teeth).length} dientes con FDI · ${gums.length} encías · ${tongue.length} lenguas · ${lower.length} mitad inferior · ${lowerClipPlanes.length} planos animados`,
    );

    return {
      teethMeshes: teeth,
      gumMeshes: gums,
      tongueMeshes: tongue,
      lowerMeshes: lower,
      lowerPlanes: lowerClipPlanes,
      yEquator: equator,
      sceneRoot: cloned,
    };
  }, [cloned]);

  // Guardar la posición Y inicial de cada mesh inferior para animar desde su origen
  const initialYRef = React.useRef<Map<THREE.Mesh, number>>(new Map());
  React.useEffect(() => {
    const map = new Map<THREE.Mesh, number>();
    for (const m of lowerMeshes) map.set(m, m.position.y);
    initialYRef.current = map;
  }, [lowerMeshes]);

  // Centrar y normalizar la escala de la dentadura activa
  React.useEffect(() => {
    if (!sceneRoot) return;
    const box = new THREE.Box3().setFromObject(sceneRoot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetSize = 6; // unidades de escena
      const scale = targetSize / maxDim;
      sceneRoot.position.x -= center.x;
      sceneRoot.position.y -= center.y;
      sceneRoot.position.z -= center.z;
      sceneRoot.scale.setScalar(scale);
    }
  }, [sceneRoot]);

  // Aplicar color por estado a cada diente con FDI
  React.useEffect(() => {
    for (const [fdiStr, mesh] of Object.entries(teethMeshes)) {
      const fdi = Number(fdiStr);
      const color = toothDisplayColor(toothStates[fdi]);
      const isHover = hoveredFDI === fdi;
      const isSelected = selectedFDI === fdi;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && "color" in mat) {
        mat.color = new THREE.Color(color);
        mat.emissive = isSelected
          ? new THREE.Color("#2563eb")
          : isHover
            ? new THREE.Color("#3b82f6")
            : new THREE.Color("#000000");
        mat.emissiveIntensity = isSelected ? 0.35 : isHover ? 0.18 : 0;
        mat.needsUpdate = true;
      }
    }
  }, [teethMeshes, toothStates, hoveredFDI, selectedFDI]);

  // Aplicar opacidad a encía + lengua (la lengua también es tejido blando)
  React.useEffect(() => {
    const softTissues = [...gumMeshes, ...tongueMeshes];
    for (const mesh of softTissues) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat) continue;
      mat.transparent = gumOpacity < 0.99;
      mat.opacity = gumOpacity;
      mat.depthWrite = gumOpacity > 0.95;
      mat.needsUpdate = true;
    }
  }, [gumMeshes, tongueMeshes, gumOpacity]);

  // Trasladar mandíbula inferior según jawOpen — desde su Y inicial guardado.
  // Para meshes "spanning" cortados con clipping plane, también actualizamos la constante
  // del plano para que el corte se mueva con la mitad inferior.
  React.useEffect(() => {
    const yShift = -jawOpen * 1.4;
    for (const mesh of lowerMeshes) {
      const initialY = initialYRef.current.get(mesh) ?? 0;
      mesh.position.y = initialY + yShift;
    }
    // Actualizar planos de corte: la cara superior de la mitad inferior se mueve con yShift
    for (const plane of lowerPlanes) {
      // plane: normal=(0,-1,0), constant inicial = yEquator
      // queremos visible y < yEquator + yShift  →  -y + (yEquator + yShift) >= 0
      plane.constant = yEquator + yShift;
    }
  }, [lowerMeshes, lowerPlanes, yEquator, jawOpen]);

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const obj = e.object as THREE.Mesh;
    if (!obj.name) return;
    const fdi = fdiFromMeshName(obj.name);
    if (fdi !== null) onToothClick(fdi);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const obj = e.object as THREE.Mesh;
    const fdi = fdiFromMeshName(obj.name);
    if (fdi !== null) onToothHover(fdi);
  };

  const handlePointerOut = () => onToothHover(null);

  return (
    <group onPointerDown={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
      <primitive object={cloned} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Variante 2 — Procedural fallback (sin GLB)
// Mantiene cada diente como mesh independiente para permitir selección y panel.
// ─────────────────────────────────────────────────────────────────────────

const ARCH_COEF = 0.22;
const ARCH_EXP = 1.7;

function archZ(x: number): number {
  return -ARCH_COEF * Math.pow(Math.abs(x), ARCH_EXP);
}
function archTangent(x: number): number {
  if (Math.abs(x) < 1e-4) return 0;
  const dzdx = -ARCH_COEF * ARCH_EXP * Math.sign(x) * Math.pow(Math.abs(x), ARCH_EXP - 1);
  return Math.atan(dzdx);
}

function makeToothGeometry(kind: ToothKind, w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 32, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const isInc = kind === "central-incisor" || kind === "lateral-incisor";

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yNorm = y + 0.5;
    const angle = Math.atan2(z, x);

    const p = kind === "molar" ? 5.0 : kind === "premolar" ? 4.5 : 2.6;
    const absCos = Math.pow(Math.abs(Math.cos(angle)), p);
    const absSin = Math.pow(Math.abs(Math.sin(angle)), p);
    let r = 1.0 / Math.pow(absCos + absSin, 1 / p);

    const sideFactor = Math.abs(Math.cos(angle));
    if (sideFactor > 0.6) r *= 1.0 + (sideFactor - 0.6) * 0.35;

    const neckScale = kind === "molar" ? 0.85 : 0.55;
    const taper = neckScale + (1.0 - neckScale) * Math.pow(yNorm, 0.35);

    let dTaper = 1.0;
    if (isInc || kind === "canine") {
      dTaper = 1.0 - Math.pow(yNorm, 3.0) * 0.9;
      if (z < -0.02 && isInc && yNorm > 0.2) {
        const concavity = Math.sin(((yNorm - 0.2) / 0.8) * Math.PI) * (d * 0.35);
        z += concavity * (1.0 - Math.pow(x / (w * 0.45), 2));
      }
    } else {
      dTaper = 1.0 - Math.pow(yNorm, 4.0) * 0.25;
    }

    x = Math.cos(angle) * r * (w * 0.5) * taper;
    z = Math.sin(angle) * r * (d * 0.5) * taper * dTaper;

    if (z > 0) {
      const bulge = Math.sin(yNorm * Math.PI * 0.85) * (d * 0.25);
      z += bulge * (1.0 - Math.pow(x / (w * 0.55), 2));
    }

    if (yNorm > 0.6) {
      const liftT = (yNorm - 0.6) / 0.4;
      if (kind === "canine") {
        const dist = Math.sqrt(x * x + z * z) / (w * 0.4);
        y += Math.max(0, 1.0 - dist * 2.0) * liftT * 0.2;
      } else if (isInc) {
        y += Math.cos((x / (w * 0.55)) * Math.PI * 0.5) * liftT * 0.06;
      } else {
        const nx = x / (w * 0.5);
        const nz = z / (d * 0.5);
        const c1 = Math.max(0, 1 - Math.sqrt((nx - 0.5) ** 2 + (nz - 0.5) ** 2) * 3.5);
        const c2 = Math.max(0, 1 - Math.sqrt((nx + 0.5) ** 2 + (nz - 0.5) ** 2) * 3.5);
        const c3 = Math.max(0, 1 - Math.sqrt((nx - 0.5) ** 2 + (nz + 0.5) ** 2) * 3.5);
        const c4 = Math.max(0, 1 - Math.sqrt((nx + 0.5) ** 2 + (nz + 0.5) ** 2) * 3.5);
        const groove = (Math.max(0, 1 - Math.abs(nx) * 8) + Math.max(0, 1 - Math.abs(nz) * 8)) * 0.10;
        const pit = Math.max(0, 1 - (Math.abs(nx) * 3 + Math.abs(nz) * 3)) * 0.30;
        const m = kind === "molar" ? 0.22 : 0.26;
        y += ((c1 + c2 + (kind === "molar" ? c3 + c4 : 0)) - (pit + groove)) * liftT * m;
      }
    }

    pos.setXYZ(i, x, y * h, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Dimensiones reducidas ~22% para dejar la encía dominante (más cerca de la proporción anatómica real)
const TOOTH_DIMS: Record<ToothKind, { w: number; d: number; crownH: number }> = {
  "central-incisor": { w: 0.74, d: 0.44, crownH: 0.84 },
  "lateral-incisor": { w: 0.60, d: 0.38, crownH: 0.74 },
  canine: { w: 0.68, d: 0.52, crownH: 0.94 },
  premolar: { w: 0.74, d: 0.68, crownH: 0.68 },
  molar: { w: 0.98, d: 0.82, crownH: 0.66 },
};

interface ProceduralToothProps {
  fdi: number;
  position: [number, number, number];
  rotationY: number;
  jaw: "upper" | "lower";
  isTemporary: boolean;
  state: ToothState | undefined;
  isHovered: boolean;
  isSelected: boolean;
  onClick: (fdi: number, e: ThreeEvent<PointerEvent>) => void;
  onHover: (fdi: number | null) => void;
}

const ProceduralTooth: React.FC<ProceduralToothProps> = ({
  fdi,
  position,
  rotationY,
  jaw,
  isTemporary,
  state,
  isHovered,
  isSelected,
  onClick,
  onHover,
}) => {
  const kind = toothKindOf(fdi, isTemporary);
  const ts = isTemporary ? 0.86 : 1;
  const { w, d, crownH } = TOOTH_DIMS[kind];
  const geo = useMemo(() => makeToothGeometry(kind, w * ts, crownH * ts, d * ts), [kind, w, ts, crownH, d]);

  const baseColor = toothDisplayColor(state);
  // Variación sutil por diente: hash del FDI → ligeras diferencias de tono
  // (incisivos un poco más blancos, molares un toque más amarillos — como en la realidad).
  const tonalShift = useMemo(() => {
    if (state && state.condition !== "none") return 0; // si tiene condición, no variamos
    const seed = (fdi * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    // -0.04..+0.02 (un poco más oscuro a un poco más claro)
    return -0.04 + rnd * 0.06;
  }, [fdi, state]);
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    if (baseColor === ENAMEL && tonalShift !== 0) {
      c.offsetHSL(0, 0, tonalShift);
    }
    return c;
  }, [baseColor, tonalShift]);

  const yOffset = (crownH * ts) * 0.12;
  const rotZ = jaw === "upper" ? Math.PI : 0;
  const isHealthyEnamel = baseColor === ENAMEL;

  return (
    <group position={position} rotation={[0, rotationY, rotZ]}>
      <group position={[0, yOffset, 0]}>
        <mesh
          geometry={geo}
          name={`tooth_${fdi}`}
          castShadow
          receiveShadow
          onPointerDown={(e) => {
            e.stopPropagation();
            onClick(fdi, e);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(fdi);
          }}
          onPointerOut={() => onHover(null)}
        >
          <meshPhysicalMaterial
            color={color}
            roughness={isHealthyEnamel ? 0.18 : 0.4}
            metalness={0}
            clearcoat={isHealthyEnamel ? 1 : 0.4}
            clearcoatRoughness={0.05}
            sheen={isHealthyEnamel ? 0.25 : 0}
            sheenColor="#fff5e8"
            envMapIntensity={1.4}
            emissive={isSelected ? "#2563eb" : isHovered ? "#3b82f6" : "#000000"}
            emissiveIntensity={isSelected ? 0.35 : isHovered ? 0.18 : 0}
          />
        </mesh>
      </group>
    </group>
  );
};

interface ProceduralGumProps {
  toothPositions: { x: number; z: number; w: number }[];
  y: number;
  jaw: "upper" | "lower";
  opacity: number;
}

/**
 * Construye una "cinta alveolar" volumétrica extruyendo una sección transversal
 * (perfil 2D radial × vertical) a lo largo del arco dental.
 *
 * El perfil tiene la forma del proceso alveolar real:
 *   - Cervix estrecho cerca del cuello del diente
 *   - Bulto vestibular (hacia afuera del arco)
 *   - Inclinación palatina/lingual (hacia adentro del arco)
 *   - Conexión sobre la línea media (palato superior / piso de boca inferior)
 */
function buildAlveolarRibbon(
  archPoints: THREE.Vector3[],
  jaw: "upper" | "lower",
): THREE.BufferGeometry {
  const isUpper = jaw === "upper";

  // Perfil 2D — radial (x positivo = hacia afuera del arco), vertical (y positivo = hacia raíz)
  // Construimos una curva CCW redondeada con MUCHOS puntos para que no haya aristas.
  // Los puntos se generan a partir de keypoints anatómicos y se interpolan con Catmull-Rom.
  const keypointsUpper = [
    // gum margin vestibular → bulto → palato → margin palatino, en sentido CCW
    new THREE.Vector2( 0.55,  0.00),
    new THREE.Vector2( 0.85,  0.30),
    new THREE.Vector2( 0.95,  0.85),
    new THREE.Vector2( 0.92,  1.40),
    new THREE.Vector2( 0.65,  1.85),
    new THREE.Vector2( 0.20,  2.00),
    new THREE.Vector2(-0.30,  1.95),
    new THREE.Vector2(-0.70,  1.55),
    new THREE.Vector2(-0.78,  0.95),
    new THREE.Vector2(-0.62,  0.40),
    new THREE.Vector2(-0.45,  0.00),
  ];
  const keypointsLower = [
    new THREE.Vector2( 0.55,  0.00),
    new THREE.Vector2( 0.82, -0.30),
    new THREE.Vector2( 0.92, -0.85),
    new THREE.Vector2( 0.88, -1.40),
    new THREE.Vector2( 0.55, -1.85),
    new THREE.Vector2( 0.10, -2.00),
    new THREE.Vector2(-0.35, -1.95),
    new THREE.Vector2(-0.65, -1.55),
    new THREE.Vector2(-0.72, -0.95),
    new THREE.Vector2(-0.58, -0.40),
    new THREE.Vector2(-0.45,  0.00),
  ];
  const keypoints = isUpper ? keypointsUpper : keypointsLower;
  // Smooth con Catmull-Rom abierto (no cerrado — los extremos están sobre la línea gingival y NO se conectan)
  const smoothCurve = new THREE.SplineCurve(keypoints);
  const PROFILE_RES = 32;
  const profile2D: { x: number; y: number }[] = [];
  for (let i = 0; i <= PROFILE_RES; i++) {
    const p = smoothCurve.getPoint(i / PROFILE_RES);
    profile2D.push({ x: p.x, y: p.y });
  }

  const N = archPoints.length;
  const M = profile2D.length;
  const positions: number[] = [];
  const indices: number[] = [];

  // Para cada punto del arco: construir frame local (tangent, up, right) y posicionar el perfil
  for (let i = 0; i < N; i++) {
    const center = archPoints[i];
    const next = archPoints[Math.min(i + 1, N - 1)];
    const prev = archPoints[Math.max(i - 1, 0)];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();

    // Right: perpendicular a la tangente, en el plano XZ (radial hacia afuera del arco).
    // En esta arcada los puntos van con z = -coef·|x|^exp (curvándose hacia -Z al aumentar |x|),
    // por lo que (tangent × Y) apunta hacia el lado correcto si la tangente avanza con +X creciente.
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    for (const p of profile2D) {
      const pos = new THREE.Vector3()
        .copy(center)
        .addScaledVector(right, p.x)
        .addScaledVector(up, p.y);
      positions.push(pos.x, pos.y, pos.z);
    }
  }

  // Índices: conectar anillos consecutivos con quads. Perfil ABIERTO (no se conecta j=M-1 con j=0)
  // porque la línea inferior (margen gingival) queda libre para que los dientes/marginal tube
  // se vean salir de allí sin un techo plano.
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j;
      const b = i * M + j + 1;
      const c = (i + 1) * M + j + 1;
      const d = (i + 1) * M + j;
      indices.push(a, b, c);
      indices.push(a, c, d);
    }
  }

  // Cap los extremos posteriores con un fan triangular (cierra los molares al fondo).
  const addCap = (ringStart: number, reversed: boolean) => {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < M; j++) {
      cx += positions[(ringStart + j) * 3];
      cy += positions[(ringStart + j) * 3 + 1];
      cz += positions[(ringStart + j) * 3 + 2];
    }
    cx /= M; cy /= M; cz /= M;
    const centerIdx = positions.length / 3;
    positions.push(cx, cy, cz);
    // Perfil abierto: M-1 conexiones (no envolvemos)
    for (let j = 0; j < M - 1; j++) {
      if (reversed) {
        indices.push(centerIdx, ringStart + j + 1, ringStart + j);
      } else {
        indices.push(centerIdx, ringStart + j, ringStart + j + 1);
      }
    }
  };
  addCap(0, true);
  addCap((N - 1) * M, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Construye la tapa interior del arco — palato superior (cúpula curva) o piso de boca inferior (plano).
 * Visualmente cierra el "U" de la arcada y le da el aspecto de una cavidad oral real.
 */
function buildArchCap(
  archPoints: THREE.Vector3[],
  jaw: "upper" | "lower",
  baseY: number,
): THREE.BufferGeometry {
  const isUpper = jaw === "upper";
  const sorted = [...archPoints].sort((a, b) => a.x - b.x);
  const N = sorted.length;
  if (N < 3) return new THREE.BufferGeometry();

  // Boundary loop: borde interior del arco. Lo extraemos pulling cada punto del arco
  // levemente hacia el centro de la arcada (z hacia +Z desde la curva original — adentro).
  // Distancia hacia adentro: aproximadamente el radio del perfil interior (0.5)
  const inwardOffset = 0.50;
  const boundary: THREE.Vector3[] = sorted.map((p) => new THREE.Vector3(p.x, baseY, p.z + inwardOffset));

  // Centro: punto en el medio de la arcada, ligeramente arriba/abajo para curvatura del palato
  const centerX = 0;
  const centerZ = sorted.reduce((acc, p) => acc + p.z, 0) / N + inwardOffset * 1.3;
  const apexY = baseY + (isUpper ? 0.55 : -0.10); // palato más alto que piso

  const positions: number[] = [];
  // Vertex 0: centro (apex)
  positions.push(centerX, apexY, centerZ);
  // Vertices 1..N: boundary
  for (const b of boundary) {
    positions.push(b.x, b.y, b.z);
  }

  // Triangle fan desde el centro a cada par consecutivo de boundary
  const indices: number[] = [];
  for (let i = 1; i < N; i++) {
    if (isUpper) {
      indices.push(0, i, i + 1); // CCW visto desde abajo
    } else {
      indices.push(0, i + 1, i); // CCW visto desde arriba
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const ProceduralGum: React.FC<ProceduralGumProps> = ({ toothPositions, y, jaw, opacity }) => {
  const isUpper = jaw === "upper";

  const { bodyGeo, marginGeo, capGeo } = useMemo(() => {
    if (toothPositions.length === 0) {
      return {
        bodyGeo: new THREE.BufferGeometry(),
        marginGeo: new THREE.BufferGeometry(),
        capGeo: new THREE.BufferGeometry(),
      };
    }
    const sorted = [...toothPositions].sort((a, b) => a.x - b.x);
    const minX = sorted[0].x - 0.5;
    const maxX = sorted[sorted.length - 1].x + 0.5;
    const totalLen = maxX - minX;

    // Curva del margen gingival con festoneado entre dientes (papila)
    const marginPoints: THREE.Vector3[] = [];
    // Curva base de la cinta — sin festoneado, smooth, para que la masa alveolar quede uniforme
    const ribbonPoints: THREE.Vector3[] = [];

    for (let i = 0; i <= 80; i++) {
      const tX = minX + (i / 80) * totalLen;
      const z = archZ(tX);

      // Festoneado para el margen gingival (papila entre dientes)
      let closestDist = 100;
      let closestW = 1.0;
      for (const tp of sorted) {
        const dist = Math.abs(tX - tp.x);
        if (dist < closestDist) {
          closestDist = dist;
          closestW = tp.w;
        }
      }
      const normDist = Math.min(1, closestDist / (closestW * 0.5));
      const wave = Math.pow(Math.sin(normDist * Math.PI * 0.5), 2.0) * 0.06;
      const waveY = isUpper ? y - wave : y + wave;

      marginPoints.push(new THREE.Vector3(tX, waveY, z));
      // La cinta sigue la curva festoneada — así el borde inferior del cuerpo de encía
      // ondula entre cada diente (papila interdental) en vez de ser un corte plano horizontal.
      ribbonPoints.push(new THREE.Vector3(tX, waveY, z));
    }

    const body = buildAlveolarRibbon(ribbonPoints, jaw);

    const marginCurve = new THREE.CatmullRomCurve3(marginPoints, false, "catmullrom", 0.5);
    const margin = new THREE.TubeGeometry(marginCurve, 220, 0.07, 14, false);

    // Tapa interior — palato/piso, posicionada un poco hacia la raíz para no chocar con dientes
    const capBaseY = isUpper ? y + 0.55 : y - 0.55;
    const cap = buildArchCap(ribbonPoints, jaw, capBaseY);

    return { bodyGeo: body, marginGeo: margin, capGeo: cap };
  }, [toothPositions, y, isUpper, jaw]);

  if (opacity <= 0.001) return null;
  const transparent = opacity < 0.99;

  return (
    <group>
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={GINGIVA}
          roughness={0.65}
          metalness={0}
          sheen={0.4}
          sheenColor="#f8c8d4"
          sheenRoughness={0.7}
          transmission={0.05}
          thickness={0.5}
          ior={1.35}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={marginGeo} position={[0, 0, 0.05]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={GINGIVA}
          roughness={0.5}
          metalness={0}
          sheen={0.3}
          sheenColor="#fdd6e0"
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
      {/* Tapa interior — palato superior o piso de boca inferior */}
      <mesh geometry={capGeo} receiveShadow>
        <meshPhysicalMaterial
          color={isUpper ? "#c66978" : "#c46776"}
          roughness={0.7}
          metalness={0}
          sheen={0.25}
          sheenColor="#e8a8b4"
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

/** Lengua: ellipsoide aplanado con un toque de relieve, posicionada en el piso de la mandíbula. */
const ProceduralTongue: React.FC<{ y: number; opacity: number }> = ({ y, opacity }) => {
  if (opacity <= 0.001) return null;
  const transparent = opacity < 0.99;
  return (
    <mesh position={[0, y - 0.3, -1.2]} scale={[1.6, 0.45, 1.4]} receiveShadow castShadow>
      <sphereGeometry args={[1, 32, 24]} />
      <meshPhysicalMaterial
        color="#c75d6b"
        roughness={0.55}
        metalness={0}
        sheen={0.5}
        sheenColor="#ff9da8"
        sheenRoughness={0.4}
        transmission={0.08}
        thickness={0.4}
        ior={1.38}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
    </mesh>
  );
};

interface ProceduralArchProps {
  numbers: number[];
  y: number;
  jaw: "upper" | "lower";
  isTemporary?: boolean;
  toothStates: Record<number, ToothState>;
  hoveredFDI: number | null;
  selectedFDI: number | null;
  gumOpacity: number;
  onToothClick: (fdi: number, e: ThreeEvent<PointerEvent>) => void;
  onToothHover: (fdi: number | null) => void;
}

const ProceduralArch: React.FC<ProceduralArchProps> = ({
  numbers,
  y,
  jaw,
  isTemporary,
  toothStates,
  hoveredFDI,
  selectedFDI,
  gumOpacity,
  onToothClick,
  onToothHover,
}) => {
  const ts = isTemporary ? 0.86 : 1;

  const placement = useMemo(() => {
    const sorted = [...numbers].sort((a, b) => (a % 10) - (b % 10));
    const left = sorted.filter((n) => {
      const q = Math.floor(n / 10);
      return q === 2 || q === 3 || q === 6 || q === 7;
    });
    const right = sorted.filter((n) => {
      const q = Math.floor(n / 10);
      return q === 1 || q === 4 || q === 5 || q === 8;
    });

    const place = (teeth: number[], sign: number) => {
      const out: { fdi: number; x: number; z: number; rotY: number; w: number }[] = [];
      let currentX = 0;
      teeth.forEach((n, idx) => {
        const kind = toothKindOf(n, isTemporary);
        const w = TOOTH_DIMS[kind].w * ts;
        const gap = idx === 0 ? w * 0.505 : w * 0.5;
        currentX += gap;
        const xPos = currentX * sign;
        out.push({
          fdi: n,
          x: xPos,
          z: archZ(xPos),
          rotY: -archTangent(xPos),
          w,
        });
        currentX += w * 0.5;
      });
      return out;
    };

    return [...place(left, 1), ...place(right, -1)];
  }, [numbers, isTemporary, ts]);

  // crownH promedio reducido (después del rescale 22%), avgCrownH ≈ 0.74
  const avgCrownH = isTemporary ? 0.70 * 0.86 : 0.70;
  // gum margin EN o LIGERAMENTE POR DEBAJO del cervix → el cuerpo cubre el cuello del diente,
  // aprox. al 30% de la corona desde el bite plane (antes 42%, dejaba el cervix descubierto).
  const gumY = jaw === "upper" ? y + avgCrownH * 0.30 : y - avgCrownH * 0.30;

  return (
    <group>
      <ProceduralGum
        toothPositions={placement.map((p) => ({ x: p.x, z: p.z, w: p.w }))}
        y={gumY}
        jaw={jaw}
        opacity={gumOpacity}
      />
      {placement.map((p) => (
        <ProceduralTooth
          key={p.fdi}
          fdi={p.fdi}
          position={[p.x, y, p.z]}
          rotationY={p.rotY}
          jaw={jaw}
          isTemporary={!!isTemporary}
          state={toothStates[p.fdi]}
          isHovered={hoveredFDI === p.fdi}
          isSelected={selectedFDI === p.fdi}
          onClick={onToothClick}
          onHover={onToothHover}
        />
      ))}
    </group>
  );
};

interface ProceduralSceneProps {
  toothStates: Record<number, ToothState>;
  showTemporary: boolean;
  showPermanent: boolean;
  jawOpen: number;
  gumOpacity: number;
  hoveredFDI: number | null;
  selectedFDI: number | null;
  onToothClick: (fdi: number, e: ThreeEvent<PointerEvent>) => void;
  onToothHover: (fdi: number | null) => void;
}

const ProceduralScene: React.FC<ProceduralSceneProps> = ({
  toothStates,
  showTemporary,
  showPermanent,
  jawOpen,
  gumOpacity,
  hoveredFDI,
  selectedFDI,
  onToothClick,
  onToothHover,
}) => {
  const lowerSpring = useSpring({
    position: [0, -jawOpen * 1.8, 0] as [number, number, number],
    rotation: [-jawOpen * 0.12, 0, 0] as [number, number, number],
    config: { tension: 170, friction: 26 },
  });

  return (
    <>
      {/* Maxilar superior */}
      <group position={[0, 0, 0.15]}>
        {showPermanent && (
          <ProceduralArch
            numbers={PERMANENT_FDI.filter((n) => isUpperJaw(n))}
            y={0.68}
            jaw="upper"
            toothStates={toothStates}
            hoveredFDI={hoveredFDI}
            selectedFDI={selectedFDI}
            gumOpacity={gumOpacity}
            onToothClick={onToothClick}
            onToothHover={onToothHover}
          />
        )}
        {showTemporary && (
          <ProceduralArch
            numbers={TEMPORARY_FDI.filter((n) => isUpperJaw(n))}
            y={0.62}
            jaw="upper"
            isTemporary
            toothStates={toothStates}
            hoveredFDI={hoveredFDI}
            selectedFDI={selectedFDI}
            gumOpacity={gumOpacity}
            onToothClick={onToothClick}
            onToothHover={onToothHover}
          />
        )}
      </group>

      {/* Mandíbula inferior animada */}
      <animated.group
        position={lowerSpring.position as unknown as [number, number, number]}
        rotation={lowerSpring.rotation as unknown as [number, number, number]}
      >
        {showPermanent && (
          <ProceduralArch
            numbers={PERMANENT_FDI.filter((n) => !isUpperJaw(n))}
            y={-0.68}
            jaw="lower"
            toothStates={toothStates}
            hoveredFDI={hoveredFDI}
            selectedFDI={selectedFDI}
            gumOpacity={gumOpacity}
            onToothClick={onToothClick}
            onToothHover={onToothHover}
          />
        )}
        {showTemporary && (
          <ProceduralArch
            numbers={TEMPORARY_FDI.filter((n) => !isUpperJaw(n))}
            y={-0.62}
            jaw="lower"
            isTemporary
            toothStates={toothStates}
            hoveredFDI={hoveredFDI}
            selectedFDI={selectedFDI}
            gumOpacity={gumOpacity}
            onToothClick={onToothClick}
            onToothHover={onToothHover}
          />
        )}
        {/* Lengua — sólo en la mandíbula inferior, escala con opacidad de tejidos blandos */}
        <ProceduralTongue y={-0.68} opacity={gumOpacity} />
      </animated.group>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Wrapper público
// ─────────────────────────────────────────────────────────────────────────

export interface Odontogram3DRealisticProps {
  toothStates: Record<number, ToothState>;
  showTemporary: boolean;
  showPermanent: boolean;
  jawOpen: number;
  gumOpacity: number;
  selectedFDI: number | null;
  onToothSelect: (fdi: number | null) => void;
  /** Forzar el modo procedural aunque exista el GLB. Útil para debug. */
  forceProcedural?: boolean;
}

export const Odontogram3DRealistic: React.FC<Odontogram3DRealisticProps> = ({
  toothStates,
  showTemporary,
  showPermanent,
  jawOpen,
  gumOpacity,
  selectedFDI,
  onToothSelect,
  forceProcedural,
}) => {
  const [hoveredFDI, setHoveredFDI] = useState<number | null>(null);
  const [glbAvailable, setGlbAvailable] = useState<boolean | null>(null);

  // Probe GLB existence — Vite dev server sirve index.html como fallback (200 OK + text/html)
  // cuando el archivo no existe, así que validamos también el Content-Type y los primeros bytes
  // para confirmar el magic number "glTF" (0x67 0x6C 0x54 0x46).
  React.useEffect(() => {
    if (forceProcedural) {
      setGlbAvailable(false);
      return;
    }
    let cancelled = false;
    fetch(GLB_URL, { headers: { Range: "bytes=0-3" } })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setGlbAvailable(false);
          return;
        }
        const ct = (r.headers.get("content-type") ?? "").toLowerCase();
        if (ct.includes("text/html") || ct.includes("application/json")) {
          setGlbAvailable(false);
          return;
        }
        const buf = await r.arrayBuffer();
        if (buf.byteLength < 4) {
          setGlbAvailable(false);
          return;
        }
        const view = new Uint8Array(buf);
        const isGLB =
          view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46; // "glTF"
        if (!cancelled) setGlbAvailable(isGLB);
      })
      .catch(() => {
        if (!cancelled) setGlbAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [forceProcedural]);

  const handleToothClick = useCallback(
    (fdi: number) => {
      onToothSelect(selectedFDI === fdi ? null : fdi);
    },
    [onToothSelect, selectedFDI],
  );

  const handleToothHover = useCallback((fdi: number | null) => {
    setHoveredFDI(fdi);
  }, []);

  // Tooltip data
  const hoverState = hoveredFDI !== null ? toothStates[hoveredFDI] : null;
  const hoverCondition =
    hoverState?.condition && hoverState.condition !== "none"
      ? hoverState.condition.replace(/_/g, " ")
      : null;

  return (
    <div className="odn-3d-shell">
      <Canvas
        shadows
        camera={{ position: [0, 0, 9.5], fov: 32 }}
        gl={{ localClippingEnabled: true }}
      >
        <color attach="background" args={["#f4f6f9"]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[0, 6, 8]}
          intensity={1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-6, 3, 4]} intensity={0.35} color="#fff5e8" />
        <directionalLight position={[6, 3, 4]} intensity={0.3} color="#e8f0ff" />

        <Suspense fallback={null}>
          {/* HDRI de estudio para reflejos sutiles en el esmalte */}
          <Environment preset="studio" background={false} environmentIntensity={0.6} />
          {glbAvailable ? (
            <GLTFErrorBoundary
              onError={() => setGlbAvailable(false)}
              fallback={
                <ProceduralScene
                  toothStates={toothStates}
                  showTemporary={showTemporary}
                  showPermanent={showPermanent}
                  jawOpen={jawOpen}
                  gumOpacity={gumOpacity}
                  hoveredFDI={hoveredFDI}
                  selectedFDI={selectedFDI}
                  onToothClick={handleToothClick}
                  onToothHover={handleToothHover}
                />
              }
            >
              <RealisticGLTFScene
                toothStates={toothStates}
                jawOpen={jawOpen}
                gumOpacity={gumOpacity}
                hoveredFDI={hoveredFDI}
                selectedFDI={selectedFDI}
                onToothHover={handleToothHover}
                onToothClick={handleToothClick}
              />
            </GLTFErrorBoundary>
          ) : (
            <ProceduralScene
              toothStates={toothStates}
              showTemporary={showTemporary}
              showPermanent={showPermanent}
              jawOpen={jawOpen}
              gumOpacity={gumOpacity}
              hoveredFDI={hoveredFDI}
              selectedFDI={selectedFDI}
              onToothClick={handleToothClick}
              onToothHover={handleToothHover}
            />
          )}
        </Suspense>

        <ContactShadows
          position={[0, -2.9, 0]}
          opacity={0.4}
          scale={12}
          blur={2.8}
          far={3}
          resolution={512}
          color="#1e293b"
        />

        <OrbitControls enablePan={false} minDistance={4} maxDistance={16} target={[0, 0, 0]} />
      </Canvas>

      {hoveredFDI !== null && (
        <div className="odn-3d-tooltip">
          <strong>{hoveredFDI}</strong> · {fdiToName(hoveredFDI)}
          {hoverCondition && <span className="odn-3d-tooltip-cond">{hoverCondition}</span>}
        </div>
      )}

      {glbAvailable === false && !forceProcedural && (
        <div className="odn-3d-glb-hint">
          Modelo realista disponible: dropea un GLB en <code>/public/models/dental-arch.glb</code> para
          activarlo. Mientras tanto se renderiza el modo procedural.
        </div>
      )}
    </div>
  );
};

// Nota: NO usamos useGLTF.preload(GLB_URL) porque dispararía un 404 si el modelo no existe
// y drei cachea la falla. El HEAD probe + Suspense maneja la carga lazy correctamente.
