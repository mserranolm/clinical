import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    RADIAL_MENU_ITEMS,
    type RadialMenuItem,
    type RadialMenuSubItem,
    type Surface,
    type SurfaceCondition,
    type ToothCondition,
} from './odontogram-types';

export interface RadialMenuProps {
  /** Posición en píxeles (relativa al contenedor del odontograma) */
  x: number;
  y: number;
  toothNumber: number;
  /** Si se clicó en una superficie específica */
  surface?: Surface;
  onSelectSurface?: (toothNum: number, surface: Surface, cond: SurfaceCondition) => void;
  onSelectTooth?: (toothNum: number, cond: ToothCondition) => void;
  /** Borrar todo: resetear diente */
  onReset?: (toothNum: number) => void;
  onClose: () => void;
}

const RADIUS_MAIN = 82;
const RADIUS_SUB = 46;
const BTN_SIZE = 38;

export const RadialMenu: React.FC<RadialMenuProps> = ({
  x, y, toothNumber, surface, onSelectSurface, onSelectTooth, onReset, onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Filtrar items según scope
  const items = RADIAL_MENU_ITEMS.filter(item => {
    if (surface) return item.scope === 'surface' || item.scope === 'both';
    return item.scope === 'tooth' || item.scope === 'both';
  });

  // Animación de entrada
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Cerrar al click fuera
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

  const handleMainClick = useCallback((item: RadialMenuItem) => {
    // Si tiene sub-items, expandir/colapsar
    if (item.subItems && item.subItems.length > 0) {
      setExpandedId(prev => prev === item.id ? null : item.id);
      return;
    }

    // Acción de "borrar todo"
    if (item.id === 'borrar') {
      onReset?.(toothNumber);
      onClose();
      return;
    }

    // Acción de "sano" — resetear superficie o diente
    if (item.id === 'sano') {
      if (surface && item.surfaceAction !== undefined) {
        onSelectSurface?.(toothNumber, surface, 'none');
      }
      if (item.toothAction !== undefined) {
        onSelectTooth?.(toothNumber, 'none');
      }
      onClose();
      return;
    }

    // Acción directa de superficie
    if (surface && item.surfaceAction) {
      onSelectSurface?.(toothNumber, surface, item.surfaceAction);
      onClose();
      return;
    }

    // Acción directa de diente
    if (item.toothAction) {
      onSelectTooth?.(toothNumber, item.toothAction);
      onClose();
      return;
    }
  }, [toothNumber, surface, onSelectSurface, onSelectTooth, onReset, onClose]);

  const handleSubClick = useCallback((sub: RadialMenuSubItem) => {
    if (surface && sub.surfaceAction) {
      onSelectSurface?.(toothNumber, surface, sub.surfaceAction);
    }
    if (sub.toothAction) {
      onSelectTooth?.(toothNumber, sub.toothAction);
    }
    onClose();
  }, [toothNumber, surface, onSelectSurface, onSelectTooth, onClose]);

  const angleStep = (2 * Math.PI) / items.length;
  const startAngle = -Math.PI / 2; // empezar arriba

  return (
    <div
      ref={ref}
      className={`odn-radial-menu ${visible ? 'odn-radial-visible' : ''}`}
      style={{ left: x, top: y }}
    >
      {/* Backdrop circular */}
      <div className="odn-radial-backdrop" />

      {/* Número del diente en el centro */}
      <div className="odn-radial-center">
        <span className="odn-radial-tooth-num">{toothNumber}</span>
        {surface && <span className="odn-radial-surface-label">{surface}</span>}
      </div>

      {/* Botones principales */}
      {items.map((item, i) => {
        const angle = startAngle + i * angleStep;
        const ix = Math.cos(angle) * RADIUS_MAIN;
        const iy = Math.sin(angle) * RADIUS_MAIN;
        const isExpanded = expandedId === item.id;
        const hasSub = item.subItems && item.subItems.length > 0;

        return (
          <React.Fragment key={item.id}>
            {/* Wrapper de posicionamiento — el translate vive aquí */}
            <div
              className="odn-radial-btn-wrap"
              style={{
                transform: `translate(${ix}px, ${iy}px)`,
                transitionDelay: `${i * 25}ms`,
              }}
            >
              <button
                type="button"
                className={`odn-radial-btn ${isExpanded ? 'odn-radial-btn--active' : ''}`}
                onClick={() => handleMainClick(item)}
                title={item.label}
              >
                <span className="odn-radial-icon">{item.icon}</span>
                {hasSub && <span className="odn-radial-arrow">›</span>}
              </button>
            </div>

            {/* Label flotante */}
            <div
              className="odn-radial-label"
              style={{
                transform: `translate(${ix}px, ${iy + BTN_SIZE * 0.7}px)`,
                transitionDelay: `${i * 25 + 40}ms`,
              }}
            >
              {item.label}
            </div>

            {/* Sub-items en arco más externo */}
            {isExpanded && item.subItems && item.subItems.map((sub, si) => {
              const subCount = item.subItems!.length;
              const subSpan = Math.PI * 0.4;
              const subStart = angle - subSpan / 2;
              const subAngle = subCount === 1 ? angle : subStart + (si / (subCount - 1)) * subSpan;
              const sx = Math.cos(subAngle) * (RADIUS_MAIN + RADIUS_SUB);
              const sy = Math.sin(subAngle) * (RADIUS_MAIN + RADIUS_SUB);

              return (
                <div
                  key={sub.id}
                  className="odn-radial-sub-wrap"
                  style={{
                    transform: `translate(${sx}px, ${sy}px)`,
                    transitionDelay: `${si * 30}ms`,
                  }}
                >
                  <button
                    type="button"
                    className="odn-radial-sub-btn"
                    style={{ borderColor: sub.color }}
                    onClick={() => handleSubClick(sub)}
                    title={sub.label}
                  >
                    <span
                      className="odn-radial-sub-dot"
                      style={{ background: sub.color }}
                    />
                    <span className="odn-radial-sub-label">{sub.label}</span>
                  </button>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
