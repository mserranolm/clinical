import React from 'react';

type Surface = 'O' | 'V' | 'L' | 'M' | 'D';

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

interface ToothProps {
  number: number;
  conditions?: Record<Surface, string>;
  onSurfaceClick?: (toothNumber: number, surface: Surface) => void;
  isTemporary?: boolean;
}

const Tooth: React.FC<ToothProps> = ({ number, conditions = {} as Record<Surface, string>, onSurfaceClick, isTemporary }) => {
  const get = (s: Surface) => conditions[s] ?? 'none';
  const click = (s: Surface) => onSurfaceClick?.(number, s);
  const size = isTemporary ? 40 : 50;

  return (
    <div className="odn-tooth" style={{ width: size, flexShrink: 0 }}>
      <span className="odn-tooth-num" style={{ fontSize: isTemporary ? '0.55rem' : '0.62rem' }}>{number}</span>
      <svg
        viewBox="0 0 60 60"
        width={size}
        height={size}
        style={{ display: 'block', cursor: 'pointer' }}
      >
        {/* Vestibular — top */}
        <polygon
          points="0,0 60,0 45,15 15,15"
          fill={CONDITION_COLORS[get('V')]}
          stroke={CONDITION_STROKE[get('V')]}
          strokeWidth="1.5"
          onClick={() => click('V')}
          className="odn-surface"
        />
        {/* Lingual — bottom */}
        <polygon
          points="0,60 60,60 45,45 15,45"
          fill={CONDITION_COLORS[get('L')]}
          stroke={CONDITION_STROKE[get('L')]}
          strokeWidth="1.5"
          onClick={() => click('L')}
          className="odn-surface"
        />
        {/* Mesial — left */}
        <polygon
          points="0,0 15,15 15,45 0,60"
          fill={CONDITION_COLORS[get('M')]}
          stroke={CONDITION_STROKE[get('M')]}
          strokeWidth="1.5"
          onClick={() => click('M')}
          className="odn-surface"
        />
        {/* Distal — right */}
        <polygon
          points="60,0 45,15 45,45 60,60"
          fill={CONDITION_COLORS[get('D')]}
          stroke={CONDITION_STROKE[get('D')]}
          strokeWidth="1.5"
          onClick={() => click('D')}
          className="odn-surface"
        />
        {/* Occlusal — center */}
        <rect
          x="15" y="15" width="30" height="30"
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

/* ── Quadrant label ─────────────────────────────────────────── */
const QuadrantLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="odn-quadrant-label">{label}</div>
);

/* ── Divider ────────────────────────────────────────────────── */
const HDivider: React.FC = () => <div className="odn-h-divider" />;
const VDivider: React.FC = () => <div className="odn-v-divider" />;

/* ── Main chart ─────────────────────────────────────────────── */
export const OdontogramChart: React.FC<{
  toothStates?: Record<number, Record<Surface, string>>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
}> = ({ toothStates = {}, onToothClick }) => {

  const renderRow = (numbers: number[], isTemp = false) => (
    <div className="odn-row">
      {numbers.map(n => (
        <Tooth
          key={n}
          number={n}
          isTemporary={isTemp}
          conditions={toothStates[n]}
          onSurfaceClick={onToothClick}
        />
      ))}
    </div>
  );

  return (
    <div className="odn-chart">
      {/* ── Upper arch ── */}
      <div className="odn-arch-label">SUPERIOR</div>
      <div className="odn-arch">
        <div className="odn-half">
          <QuadrantLabel label="Q1 — Sup. Derecho" />
          {renderRow([18, 17, 16, 15, 14, 13, 12, 11])}
        </div>
        <VDivider />
        <div className="odn-half">
          <QuadrantLabel label="Q2 — Sup. Izquierdo" />
          {renderRow([21, 22, 23, 24, 25, 26, 27, 28])}
        </div>
      </div>

      {/* ── Temporary teeth ── */}
      <div className="odn-temp-section">
        <div className="odn-arch-label odn-arch-label--temp">TEMPORALES</div>
        <div className="odn-arch">
          <div className="odn-half">
            <div className="odn-temp-pair">
              {renderRow([55, 54, 53, 52, 51], true)}
              {renderRow([85, 84, 83, 82, 81], true)}
            </div>
          </div>
          <VDivider />
          <div className="odn-half">
            <div className="odn-temp-pair">
              {renderRow([61, 62, 63, 64, 65], true)}
              {renderRow([71, 72, 73, 74, 75], true)}
            </div>
          </div>
        </div>
      </div>

      <HDivider />

      {/* ── Lower arch ── */}
      <div className="odn-arch">
        <div className="odn-half">
          <QuadrantLabel label="Q4 — Inf. Derecho" />
          {renderRow([48, 47, 46, 45, 44, 43, 42, 41])}
        </div>
        <VDivider />
        <div className="odn-half">
          <QuadrantLabel label="Q3 — Inf. Izquierdo" />
          {renderRow([31, 32, 33, 34, 35, 36, 37, 38])}
        </div>
      </div>
      <div className="odn-arch-label">INFERIOR</div>
    </div>
  );
};
