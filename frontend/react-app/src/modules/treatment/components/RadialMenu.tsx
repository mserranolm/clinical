import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    RADIAL_MENU_ITEMS,
    type RadialMenuItem,
    type RadialMenuSubItem,
    type Surface,
    type SurfaceCondition,
    type ToothCondition,
} from './odontogram-types';

export interface RadialMenuProps {
  x: number;
  y: number;
  toothNumber: number;
  surface?: Surface;
  onSelectSurface?: (toothNum: number, surface: Surface, cond: SurfaceCondition) => void;
  onSelectTooth?: (toothNum: number, cond: ToothCondition) => void;
  onReset?: (toothNum: number) => void;
  onClose: () => void;
}

// Configuración geométrica del menú (estilo dona / pie menu)
const INNER_RADIUS = 54;
const OUTER_RADIUS = 168;
const SUB_RADIUS = 245; // Aumentar radio de sub-items para más espacio
const GAP_ANGLE = 0.05; // Espacio entre gajos (radianes)

// Función auxiliar para dibujar un gajo de dona (anular sector)
function describeArc(x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  // SVG arcs usan 0 grados en X positivo, creciendo en sentido horario
  // Ajustamos startAngle/endAngle (que vienen de -PI/2) a coordenadas SVG
  const polarToCartesian = (cx: number, cy: number, r: number, a: number) => {
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a)
    };
  };

  const startOut = polarToCartesian(x, y, outerRadius, endAngle);
  const endOut = polarToCartesian(x, y, outerRadius, startAngle);
  const startIn = polarToCartesian(x, y, innerRadius, endAngle);
  const endIn = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

  return [
    "M", startOut.x, startOut.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOut.x, endOut.y,
    "L", endIn.x, endIn.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startIn.x, startIn.y,
    "Z"
  ].join(" ");
}

