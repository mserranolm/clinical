// Lee un GLB y dumpea: nombre de cada mesh + bounding box estimado del nodo.
// Uso: node scripts/inspect-glb.mjs public/models/dental-arch.glb
import fs from "node:fs";

const path = process.argv[2] ?? "public/models/dental-arch.glb";
const buf = fs.readFileSync(path);

// GLB header: 12 bytes (magic "glTF" + version + length)
const magic = buf.toString("ascii", 0, 4);
if (magic !== "glTF") {
  console.error(`No es un GLB válido (magic: ${magic})`);
  process.exit(1);
}

// JSON chunk: ofset 12 (4 bytes length + 4 bytes type "JSON")
const jsonChunkLen = buf.readUInt32LE(12);
const jsonStart = 12 + 8;
const jsonStr = buf.toString("utf8", jsonStart, jsonStart + jsonChunkLen);
const gltf = JSON.parse(jsonStr);

console.log(`\n📦 ${path}`);
console.log(`   ${gltf.nodes?.length ?? 0} nodos · ${gltf.meshes?.length ?? 0} meshes · ${gltf.scenes?.length ?? 0} scenes\n`);

console.log("─── Top-level scene tree ───");
for (const scene of gltf.scenes ?? []) {
  console.log(`  scene: ${scene.name ?? "<anon>"}`);
  for (const nIdx of scene.nodes ?? []) {
    printNode(gltf, nIdx, 1);
  }
}

console.log("\n─── Todos los nodos con name + mesh asignado ───");
const nodesWithMesh = (gltf.nodes ?? [])
  .map((n, i) => ({ idx: i, name: n.name ?? "", meshIdx: n.mesh, mesh: n.mesh != null ? gltf.meshes[n.mesh] : null }))
  .filter((n) => n.meshIdx != null);

for (const n of nodesWithMesh) {
  const meshName = n.mesh?.name ?? "";
  const primCount = n.mesh?.primitives?.length ?? 0;
  console.log(`  [node ${n.idx}] "${n.name}" → mesh[${n.meshIdx}] "${meshName}" (${primCount} prim)`);
}

console.log(`\n   Total nodos con mesh: ${nodesWithMesh.length}\n`);

console.log("─── Bounding boxes (de POSITION accessor min/max) ───");
const binChunkLenStart = 12 + 8 + jsonChunkLen;
// const binChunkLen = buf.readUInt32LE(binChunkLenStart);  // útil si lo necesitamos
const binStart = binChunkLenStart + 8;
const allBoxes = [];
for (const n of nodesWithMesh) {
  for (const prim of n.mesh?.primitives ?? []) {
    const posAccIdx = prim.attributes?.POSITION;
    if (posAccIdx == null) continue;
    const acc = gltf.accessors[posAccIdx];
    if (!acc?.min || !acc?.max) continue;
    const [minX, minY, minZ] = acc.min;
    const [maxX, maxY, maxZ] = acc.max;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const sx = maxX - minX;
    const sy = maxY - minY;
    const sz = maxZ - minZ;
    allBoxes.push({
      node: n.idx,
      meshIdx: n.meshIdx,
      name: n.mesh.name,
      cx, cy, cz, sx, sy, sz,
      vol: sx * sy * sz,
      verts: acc.count,
    });
  }
}

// Calcular el ecuador (Y central de la escena)
const allY = allBoxes.flatMap((b) => [b.cy - b.sy / 2, b.cy + b.sy / 2]);
const yMin = Math.min(...allY);
const yMax = Math.max(...allY);
const yEquator = (yMin + yMax) / 2;
console.log(`   Y range global: ${yMin.toFixed(2)} → ${yMax.toFixed(2)} (ecuador en ${yEquator.toFixed(2)})\n`);

// Ordenar por X (de derecha a izquierda del paciente — X- a X+)
allBoxes.sort((a, b) => a.cx - b.cx);

console.log("name                                         cx     cy     cz      sx     sy     sz    verts   jaw");
console.log("─".repeat(110));
for (const b of allBoxes) {
  const jaw = b.cy > yEquator ? "UPPER" : "LOWER";
  console.log(
    `${b.name.padEnd(44)} ${b.cx.toFixed(2).padStart(6)} ${b.cy.toFixed(2).padStart(6)} ${b.cz.toFixed(2).padStart(6)}   ${b.sx.toFixed(2).padStart(5)} ${b.sy.toFixed(2).padStart(5)} ${b.sz.toFixed(2).padStart(5)}  ${String(b.verts).padStart(5)}   ${jaw}`,
  );
}

function printNode(gltf, nIdx, depth) {
  const n = gltf.nodes[nIdx];
  const indent = "  ".repeat(depth);
  const meshLabel = n.mesh != null ? ` → mesh "${gltf.meshes[n.mesh]?.name ?? ""}"` : "";
  console.log(`${indent}[node ${nIdx}] "${n.name ?? ""}"${meshLabel}`);
  for (const child of n.children ?? []) {
    printNode(gltf, child, depth + 1);
  }
}
