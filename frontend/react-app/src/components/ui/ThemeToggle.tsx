import { Sun, Moon, Monitor } from "lucide-react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ThemeMode } from "../../lib/theme";

const OPTIONS: { value: ThemeMode; icon: React.ReactNode; label: string; title: string }[] = [
  { value: "light",  icon: <Sun     size={13} strokeWidth={2} />, label: "Claro",   title: "Modo claro"        },
  { value: "dark",   icon: <Moon    size={13} strokeWidth={2} />, label: "Oscuro",  title: "Modo oscuro"       },
  { value: "system", icon: <Monitor size={13} strokeWidth={2} />, label: "Sistema", title: "Tema del sistema"  },
];

export function ThemeToggle({ current, onChange }: { current: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const handleChange = (value: ThemeMode) => {
    if (value) onChange(value);
  };

  return (
    <ToggleGroup.Root
      className="ThemeToggleRoot"
      type="single"
      value={current}
      onValueChange={handleChange}
      aria-label="Cambiar tema"
    >
      {OPTIONS.map((opt) => (
        <ToggleGroup.Item
          key={opt.value}
          className="ThemeToggleItem"
          value={opt.value}
          aria-label={opt.title}
          title={opt.title}
        >
          {opt.icon}
          <span className="ThemeToggleLabel">{opt.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
