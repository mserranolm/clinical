# Prompt: Generación de PDF Presupuesto Profesional

## Contexto del Proyecto

Aplicación clínica odontológica serverless (Go backend + React/TypeScript frontend) desplegada en AWS con SAM. El sistema ya tiene un módulo completo de presupuestos (Budget) con CRUD funcional:

- **Backend**: `internal/service/budget_service.go` con Create/Get/List/Update/Delete
- **Frontend**: `src/pages/PresupuestoPage.tsx` con modal de creación/edición y función `printBudget()` que genera HTML y usa `window.print()` del navegador
- **Modelo Budget** (`internal/domain/models.go`): ID, OrgID, PatientID, DoctorID, Title, Items[]{ Description, Tooth, Quantity, UnitPrice, Total, Status }, TotalAmount, Currency (USD/VES), Status (draft/sent/approved/partial/paid), Notes, ValidUntil, CreatedAt
- **Modelo Patient**: FirstName, LastName, DocumentID, DocumentType, Phone, Email, etc.
- **Endpoints existentes**: `GET/POST /patients/{patientId}/budgets`, `GET/PUT/DELETE /budgets/{id}`
- **Permisos**: `permTreatmentsManage` (admin, doctor)

## Objetivo

Generar un PDF profesional e imprimible del presupuesto que replique el estilo elegante del diseño de referencia. El PDF debe generarse **en el frontend** usando una librería JavaScript (NO en el backend) para evitar agregar dependencias pesadas al Lambda y mantener el binario liviano.

## Diseño Visual de Referencia (Imagen adjunta)

El PDF debe seguir este layout exacto:

### 1. Header (franja beige/nude `#f5ece4` aprox.)
- Lado izquierdo: título grande serif **"Presupuesto"** en color oscuro
- Lado derecho:
  - **Nombre del doctor/a** en bold (ej. "Dra. Gabriela Figueredo")
  - Especialidad en mayúsculas pequeñas (ej. "ODONTOLOGÍA ESTÉTICA Y ARMONIZACIÓN OROFACIAL")
  - Teléfono con ícono de WhatsApp/teléfono
  - Email con ícono de sobre
  - Dirección/ubicación con ícono de pin

### 2. Sección Paciente
- Etiqueta "Paciente:" en cursiva
- Tabla de 2 columnas con bordes suaves:
  - Fila 1: "Nombre y Apellido" → valor
  - Fila 2: "Cédula" → valor (formateado con puntos: XX.XXX.XXX)

### 3. Tabla de Ítems
- Header de tabla con fondo gris claro
- Columnas: **Descripción** | **Tarifa**
- Cada fila muestra: descripción del tratamiento y precio con "$"
- Si quantity > 1, mostrar "(2) descripción" como prefijo
- Bordes sutiles entre filas
- Fila final (opcional): **TOTAL** en bold

### 4. Footer (opcional)
- Notas del presupuesto si existen
- Validez del presupuesto si tiene fecha
- Fecha de generación

## Requerimientos Técnicos

### Frontend (React/TypeScript)

#### Librería recomendada: `jspdf` + `jspdf-autotable`

```bash
npm install jspdf jspdf-autotable
npm install -D @types/jspdf
```

#### Implementación

1. **Crear archivo**: `src/lib/generateBudgetPdf.ts`

2. **Función principal**:
```typescript
interface PdfBudgetData {
  budget: Budget;
  patientName: string;
  patientDocumentId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorPhone: string;
  doctorEmail: string;
  doctorLocation: string;
  orgLogoUrl?: string; // futuro: logo de la organización
}

export function generateBudgetPdf(data: PdfBudgetData): void {
  // Genera y descarga el PDF
}
```

3. **Lógica del PDF**:
   - Página tamaño carta (letter) o A4
   - Fuentes: usar Helvetica (built-in de jsPDF) como base, o registrar una font serif para el título "Presupuesto"
   - Header con rectángulo beige de fondo
   - Tabla de paciente con celdas con bordes suaves
   - Tabla de ítems usando `jspdf-autotable` con estilos personalizados
   - Formateo de moneda: `$350` para USD, `Bs.350` para VES
   - Formateo de cédula: agregar puntos de miles (28.258.341)
   - Si `quantity > 1`, mostrar como `(2) Restauraciones medianas`

4. **Integración en PresupuestoPage.tsx**:
   - Agregar botón de descarga PDF junto al botón de imprimir existente (ícono `Download` de lucide-react)
   - Al hacer click, obtener datos del doctor y paciente y llamar a `generateBudgetPdf()`
   - El botón solo aparece para presupuestos guardados (no en el modal de creación)

### Datos del Doctor/Organización

Actualmente el modelo Budget tiene `doctorId` pero no se persiste la info del doctor en el presupuesto. Para el PDF necesitamos:

**Opción A (recomendada - sin cambios en backend):**
- El frontend ya tiene `session` con la info del usuario logueado
- Usar `session.name` como nombre del doctor
- Agregar campos configurables en el frontend (localStorage o settings page) para: especialidad, teléfono, email, dirección
- O hacer un `GET /users/{doctorId}` si ese endpoint existe

**Opción B (con cambios en backend - futuro):**
- Agregar modelo `OrgProfile` con: nombre clínica, logo, dirección, teléfono, email, especialidad
- Endpoint `GET /org/profile` y `PUT /org/profile`
- El PDF usa estos datos como header

