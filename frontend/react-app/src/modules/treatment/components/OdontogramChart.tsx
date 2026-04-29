import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  type Surface,
  type SurfaceCondition,
  type ToothCondition,
  type ToothState,
  SURFACE_FILL,
  SURFACE_STROKE,
  toothConditionColor,
} from "./odontogram-types";
import { RadialMenu } from "./RadialMenu";
import { Odontogram3DControls } from "./Odontogram3DControls";
import { ToothDetailPanel } from "./ToothDetailPanel";

// Lazy load del 3D realista para no inflar el bundle inicial.
const Odontogram3DRealistic = lazy(() =>
  import("./Odontogram3DRealistic").then((m) => ({ default: m.Odontogram3DRealistic })),
);

type ViewMode = "2d" | "3d";

const CONDITION_COLORS_LEGACY: Record<string, string> = {
  none: "#ffffff",
  caries: "#ef4444",
  restored: "#3b82f6",
  completed: "#10b981",
};

const CONDITION_STROKE_LEGACY: Record<string, string> = {
  none: "#cbd5e1",
  caries: "#dc2626",
  restored: "#2563eb",
  completed: "#059669",
};

function getSurfaceFill(cond: string): string {
  return SURFACE_FILL[cond as SurfaceCondition] ?? CONDITION_COLORS_LEGACY[cond] ?? "#ffffff";
}
function getSurfaceStroke(cond: string): string {
  return SURFACE_STROKE[cond as SurfaceCondition] ?? CONDITION_STROKE_LEGACY[cond] ?? "#cbd5e1";
}

interface ToothProps {
  number: number;
  conditions?: Record<Surface, string>;
  toothCondition?: ToothCondition;
  onSurfaceClick?: (toothNumber: number, surface: Surface) => void;
  isTemporary?: boolean;
  arch?: "upper" | "lower" | "temp";
}