const RadialMenu: React.FC<RadialMenuProps> = ({
  x, y, toothNumber, surface, onSelectSurface, onSelectTooth, onReset, onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const items = RADIAL_MENU_ITEMS.filter(item => {
    if (surface) return item.scope === 'surface' || item.scope === 'both';
    return item.scope === 'tooth' || item.scope === 'both';
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleMainClick = useCallback((item: RadialMenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.subItems && item.subItems.length > 0) {
      setExpandedId(prev => prev === item.id ? null : item.id);
      return;
    }
    if (item.id === 'borrar') {
      onReset?.(toothNumber);
      onClose();
      return;
    }
    if (item.id === 'sano') {
      if (surface && item.surfaceAction !== undefined) onSelectSurface?.(toothNumber, surface, 'none');
      if (item.toothAction !== undefined) onSelectTooth?.(toothNumber, 'none');
      onClose();
      return;
    }
    if (surface && item.surfaceAction) {
      onSelectSurface?.(toothNumber, surface, item.surfaceAction);
      onClose();
      return;
    }
    if (item.toothAction) {
      onSelectTooth?.(toothNumber, item.toothAction);
      onClose();
      return;
    }
  }, [toothNumber, surface, onSelectSurface, onSelectTooth, onReset, onClose]);

  const handleSubClick = useCallback((sub: RadialMenuSubItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (surface && sub.surfaceAction) onSelectSurface?.(toothNumber, surface, sub.surfaceAction);
    if (sub.toothAction) onSelectTooth?.(toothNumber, sub.toothAction);
    onClose();
  }, [toothNumber, surface, onSelectSurface, onSelectTooth, onClose]);

  const angleStep = (2 * Math.PI) / items.length;
  const startAngle = -Math.PI / 2 - angleStep / 2; // Centrar el primer item arriba

  const totalSize = SUB_RADIUS * 2 + 20;

  return createPortal(
    <div
      ref={ref}
      className={`odn-radial-menu ${visible ? 'odn-radial-visible' : ''}`}
      style={{ left: x, top: y, position: 'fixed', transform: 'translate(-50%, -50%)', zIndex: 9999 }}
    >
      {/* Círculo de fondo para el blur */}
      <div 
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: OUTER_RADIUS * 2, height: OUTER_RADIUS * 2,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          pointerEvents: 'none',
        }} 
      />
      <svg 
        width={totalSize} 
        height={totalSize} 
        viewBox={`-${totalSize/2} -${totalSize/2} ${totalSize} ${totalSize}`}
        style={{ filter: 'drop-shadow(0 8px 24px rgba(15, 23, 42, 0.25))', position: 'relative' }}
      >
        <g className="odn-radial-sectors">
          {items.map((item, i) => {
            const angle0 = startAngle + i * angleStep + GAP_ANGLE / 2;
            const angle1 = startAngle + (i + 1) * angleStep - GAP_ANGLE / 2;
            const midAngle = (angle0 + angle1) / 2;
            
            const isHovered = hoveredId === item.id;
            const isExpanded = expandedId === item.id;
            const currentOuter = isExpanded ? OUTER_RADIUS + 12 : OUTER_RADIUS;
            
            const iconRadius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * 0.35; // Icono más adentro
            const iconX = Math.cos(midAngle) * iconRadius;
            const iconY = Math.sin(midAngle) * iconRadius;
            
            const labelRadius = INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * 0.75; // Label más afuera
            const labelX = Math.cos(midAngle) * labelRadius;
            const labelY = Math.sin(midAngle) * labelRadius;

            // Arco SVG del botón principal
            const d = describeArc(0, 0, INNER_RADIUS, currentOuter, angle0, angle1);

            return (
              <g key={item.id} className="odn-radial-sector-group" 
                 onMouseEnter={() => setHoveredId(item.id)}
                 onMouseLeave={() => setHoveredId(null)}
                 onClick={(e) => handleMainClick(item, e)}>
                {/* Sector base */}
                <path 
                  d={d} 
                  fill={isHovered || isExpanded ? 'rgba(30, 41, 59, 0.95)' : 'rgba(51, 65, 85, 0.85)'} 
                  stroke={isHovered || isExpanded ? '#3b82f6' : 'rgba(255,255,255,0.15)'} 
                  strokeWidth="1.5"
                  className="odn-radial-sector-path"
                  style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                />
                
                {/* Icono/Círculo interior */}
                <circle cx={iconX} cy={iconY} r="16" fill={item.id === 'borrar' ? '#ef4444' : '#10b981'} />
                <text x={iconX} y={iconY + 4} textAnchor="middle" fill="white" fontSize="14" pointerEvents="none" dominantBaseline="middle">
                  {item.icon}
                </text>
                
                {/* Label principal */}
                <text x={labelX} y={labelY} textAnchor="middle" fill="white" fontSize="10.5" fontWeight="600" pointerEvents="none" dominantBaseline="middle">
                  {item.label}
                </text>
                
                {/* Indicador de sub-items */}
                {item.subItems && item.subItems.length > 0 && (
                  <path d={`M ${labelX - 4} ${labelY + 12} L ${labelX + 4} ${labelY + 12} L ${labelX} ${labelY + 16} Z`} fill="rgba(255,255,255,0.5)" />
                )}

                {/* Sub-items (anillo exterior) */}
                {isExpanded && item.subItems && (
                  <g className="odn-radial-sub-sectors">
                    {item.subItems.map((sub, si) => {
                      const subCount = item.subItems!.length;
                      const totalSubSpan = angle1 - angle0;
                      
                      // Si hay muchos items, necesitamos comprimirlos un poco, si son pocos, centrarlos
                      const subSpan = totalSubSpan / subCount;
                      const subA0 = angle0 + si * subSpan + 0.02; // Margen inicial
                      const subA1 = subA0 + subSpan - 0.04; // Margen final (espacio entre gajos)
                      const subMid = (subA0 + subA1) / 2;
                      
                      const subIconR = currentOuter + (SUB_RADIUS - currentOuter) * 0.45;
                      const sx = Math.cos(subMid) * subIconR;
                      const sy = Math.sin(subMid) * subIconR;
                      
                      const subD = describeArc(0, 0, currentOuter + 4, SUB_RADIUS, subA0, subA1);

                      return (
                        <g key={sub.id} className="odn-radial-sub-group" onClick={(e) => handleSubClick(sub, e)}>
                          <path 
                            d={subD} 
                            fill="rgba(30, 41, 59, 0.95)" 
                            stroke={sub.color} 
                            strokeWidth="2"
                            className="odn-radial-sub-path"
                            style={{ cursor: 'pointer' }}
                          />
                          <circle cx={sx} cy={sy - 8} r="6" fill={sub.color} pointerEvents="none" />
                          <text x={sx} y={sy + 8} textAnchor="middle" fill="white" fontSize="10" fontWeight="600" pointerEvents="none">
                            {sub.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Círculo central "Hueco" / Info */}
        <circle cx="0" cy="0" r={INNER_RADIUS - 4} fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        <text x="0" y="-4" textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="800" dominantBaseline="middle">
          {toothNumber}
        </text>
        {surface && (
          <text x="0" y="16" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="700">
            {surface}
          </text>
        )}
      </svg>
    </div>,
    document.body
  );
};

export { RadialMenu };