Para el MVP, ir con **Opción A**.

### Flujo del Usuario

1. Usuario va a presupuestos del paciente
2. Crea o edita un presupuesto
3. En la tarjeta del presupuesto, ve botón 📥 "Descargar PDF"
4. Click → se genera el PDF con los datos del presupuesto + paciente + doctor
5. El PDF se descarga automáticamente como `presupuesto-{titulo}-{fecha}.pdf`
6. El usuario puede abrir e imprimir el PDF

## Archivos a Crear/Modificar

### Nuevos
- `frontend/react-app/src/lib/generateBudgetPdf.ts` — Toda la lógica de generación de PDF

### Modificados
- `frontend/react-app/src/pages/PresupuestoPage.tsx` — Agregar botón de descarga y llamar a la función
- `frontend/react-app/package.json` — Agregar dependencias jspdf y jspdf-autotable

### NO modificar
- Backend (Go) — No se requieren cambios para el MVP
- `template.yaml` — No se requieren cambios de infraestructura

## Paleta de Colores del PDF

| Elemento | Color |
|----------|-------|
| Fondo header | `#f5ece4` (beige/nude) |
| Texto título "Presupuesto" | `#3d2c1e` (marrón oscuro) |
| Nombre doctor | `#2d2018` (casi negro) |
| Texto especialidad | `#5a4a3a` (marrón medio) |
| Texto contacto | `#5a4a3a` |
| Labels paciente (Nombre, Cédula) | `#a0522d` (sienna/terracota) |
| Valores paciente | `#4a4a4a` (gris oscuro) |
| Header tabla | `#f0ebe5` (beige claro) con texto `#3d2c1e` |
| Texto tabla body | `#333333` |
| Precio/tarifa | `#333333` bold |
| Total row | Background `#f5ece4`, texto bold `#2d2018` |

## Ejemplo de Salida Esperada

```
┌──────────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░ Presupuesto        Dra. Gabriela Figueredo    ░░ │
│  ░                    ODONTOLOGÍA ESTÉTICA Y     ░░ │
│  ░                    ARMONIZACIÓN OROFACIAL     ░░ │
│  ░                    📞 0412-038-3478           ░░ │
│  ░                    ✉ dra@gmail.com            ░░ │
│  ░                    📍 NaguaNagua Hotel        ░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                      │
│  Paciente:                                           │
│  ┌─────────────────┬─────────────────────────┐       │
│  │ Nombre y Apell. │ Nayshla Ancent          │       │
│  ├─────────────────┼─────────────────────────┤       │
│  │ Cédula          │ 28.258.341              │       │
│  └─────────────────┴─────────────────────────┘       │
│                                                      │
│  ┌───────────────────────────────────┬──────────┐    │
│  │ Descripción                       │ Tarifa   │    │
│  ├───────────────────────────────────┼──────────┤    │
│  │ Endodoncia                        │ $350     │    │
│  │ Restauración final con fibra...   │ $120     │    │
│  │ (2) Restauraciones defectuosas    │ $120     │    │
│  │ (2) restauraciones medianas       │ $80      │    │
│  │ (2) restauraciones pequeñas       │ $80      │    │
│  │ Retoque de limpieza               │ $30      │    │
│  ├───────────────────────────────────┼──────────┤    │
│  │                          TOTAL    │ $780     │    │
│  └───────────────────────────────────┴──────────┘    │
│                                                      │
│  Notas: ...                                          │
│  Válido hasta: dd/mm/yyyy                            │
└──────────────────────────────────────────────────────┘
```

## Criterios de Aceptación

1. ✅ El PDF se genera correctamente desde el frontend sin llamadas adicionales al backend
2. ✅ El diseño replica fielmente el estilo de la imagen de referencia (colores, tipografía, layout)
3. ✅ La tabla muestra correctamente cantidades > 1 con formato `(N) descripción`
4. ✅ Los montos se formatean según la moneda ($ para USD, Bs. para VES)
5. ✅ La cédula del paciente se formatea con puntos de miles
6. ✅ El PDF se puede imprimir correctamente (márgenes adecuados, sin cortar contenido)
7. ✅ Funciona con presupuestos de 1 a 30+ ítems (paginación automática si es necesario)
8. ✅ El nombre del archivo descargado es descriptivo: `presupuesto-{titulo}-{fecha}.pdf`
9. ✅ El botón de descarga tiene feedback visual (loading state mientras genera)
10. ✅ Compatible con navegadores modernos (Chrome, Safari, Firefox)

## Notas Adicionales

- **NO usar** generación de PDF en el backend (Go). Mantener el binario Lambda liviano.
- **NO usar** `html2canvas` + `jspdf` (renderiza HTML a imagen, pierde calidad). Usar jsPDF directamente con coordenadas o jspdf-autotable para las tablas.
- Si jspdf-autotable no da suficiente control visual, considerar usar solo `jspdf` con posicionamiento manual (más código pero control total del diseño).
- Para fuentes serif en el título "Presupuesto", se puede registrar una fuente custom en jsPDF o usar la built-in "times" como alternativa aceptable.
- El presupuesto de la imagen NO muestra columna "Cantidad" ni "Precio Unitario" separados — muestra solo "Descripción" y "Tarifa". Si `quantity > 1`, el prefijo `(N)` va en la descripción. Replicar este formato simplificado de 2 columnas.
