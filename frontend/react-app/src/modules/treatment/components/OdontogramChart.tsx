import React, { useState } from 'react';

// Tooth parts/surfaces: O (Occlusal), V (Vestibular), L (Lingual), M (Mesial), D (Distal)
type Surface = 'O' | 'V' | 'L' | 'M' | 'D';

interface ToothProps {
  number: number;
  onSurfaceClick: (toothNumber: number, surface: Surface) => void;
  conditions: Record<Surface, string>;
  isTemporary?: boolean;
}

const Tooth: React.FC<ToothProps> = ({ number, onSurfaceClick, conditions, isTemporary }) => {
  const getSurfaceColor = (surface: Surface) => {
    const condition = conditions[surface];
    switch (condition) {
      case 'caries': return '#ef4444'; // Red
      case 'restored': return '#3b82f6'; // Blue
      case 'completed': return '#10b981'; // Emerald/Green
      default: return 'white';
    }
  };

  return (
    <div className={`tooth-container ${isTemporary ? 'temporary' : ''}`}>
      <span className="tooth-number">{number}</span>
      <svg viewBox="0 0 100 100" className="tooth-svg">
        {/* Top - Vestibular (V) */}
        <path
          d="M 50 50 L 0 0 L 100 0 Z"
          fill={getSurfaceColor('V')}
          stroke="#0f172a"
          strokeWidth="1"
          onClick={() => onSurfaceClick(number, 'V')}
        />
        {/* Right - Distal or Mesial (D) */}
        <path
          d="M 50 50 L 100 0 L 100 100 Z"
          fill={getSurfaceColor('D')}
          stroke="#0f172a"
          strokeWidth="1"
          onClick={() => onSurfaceClick(number, 'D')}
        />
        {/* Bottom - Lingual (L) */}
        <path
          d="M 50 50 L 100 100 L 0 100 Z"
          fill={getSurfaceColor('L')}
          stroke="#0f172a"
          strokeWidth="1"
          onClick={() => onSurfaceClick(number, 'L')}
        />
        {/* Left - Mesial or Distal (M) */}
        <path
          d="M 50 50 L 0 100 L 0 0 Z"
          fill={getSurfaceColor('M')}
          stroke="#0f172a"
          strokeWidth="1"
          onClick={() => onSurfaceClick(number, 'M')}
        />
        {/* Center - Occlusal (O) */}
        <circle
          cx="50" cy="50" r="25"
          fill={getSurfaceColor('O')}
          stroke="#0f172a"
          strokeWidth="1"
          onClick={() => onSurfaceClick(number, 'O')}
        />
      </svg>
    </div>
  );
};

export const OdontogramChart: React.FC = () => {
  const [toothStates, setToothStates] = useState<Record<number, Record<Surface, string>>>({});

  const handleSurfaceClick = (toothNum: number, surface: Surface) => {
    setToothStates(prev => {
      const currentTooth = prev[toothNum] || { O: 'none', V: 'none', L: 'none', M: 'none', D: 'none' };
      const conditions = ['none', 'caries', 'restored', 'completed'];
      const currentIdx = conditions.indexOf(currentTooth[surface]);
      const nextCondition = conditions[(currentIdx + 1) % conditions.length];
      
      return {
        ...prev,
        [toothNum]: {
          ...currentTooth,
          [surface]: nextCondition
        }
      };
    });
  };

  const renderRow = (numbers: number[], isTemp = false) => (
    <div className="odontogram-row">
      {numbers.map(num => (
        <Tooth 
          key={num} 
          number={num} 
          isTemporary={isTemp}
          onSurfaceClick={handleSurfaceClick}
          conditions={toothStates[num] || { O: 'none', V: 'none', L: 'none', M: 'none', D: 'none' }}
        />
      ))}
    </div>
  );

  return (
    <div className="odontogram-wrapper">
      <div className="odontogram-main">
        <div className="odontogram-grid">
          {/* Upper Permanent */}
          <div className="odontogram-quadrants">
            {renderRow([18, 17, 16, 15, 14, 13, 12, 11])}
            <div className="divider-v" />
            {renderRow([21, 22, 23, 24, 25, 26, 27, 28])}
          </div>
          
          {/* Temporary teeth (Middle) */}
          <div className="odontogram-quadrants temporary-section">
            <div className="temp-rows">
              {renderRow([55, 54, 53, 52, 51], true)}
              {renderRow([85, 84, 83, 82, 81], true)}
            </div>
            <div className="divider-v" />
            <div className="temp-rows">
              {renderRow([61, 62, 63, 64, 65], true)}
              {renderRow([71, 72, 73, 74, 75], true)}
            </div>
          </div>

          {/* Lower Permanent */}
          <div className="odontogram-quadrants">
            {renderRow([48, 47, 46, 45, 44, 43, 42, 41])}
            <div className="divider-v" />
            {renderRow([31, 32, 33, 34, 35, 36, 37, 38])}
          </div>
        </div>
      </div>

      <div className="odontogram-legend">
        <div className="legend-item"><span className="box healthy" /> Sano</div>
        <div className="legend-item"><span className="box caries" /> Caries (Rojo)</div>
        <div className="legend-item"><span className="box restored" /> Restaurado (Azul)</div>
        <div className="legend-item"><span className="box completed" /> Terminado (Verde)</div>
      </div>
    </div>
  );
};