/* ── SVG overlay para condición de diente completo ─────────────── */
const ToothOverlay: React.FC<{ condition: ToothCondition }> = ({ condition }) => {
  if (condition === "none") return null;
  const c = toothConditionColor(condition);

  switch (condition) {
    case "exodoncia_indicada":
    case "exodoncia_realizada":
      return (
        <g className="odn-overlay">
          <line x1="12" y1="14" x2="52" y2="62" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="52" y1="14" x2="12" y2="62" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case "endodoncia_indicada":
    case "endodoncia_realizada":
      return (
        <g className="odn-overlay">
          <line x1="32" y1="10" x2="32" y2="66" stroke={c} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "corona_indicada":
    case "corona_realizada":
      return (
        <g className="odn-overlay">
          <circle cx="32" cy="38" r="18" fill={c} fillOpacity="0.55" stroke={c} strokeWidth="2" />
        </g>
      );
    case "corona_defectuosa":
      return (
        <g className="odn-overlay">
          <circle cx="32" cy="38" r="18" fill="#2563eb" fillOpacity="0.45" stroke="#ef4444" strokeWidth="2.5" />
        </g>
      );
    case "implante_indicado":
    case "implante_realizado":
      return (
        <g className="odn-overlay">
          <polygon
            points="32,10 20,58 44,58"
            fill={c}
            fillOpacity="0.5"
            stroke={c}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      );
    case "erupcion_alterada":
    case "erupcion_dental":
      return (
        <g className="odn-overlay">
          <circle cx="32" cy="38" r="16" fill="none" stroke={c} strokeWidth="2.5" strokeDasharray="4 3" />
        </g>
      );
    case "fractura":
      return (
        <g className="odn-overlay">
          <polyline
            points="22,14 28,28 20,36 30,44 24,56 32,64"
            fill="none"
            stroke={c}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case "diente_ausente":
      return (
        <g className="odn-overlay">
          <rect x="4" y="4" width="56" height="64" rx="8" fill="#94a3b8" fillOpacity="0.4" />
          <line x1="16" y1="20" x2="48" y2="56" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
          <line x1="48" y1="20" x2="16" y2="56" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
};

const Tooth: React.FC<ToothProps> = ({
  number,
  conditions = {} as Record<Surface, string>,
  toothCondition = "none",
  onSurfaceClick,
  isTemporary,
  arch = "upper",
}) => {
  const get = (s: Surface) => conditions[s] ?? "none";
  const click = (s: Surface) => onSurfaceClick?.(number, s);
  const size = isTemporary ? 44 : 56;
  const enamelGradientId = `enamel-${arch}-${number}`;
  const isAbsent = toothCondition === "diente_ausente";

  return (
    <div
      className={`odn-tooth odn-tooth--${arch}`}
      style={{ width: size, flexShrink: 0, opacity: isAbsent ? 0.35 : 1 }}
    >
      <span className="odn-tooth-num" style={{ fontSize: isTemporary ? "0.55rem" : "0.62rem" }}>
        {number}
      </span>
      <svg viewBox="0 0 64 72" width={size} height={size} className="odn-tooth-svg">
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
        <path d="M20 13 C24 10, 40 10, 44 13" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.3" fill="none" />

        <polygon
          points="14,16 50,16 43,26 21,26"
          fill={getSurfaceFill(get("V"))}
          stroke={getSurfaceStroke(get("V"))}
          strokeWidth="1.5"
          onClick={() => click("V")}
          className="odn-surface"
        />
        <polygon
          points="18,50 46,50 40,60 24,60"
          fill={getSurfaceFill(get("L"))}
          stroke={getSurfaceStroke(get("L"))}
          strokeWidth="1.5"
          onClick={() => click("L")}
          className="odn-surface"
        />
        <polygon
          points="14,16 21,26 24,50 18,60 12,50 10,30"
          fill={getSurfaceFill(get("M"))}
          stroke={getSurfaceStroke(get("M"))}
          strokeWidth="1.5"
          onClick={() => click("M")}
          className="odn-surface"
        />
        <polygon
          points="50,16 43,26 40,50 46,60 52,50 54,30"
          fill={getSurfaceFill(get("D"))}
          stroke={getSurfaceStroke(get("D"))}
          strokeWidth="1.5"
          onClick={() => click("D")}
          className="odn-surface"
        />
        <rect
          x="22"
          y="27"
          width="20"
          height="22"
          rx="4"
          fill={getSurfaceFill(get("O"))}
          stroke={getSurfaceStroke(get("O"))}
          strokeWidth="1.5"
          onClick={() => click("O")}
          className="odn-surface"
        />

        <ToothOverlay condition={toothCondition} />
      </svg>
    </div>
  );
};

/* ── Main chart ─────────────────────────────────────────────── */
export const OdontogramChart: React.FC<{
  toothStates?: Record<number, ToothState>;
  onSurfaceChange?: (toothNum: number, surface: Surface, cond: SurfaceCondition) => void;
  onToothConditionChange?: (toothNum: number, cond: ToothCondition) => void;
  onResetTooth?: (toothNum: number) => void;
  /** @deprecated — se mantiene por compatibilidad con el ciclo antiguo */
  onToothClick?: (toothNum: number, surface: Surface) => void;
  patientAge?: number | null;
  readOnly?: boolean;
}> = ({
  toothStates = {},
  onSurfaceChange,
  onToothConditionChange,
  onResetTooth,
  onToothClick,
  patientAge,
  readOnly,
}) => {
  const isChildProfile = typeof patientAge === "number" && patientAge >= 0 && patientAge < 12;
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [hideTemporary, setHideTemporary] = useState(!isChildProfile);
  const showTemporary = !hideTemporary;
  const showPermanent = !isChildProfile || hideTemporary;

  // Estado del menú radial (sólo para vista 2D)
  const [radialMenu, setRadialMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    toothNum: number;
    surface?: Surface;
  } | null>(null);

  // Estado de la vista 3D
  const [jawOpen, setJawOpen] = useState(0);
  const [gumOpacity, setGumOpacity] = useState(1);
  const [selectedFDI, setSelectedFDI] = useState<number | null>(null);

  useEffect(() => {
    setHideTemporary(!isChildProfile);
  }, [isChildProfile]);

  // Adaptar toothStates al formato normalizado (objects con surfaces + condition)
  const normalizedStates = useMemo(() => {
    const result: Record<number, { surfaces: Record<Surface, string>; condition: ToothCondition }> = {};
    for (const [numStr, val] of Object.entries(toothStates)) {
      const num = Number(numStr);
      if (val && "surfaces" in val && "condition" in val) {
        result[num] = val as { surfaces: Record<Surface, string>; condition: ToothCondition };
      } else {
        result[num] = { surfaces: val as unknown as Record<Surface, string>, condition: "none" };
      }
    }
    return result;
  }, [toothStates]);

  // Wrapper para abrir menú radial desde click en SVG (vista 2D)
  const handleToothSvgClick = useCallback(
    (toothNum: number, surface: Surface) => {
      if (readOnly) return;
      if (onSurfaceChange || onToothConditionChange) {
        const toothEl = document.querySelector(`[data-tooth="${toothNum}"]`);
        if (toothEl) {
          const rect = toothEl.getBoundingClientRect();
          setRadialMenu({
            visible: true,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            toothNum,
            surface,
          });
          return;
        }
      }
      onToothClick?.(toothNum, surface);
    },
    [readOnly, onSurfaceChange, onToothConditionChange, onToothClick],
  );

  // Estado del diente seleccionado en 3D
  const selectedToothState =
    selectedFDI !== null
      ? (toothStates[selectedFDI] as ToothState | undefined) ?? null
      : null;

  return (
    <div className="odn-mode-wrapper">
      <div className="odn-view-switch" role="tablist" aria-label="Modo de visualizacion del odontograma">
        <button
          type="button"
          className={`odn-view-btn ${viewMode === "2d" ? "active" : ""}`}
          onClick={() => setViewMode("2d")}
        >
          Vista 2D clínica
        </button>
        <button
          type="button"
          className={`odn-view-btn ${viewMode === "3d" ? "active" : ""}`}
          onClick={() => setViewMode("3d")}
        >
          Vista 3D anatómica
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
          Perfil por edad: {isChildProfile ? "niño" : "adulto"}
        </small>
      </div>

      {viewMode === "2d" ? (
        <Odontogram2D
          toothStates={normalizedStates}
          onToothClick={handleToothSvgClick}
          showTemporary={showTemporary}
          showPermanent={showPermanent}
          radialMenu={radialMenu}
          onSurfaceChange={onSurfaceChange}
          onToothConditionChange={onToothConditionChange}
          onResetTooth={onResetTooth}
          onCloseMenu={() => setRadialMenu(null)}
        />
      ) : (
        <div className="odn-3d-layout">
          <div className="odn-3d-main">
            <Odontogram3DControls
              jawOpen={jawOpen}
              gumOpacity={gumOpacity}
              onJawOpenChange={setJawOpen}
              onGumOpacityChange={setGumOpacity}
            />
            <Suspense fallback={<div className="odn-3d-loading">Cargando vista 3D…</div>}>
              <Odontogram3DRealistic
                toothStates={toothStates}
                showTemporary={showTemporary}
                showPermanent={showPermanent}
                jawOpen={jawOpen}
                gumOpacity={gumOpacity}
                selectedFDI={selectedFDI}
                onToothSelect={setSelectedFDI}
              />
            </Suspense>
          </div>
          {selectedFDI !== null && (
            <ToothDetailPanel
              toothNumber={selectedFDI}
              state={selectedToothState}
              onSurfaceChange={onSurfaceChange}
              onToothConditionChange={onToothConditionChange}
              onResetTooth={onResetTooth}
              onClose={() => setSelectedFDI(null)}
              readOnly={readOnly}
            />
          )}
        </div>
      )}
    </div>
  );
};

/* ── Quadrant label & dividers ─────────────────────────────── */
const QuadrantLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="odn-quadrant-label">{label}</div>
);
const HDivider: React.FC = () => <div className="odn-h-divider" />;
const VDivider: React.FC = () => <div className="odn-v-divider" />;

const Odontogram2D: React.FC<{
  toothStates?: Record<number, { surfaces: Record<Surface, string>; condition: ToothCondition }>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
  showTemporary: boolean;
  showPermanent: boolean;
  radialMenu?: { visible: boolean; x: number; y: number; toothNum: number; surface?: Surface } | null;
  onSurfaceChange?: (toothNum: number, surface: Surface, cond: SurfaceCondition) => void;
  onToothConditionChange?: (toothNum: number, cond: ToothCondition) => void;
  onResetTooth?: (toothNum: number) => void;
  onCloseMenu?: () => void;
}> = ({
  toothStates = {},
  onToothClick,
  showTemporary,
  showPermanent,
  radialMenu,
  onSurfaceChange,
  onToothConditionChange,
  onResetTooth,
  onCloseMenu,
}) => {
  const renderRow = (
    numbers: number[],
    rowClass: string,
    isTemp = false,
    arch: "upper" | "lower" | "temp" = "upper",
  ) => (
    <div className={`odn-row ${rowClass}`}>
      {numbers.map((n) => {
        const state = toothStates[n];
        return (
          <div key={n} data-tooth={n} style={{ display: "inline-flex" }}>
            <Tooth
              number={n}
              isTemporary={isTemp}
              arch={arch}
              conditions={state?.surfaces}
              toothCondition={state?.condition ?? "none"}
              onSurfaceClick={onToothClick}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="odn-chart">
      <div className="odn-mouth-shell">
        {showPermanent && (
          <>
            <div className="odn-arch-label">SUPERIOR</div>
            <div className="odn-jaw odn-jaw--upper">
              <div className="odn-half">
                <QuadrantLabel label="Q1 — Sup. Derecho" />
                {renderRow([18, 17, 16, 15, 14, 13, 12, 11], "odn-row--upper")}
              </div>
              <VDivider />
              <div className="odn-half">
                <QuadrantLabel label="Q2 — Sup. Izquierdo" />
                {renderRow([21, 22, 23, 24, 25, 26, 27, 28], "odn-row--upper")}
              </div>
            </div>
          </>
        )}

        {showTemporary && (
          <>
            <div className="odn-temp-section">
              <div className="odn-arch-label odn-arch-label--temp">TEMPORALES</div>
              <div className="odn-jaw odn-jaw--temp">
                <div className="odn-half">
                  <div className="odn-temp-pair">
                    {renderRow([55, 54, 53, 52, 51], "odn-row--temp-upper", true, "temp")}
                    {renderRow([85, 84, 83, 82, 81], "odn-row--temp-lower", true, "temp")}
                  </div>
                </div>
                <VDivider />
                <div className="odn-half">
                  <div className="odn-temp-pair">
                    {renderRow([61, 62, 63, 64, 65], "odn-row--temp-upper", true, "temp")}
                    {renderRow([71, 72, 73, 74, 75], "odn-row--temp-lower", true, "temp")}
                  </div>
                </div>
              </div>
            </div>

            {showPermanent && <HDivider />}
          </>
        )}

        {showPermanent && (
          <>
            <div className="odn-jaw odn-jaw--lower">
              <div className="odn-half">
                <QuadrantLabel label="Q4 — Inf. Derecho" />
                {renderRow([48, 47, 46, 45, 44, 43, 42, 41], "odn-row--lower", false, "lower")}
              </div>
              <VDivider />
              <div className="odn-half">
                <QuadrantLabel label="Q3 — Inf. Izquierdo" />
                {renderRow([31, 32, 33, 34, 35, 36, 37, 38], "odn-row--lower", false, "lower")}
              </div>
            </div>
            <div className="odn-arch-label">INFERIOR</div>
          </>
        )}
      </div>

      {radialMenu?.visible && (
        <RadialMenu
          x={radialMenu.x}
          y={radialMenu.y}
          toothNumber={radialMenu.toothNum}
          surface={radialMenu.surface}
          onSelectSurface={onSurfaceChange}
          onSelectTooth={onToothConditionChange}
          onReset={onResetTooth}
          onClose={() => onCloseMenu?.()}
        />
      )}
    </div>
  );
};
