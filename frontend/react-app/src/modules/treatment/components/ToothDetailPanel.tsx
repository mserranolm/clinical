import React from "react";
import {
  EMPTY_SURFACES,
  EMPTY_TOOTH_STATE,
  type Surface,
  type SurfaceCondition,
  type ToothCondition,
  type ToothState,
} from "./odontogram-types";
import { fdiToName } from "./toothMapping";

const SURFACE_LABELS: Record<Surface, string> = {
  O: "Oclusal",
  V: "Vestibular",
  L: "Lingual / Palatina",
  M: "Mesial",
  D: "Distal",
};

const SURFACE_CONDITIONS: { value: SurfaceCondition; label: string; color: string }[] = [
  { value: "none", label: "Sano", color: "#94a3b8" },
  { value: "caries", label: "Caries", color: "#ef4444" },
  { value: "restauracion_buena", label: "Restauración (buena)", color: "#2563eb" },
  { value: "restauracion_defectuosa", label: "Restauración (defectuosa)", color: "#dc2626" },
  { value: "restauracion_provisional", label: "Restauración (provisional)", color: "#f97316" },
  { value: "sellante_indicado", label: "Sellante (indicado)", color: "#ef4444" },
  { value: "sellante_realizado", label: "Sellante (realizado)", color: "#2563eb" },
];

const TOOTH_CONDITIONS: { value: ToothCondition; label: string; color: string }[] = [
  { value: "none", label: "Sano", color: "#94a3b8" },
  { value: "exodoncia_indicada", label: "Exodoncia indicada", color: "#ef4444" },
  { value: "exodoncia_realizada", label: "Exodoncia realizada", color: "#2563eb" },
  { value: "endodoncia_indicada", label: "Endodoncia indicada", color: "#ef4444" },
  { value: "endodoncia_realizada", label: "Endodoncia realizada", color: "#2563eb" },
  { value: "corona_indicada", label: "Corona indicada", color: "#ef4444" },
  { value: "corona_realizada", label: "Corona realizada", color: "#2563eb" },
  { value: "corona_defectuosa", label: "Corona defectuosa", color: "#f97316" },
  { value: "implante_indicado", label: "Implante indicado", color: "#ef4444" },
  { value: "implante_realizado", label: "Implante realizado", color: "#2563eb" },
  { value: "erupcion_alterada", label: "Erupción alterada", color: "#ef4444" },
  { value: "erupcion_dental", label: "Erupción dental", color: "#2563eb" },
  { value: "fractura", label: "Fractura", color: "#ef4444" },
  { value: "diente_ausente", label: "Diente ausente", color: "#64748b" },
];

export interface ToothDetailPanelProps {
  toothNumber: number | null;
  state: ToothState | null;
  onSurfaceChange?: (toothNum: number, surface: Surface, cond: SurfaceCondition) => void;
  onToothConditionChange?: (toothNum: number, cond: ToothCondition) => void;
  onResetTooth?: (toothNum: number) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export const ToothDetailPanel: React.FC<ToothDetailPanelProps> = ({
  toothNumber,
  state,
  onSurfaceChange,
  onToothConditionChange,
  onResetTooth,
  onClose,
  readOnly,
}) => {
  if (toothNumber === null) return null;

  const effectiveState: ToothState = state ?? {
    ...EMPTY_TOOTH_STATE,
    surfaces: { ...EMPTY_SURFACES },
  };

  const handleSurface = (surface: Surface, cond: SurfaceCondition) => {
    if (readOnly || !onSurfaceChange) return;
    onSurfaceChange(toothNumber, surface, cond);
  };

  const handleTooth = (cond: ToothCondition) => {
    if (readOnly || !onToothConditionChange) return;
    onToothConditionChange(toothNumber, cond);
  };

  const handleReset = () => {
    if (readOnly || !onResetTooth) return;
    onResetTooth(toothNumber);
  };

  return (
    <aside className="odn-3d-side-panel">
      <header className="odn-3d-panel-header">
        <div>
          <div className="odn-3d-panel-fdi">{toothNumber}</div>
          <div className="odn-3d-panel-name">{fdiToName(toothNumber)}</div>
        </div>
        <button
          type="button"
          className="odn-3d-panel-close"
          onClick={onClose}
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </header>

      {readOnly && (
        <div className="odn-3d-panel-banner">Modo solo lectura</div>
      )}

      <section className="odn-3d-panel-section">
        <h4>Condición del diente</h4>
        <div className="odn-3d-panel-chips">
          {TOOTH_CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`odn-3d-chip ${effectiveState.condition === c.value ? "active" : ""}`}
              onClick={() => handleTooth(c.value)}
              disabled={readOnly}
              style={{ borderColor: c.color }}
            >
              <span className="odn-3d-chip-dot" style={{ background: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="odn-3d-panel-section">
        <h4>Caras del diente</h4>
        {(Object.keys(SURFACE_LABELS) as Surface[]).map((surf) => {
          const current = effectiveState.surfaces[surf] ?? "none";
          return (
            <div key={surf} className="odn-3d-surface-row">
              <div className="odn-3d-surface-label">
                <span className="odn-3d-surface-key">{surf}</span>
                <span>{SURFACE_LABELS[surf]}</span>
              </div>
              <select
                className="odn-3d-surface-select"
                value={current}
                onChange={(e) => handleSurface(surf, e.target.value as SurfaceCondition)}
                disabled={readOnly}
              >
                {SURFACE_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </section>

      {!readOnly && (
        <footer className="odn-3d-panel-footer">
          <button type="button" className="odn-3d-reset-btn" onClick={handleReset}>
            🗑 Restablecer diente
          </button>
        </footer>
      )}
    </aside>
  );
};
