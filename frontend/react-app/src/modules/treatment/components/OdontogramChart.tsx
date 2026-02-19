import React from 'react';

type Surface = 'O' | 'V' | 'L' | 'M' | 'D'; // Occlusal, Vestibular, Lingual, Mesial, Distal

interface ToothProps {
  number: number;
  onSurfaceClick?: (toothNumber: number, surface: Surface) => void;
  conditions?: Record<Surface, string>;
  isTemporary?: boolean;
}

const Tooth: React.FC<ToothProps> = ({ number, onSurfaceClick, conditions = {}, isTemporary }) => {
  const getSurfaceColor = (surface: Surface) => {
    const condition = conditions[surface];
    switch (condition) {
      case 'caries': return '#ef4444';
      case 'restored': return '#3b82f6';
      case 'completed': return '#10b981';
      default: return 'white';
    }
  };

  const handleInteraction = (surface: Surface) => {
    if (onSurfaceClick) {
      onSurfaceClick(number, surface);
    }
  };

  return (
    <div className={`tooth-container ${isTemporary ? 'temporary' : ''}`}>
      <span className="tooth-number">{number}</span>
      <svg viewBox="0 0 100 100" className="tooth-svg">
        {/* Top - Vestibular (V) */}
        <path
          d="M 0 0 L 100 0 L 70 30 L 30 30 Z"
          fill={getSurfaceColor('V')}
          stroke="#334155"
          strokeWidth="1.5"
          onClick={() => handleInteraction('V')}
        />
        {/* Bottom - Lingual (L) */}
        <path
          d="M 0 100 L 100 100 L 70 70 L 30 70 Z"
          fill={getSurfaceColor('L')}
          stroke="#334155"
          strokeWidth="1.5"
          onClick={() => handleInteraction('L')}
        />
        {/* Left - Mesial (M) */}
        <path
          d="M 0 0 L 30 30 L 30 70 L 0 100 Z"
          fill={getSurfaceColor('M')}
          stroke="#334155"
          strokeWidth="1.5"
          onClick={() => handleInteraction('M')}
        />
        {/* Right - Distal (D) */}
        <path
          d="M 100 0 L 70 30 L 70 70 L 100 100 Z"
          fill={getSurfaceColor('D')}
          stroke="#334155"
          strokeWidth="1.5"
          onClick={() => handleInteraction('D')}
        />
        {/* Center - Occlusal (O) */}
        <rect
          x="30" y="30" width="40" height="40"
          fill={getSurfaceColor('O')}
          stroke="#334155"
          strokeWidth="1.5"
          onClick={() => handleInteraction('O')}
        />
      </svg>
    </div>
  );
};

export const OdontogramChart: React.FC<{
  toothStates?: Record<number, Record<Surface, string>>;
  onToothClick?: (toothNum: number, surface: Surface) => void;
}> = ({ toothStates = {}, onToothClick }) => {
  
  const renderRow = (numbers: number[], isTemp = false) => (
    <div className="odontogram-row">
      {numbers.map(num => (
        <Tooth 
          key={num} 
          number={num} 
          isTemporary={isTemp}
          onSurfaceClick={onToothClick}
          conditions={toothStates[num]}
        />
      ))}
    </div>
  );

  return (
    <div className="odontogram-wrapper">
      <div className="odontogram-main">
        <div className="odontogram-grid">
          {/* Upper row: 18-11 and 21-28 */}
          <div className="odontogram-quadrants">
            {renderRow([18, 17, 16, 15, 14, 13, 12, 11])}
            <div className="divider-v" />
            {renderRow([21, 22, 23, 24, 25, 26, 27, 28])}
          </div>
          
          {/* Middle rows (temporary): 55-51, 61-65, 85-81, 71-75 */}
          <div className="odontogram-quadrants temporary-section">
            <div className="temp-rows-stack">
              {renderRow([55, 54, 53, 52, 51], true)}
              {renderRow([85, 84, 83, 82, 81], true)}
            </div>
            <div className="divider-v" />
            <div className="temp-rows-stack">
              {renderRow([61, 62, 63, 64, 65], true)}
              {renderRow([71, 72, 73, 74, 75], true)}
            </div>
          </div>

          {/* Lower row: 48-41 and 31-38 */}
          <div className="odontogram-quadrants">
            {renderRow([48, 47, 46, 45, 44, 43, 42, 41])}
            <div className="divider-v" />
            {renderRow([31, 32, 33, 34, 35, 36, 37, 38])}
          </div>
        </div>
      </div>

      <div className="odontogram-legend">
        <div className="legend-item"><span className="box healthy" /> Sano</div>
        <div className="legend-item"><span className="box caries" /> Caries</div>
        <div className="legend-item"><span className="box restored" /> Restaurado</div>
        <div className="legend-item"><span className="box completed" /> Terminado</div>
      </div>
    </div>
  );
};
