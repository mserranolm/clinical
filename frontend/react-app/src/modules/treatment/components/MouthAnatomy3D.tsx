import React, { useMemo } from 'react';
import * as THREE from 'three';

/* ── Constantes del arco dental (deben coincidir con DentalArch3D) ── */
const ARCH_RX   = 2.85;
const ARCH_RZ   = 1.45;
const ARCH_SPAN = Math.PI * 0.92;
const ARCH_PTS  = 40; // puntos de la curva

/** Genera los puntos del arco elíptico en el plano XZ */
function buildArchPoints(y: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ARCH_PTS; i++) {
    const ratio = i / ARCH_PTS;
    const theta = (ratio - 0.5) * ARCH_SPAN;
    const x = Math.sin(theta) * ARCH_RX;
    const z = -(1 - Math.cos(theta)) * ARCH_RZ;
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

/**
 * Encía como tubo continuo (TubeGeometry) sobre el arco dental.
 * El tubo se posiciona en la zona cervical del diente para cubrirlo a la mitad.
 * Se usan dos tubos concéntricos: uno delgado frontal (margen gingival)
 * y uno grueso posterior (volumen alveolar).
 */
/* Genera festoneado gingival: esferas entre cada diente */
function buildScallops(y: number, count: number, color: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i <= count; i++) {
    const ratio = i / count;
    const theta = (ratio - 0.5) * ARCH_SPAN;
    const x = Math.sin(theta) * ARCH_RX;
    const z = -(1 - Math.cos(theta)) * ARCH_RZ;
    const r = 0.22 + Math.sin(i * 2.3) * 0.03;
    nodes.push(
      <mesh key={i} position={[x, y, z]} castShadow>
        <sphereGeometry args={[r, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} />
      </mesh>
    );
  }
  return nodes;
}

const GumTube: React.FC<{ y: number; color: string; scallop: number }> = ({ y, color, scallop }) => {
  const bodyGeom = useMemo(() => {
    const pts = buildArchPoints(y);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 100, 0.78, 16, false);
  }, [y]);

  const marginGeom = useMemo(() => {
    const pts = buildArchPoints(y);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 100, 0.38, 14, false);
  }, [y]);

  const scallops = useMemo(() => buildScallops(scallop, 16, color), [scallop, color]);

  return (
    <group>
      {/* Volumen alveolar — cuerpo principal */}
      <mesh geometry={bodyGeom} position={[0, 0, -0.38]} receiveShadow castShadow>
        <meshStandardMaterial color={color} roughness={0.72} metalness={0.01} />
      </mesh>
      {/* Margen gingival fino */}
      <mesh geometry={marginGeom} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.02} />
      </mesh>
      {/* Festoneado interdental */}
      {scallops}
    </group>
  );
};

export const MouthAnatomy3D: React.FC<{ jawOpen: number }> = ({ jawOpen }) => {
  const maxShift = 1.8;

  return (
    <group>
      {/* Encía superior */}
      <group position={[0, -jawOpen * maxShift, 0]}>
        <GumTube y={1.05} color="#e8758a" scallop={1.18} />
      </group>
      {/* Encía inferior */}
      <group position={[0, jawOpen * maxShift, 0]}>
        <GumTube y={-1.05} color="#e06878" scallop={-1.18} />
      </group>
    </group>
  );
};
