import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, parse, isValid } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import "react-day-picker/src/style.css";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
}

export function DatePicker({ value, onChange, name, required, placeholder = "Seleccionar fecha" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);

  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  const displayValue = selected ? format(selected, "d 'de' MMMM, yyyy", { locale: es }) : "";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const target = e.target as Element;
        if (!target.closest(".datepicker-popover-portal")) {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openPopover() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popoverHeight = 320;
      const openUpward = spaceBelow < popoverHeight && rect.top > popoverHeight;

      setPopoverStyle({
        position: "fixed",
        zIndex: 9999,
        width: Math.max(rect.width, 260),
        left: rect.left,
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    }
    setOpen((o) => !o);
  }

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  return (
    <div ref={triggerRef} style={{ position: "relative", width: "100%" }}>
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        onClick={openPopover}
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

      {open && createPortal(
        <div className="datepicker-popover datepicker-popover-portal" style={popoverStyle}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={es}
            defaultMonth={selected ?? new Date()}
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
