# Modelos 3D — Odontograma realista

Para activar la **vista 3D anatómica realista** (con encía rosada esmaltada, raíces visibles al hacer transparente la encía y dientes con shading PBR), dropea un archivo GLB en este directorio con el nombre exacto:

```
public/models/dental-arch.glb
```

Si el archivo **no existe**, el componente cae automáticamente al modo procedural mejorado (con animación de apertura, opacidad de encía y selección por diente — pero sin la realismo del modelo escaneado).

## Modelos candidatos (recomendados)

| Modelo | Fuente | Licencia | Pros / Contras |
|---|---|---|---|
| **Free Teeth Base Mesh** (ferrumiron6) | [Sketchfab](https://sketchfab.com/3d-models/free-teeth-base-mesh-b66fde0dc3eb44b0908096aa51b96431) | Gratis, sin atribución | ✅ Comercial-friendly. ❓ Verificar si separa meshes por diente. |
| **Human Teeth** (Alexander Antipov / Dessen) | [Sketchfab](https://sketchfab.com/3d-models/human-teeth-c4c569f0e08948e2a572007a7a5726f2) | CC-BY (atribución requerida) | ✅ Tiene texturas color/specular/normal. |
| **Permanent Teeth Collection** (Dundee Dental School) | [Sketchfab](https://sketchfab.com/DundeeDental/collections/permanent-teeth-4c0d0548c40c463c8cdceb6e0d08df7f) | Académico CC | ✅ Cada diente como modelo individual. ⚠️ Solo dientes, sin encía. |
| **Human Gum and Teeth** (CriisMora) | [Sketchfab Store](https://sketchfab.com/3d-models/human-gum-and-teeth-8b3c0252a52d48e19e6e7aa08d78a443) | Royalty-Free (paid) | 💰 ~$10-20. Encía + dientes integrados. |
| **Realistic Human Teeth** (Inventive World) | [Sketchfab Store](https://sketchfab.com/3d-models/realistic-human-teeth-39e1f16ebb8e45438873663b56036417) | Royalty-Free (paid) | 💰 ~$25-40. La opción más realista del listado. |

## Requisitos del modelo

Para que el modelo funcione bien con el sistema clínico:

1. **32 dientes como meshes separados** (uno por mesh).
2. **Naming convention** — uno de:
   - **FDI directo**: `tooth_11`, `tooth_12`, ..., `tooth_48` (recomendado).
   - **Universal (1-32)**: `tooth_1`, `tooth_2`, ..., `tooth_32` (se mapea automáticamente).
   - **Otro patrón**: editar `MESH_TO_FDI` en `src/modules/treatment/components/toothMapping.ts` con los nombres reales.
3. **Encía** como mesh(es) separado(s), con nombres que contengan `gum`, `gingiva` o `encia` (case-insensitive). Idealmente uno superior y uno inferior.
4. **Mandíbula inferior** identificable: meshes con `lower`, `mandib` o `inf` en el nombre se animan al abrir la boca.
5. **Formato**: `.glb` binario (no `.gltf` con texturas separadas, para simplificar deploy).
6. **Tamaño**: idealmente ≤3 MB. Si pesa más, comprimir con [`gltf-pipeline`](https://github.com/CesiumGS/gltf-pipeline):
   ```bash
   npx gltf-pipeline -i input.glb -o dental-arch.glb -d
   ```
   El flag `-d` aplica compresión Draco.

## Cómo verificar el naming del modelo

Una vez dropeado el `.glb`, abrir el navegador en la vista 3D y en la consola ejecutar:

```js
// Inspeccionar nombres de meshes
fetch('/models/dental-arch.glb').then(r => r.arrayBuffer()).then(buf => {
  const url = URL.createObjectURL(new Blob([buf]));
  const loader = new GLTFLoader();
  loader.load(url, gltf => {
    gltf.scene.traverse(o => { if (o.type === 'Mesh') console.log(o.name); });
  });
});
```

Si los nombres no matchean los patrones esperados, completar `MESH_TO_FDI` en `toothMapping.ts`:

```ts
export const MESH_TO_FDI: Record<string, number> = {
  'Upper_Right_3rd_Molar': 18,
  'Upper_Right_2nd_Molar': 17,
  // … 32 entradas
};
```

## Optimización recomendada

```bash
# 1. Reducir polígonos (objetivo: ≤50k tris totales)
npx gltf-transform optimize input.glb output1.glb

# 2. Comprimir con Draco
npx gltf-pipeline -i output1.glb -o dental-arch.glb -d

# 3. Validar resultado
ls -lh dental-arch.glb        # idealmente <3 MB
```

## Licencias y atribución

Si usás un modelo CC-BY, agregar la atribución en algún lugar visible de la app (footer del odontograma o página de créditos). Ejemplo:

> Modelo dental "Human Teeth" por [Alexander Antipov](https://sketchfab.com/Dessen) — Sketchfab CC-BY 4.0.
