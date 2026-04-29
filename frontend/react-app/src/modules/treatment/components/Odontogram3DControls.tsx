import React from "react";

export interface Odontogram3DControlsProps {
  jawOpen: number; // 0..1
  gumOpacity: number; // 0..1 (1 = opaca, 0 = invisible)
  onJawOpenChange: (value: number) => void;
  onGumOpacityChange: (value: number) => void;
}

type Preset = {
  id: string;
  label: string;
  jawOpen: number;
  gumOpacity: number;
};

const PRESETS: Preset[] = [
  { id: "closed", label: "Cerrada", jawOpen: 0, gumOpacity: 1 },
  { id: "open", label: "Abierta", jawOpen: 0.85, gumOpacity: 1 },
  { id: "roots", label: "Encía visible", jawOpen: 0.3, gumOpacity: 0.25 },
  { id: "teeth-only", label: "Solo dientes", jawOpen: 0.3, gumOpacity: 0 },
];

export const Odontogram3DControls: React.FC<Odontogram3DControlsProps> = ({
  jawOpen,
  gumOpacity,
  onJawOpenChange,
  onGumOpacityChange,
}) => {
  const applyPreset = (p: Preset) => {
    onJawOpenChange(p.jawOpen);
    onGumOpacityChange(p.gumOpacity);
  };

  const activePreset = PRESETS.find(
    (p) => Math.abs(p.jawOpen - jawOpen) < 0.05 && Math.abs(p.gumOpacity - gumOpacity) < 0.08,
  );

  return (
    <div className="odn-3d-controls">
      <div className="odn-3d-presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`odn-3d-preset-btn ${activePreset?.id === p.id ? "active" : ""}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="odn-3d-sliders">
        <label className="odn-3d-slider">
          <div className="odn-3d-slider-row">
            <span>Apertura mandibular</span>
            <span className="odn-3d-slider-value">{Math.round(jawOpen * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(jawOpen * 100)}
            onChange={(e) => onJawOpenChange(Number(e.target.value) / 100)}
          />
        </label>

        <label className="odn-3d-slider">
          <div className="odn-3d-slider-row">
            <span>Opacidad encía</span>
            <span className="odn-3d-slider-value">{Math.round(gumOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(gumOpacity * 100)}
            onChange={(e) => onGumOpacityChange(Number(e.target.value) / 100)}
          />
        </label>
      </div>
    </div>
  );
};
