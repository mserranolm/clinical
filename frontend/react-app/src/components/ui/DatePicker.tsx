import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { createPortal } from "react-dom";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
}

function toCalendarDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DatePicker({
  value,
  onChange,
  name,
  required,
  placeholder = "Seleccionar fecha",
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  const displayValue = selected ? format(selected, "d 'de' MMMM, yyyy", { locale: es }) : "";
  const normalizedMinDate = minDate ? toCalendarDate(minDate) : undefined;
  const normalizedMaxDate = maxDate ? toCalendarDate(maxDate) : undefined;
  const currentYear = new Date().getFullYear();
  const fromYear = normalizedMinDate ? normalizedMinDate.getFullYear() : currentYear - 110;
  const toYear = normalizedMaxDate ? normalizedMaxDate.getFullYear() : currentYear + 20;
  const disabledMatchers: Matcher[] = [];
  if (normalizedMinDate) disabledMatchers.push({ before: normalizedMinDate });
  if (normalizedMaxDate) disabledMatchers.push({ after: normalizedMaxDate });

  // Recalcular posición cada vez que se abre o el trigger se mueve
  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
  }, [open]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        !target.closest("[data-dp-portal]")
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Cerrar al hacer scroll (ignorar scroll dentro del propio portal)
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const target = e.target as Element;
      if (target && target.closest("[data-dp-portal]")) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  // Calcular posición del popover: abajo o arriba según espacio disponible
  function getPopoverStyle(): React.CSSProperties {
    if (!rect) return { display: "none" };
    const popoverH = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= popoverH
      ? rect.bottom + window.scrollY + 4
      : rect.top + window.scrollY - popoverH - 4;
    return {
      position: "absolute",
      top,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 260),
      zIndex: 99999,
    };
  }

  return (
    <div ref={triggerRef} style={{ position: "relative", width: "100%" }}>
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="datepicker-trigger"
      >
        <CalendarDays size={15} strokeWidth={1.5} style={{ color: "#0d9488", flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left", color: displayValue ? "#0f172a" : "#94a3b8" }}>
          {displayValue || placeholder}
        </span>
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          style={{
            color: "#94a3b8",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {open && rect && createPortal(
        <div data-dp-portal className="datepicker-popover" style={getPopoverStyle()}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={es}
            defaultMonth={selected ?? normalizedMinDate ?? new Date()}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
            components={{
              Chevron: ({ orientation, ...props }) =>
                orientation === "left"
                  ? <ChevronLeft size={15} strokeWidth={1.5} {...props} />
                  : <ChevronRight size={15} strokeWidth={1.5} {...props} />,
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
