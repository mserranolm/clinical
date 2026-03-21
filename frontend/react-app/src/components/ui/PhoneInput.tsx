import { useEffect, useRef, useState } from "react";
import { useThemeTokens } from "../../lib/use-is-dark";

// ── Types ─────────────────────────────────────────────────────────────────────

type CountryEntry = {
  code: string; // ISO-2: "CO"
  flag: string; // emoji: "🇨🇴"
  name: string; // "Colombia"
  dial: string; // "+57"
};

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  name?: string; // adds <input type="hidden"> for FormData compatibility
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

// ── Country list ──────────────────────────────────────────────────────────────

const PRIORITY_COUNTRIES: CountryEntry[] = [
  { code: "CO", flag: "🇨🇴", name: "Colombia", dial: "+57" },
  { code: "MX", flag: "🇲🇽", name: "México", dial: "+52" },
  { code: "VE", flag: "🇻🇪", name: "Venezuela", dial: "+58" },
  { code: "AR", flag: "🇦🇷", name: "Argentina", dial: "+54" },
  { code: "CL", flag: "🇨🇱", name: "Chile", dial: "+56" },
  { code: "PE", flag: "🇵🇪", name: "Perú", dial: "+51" },
  { code: "EC", flag: "🇪🇨", name: "Ecuador", dial: "+593" },
  { code: "BO", flag: "🇧🇴", name: "Bolivia", dial: "+591" },
  { code: "PY", flag: "🇵🇾", name: "Paraguay", dial: "+595" },
  { code: "UY", flag: "🇺🇾", name: "Uruguay", dial: "+598" },
  { code: "PA", flag: "🇵🇦", name: "Panamá", dial: "+507" },
  { code: "CR", flag: "🇨🇷", name: "Costa Rica", dial: "+506" },
  { code: "DO", flag: "🇩🇴", name: "Rep. Dominicana", dial: "+1" },
  { code: "US", flag: "🇺🇸", name: "Estados Unidos", dial: "+1" },
  { code: "ES", flag: "🇪🇸", name: "España", dial: "+34" },
  { code: "GB", flag: "🇬🇧", name: "Reino Unido", dial: "+44" },
];

const REST_OF_WORLD: CountryEntry[] = [
  { code: "AD", flag: "🇦🇩", name: "Andorra", dial: "+376" },
  { code: "AE", flag: "🇦🇪", name: "Emiratos Árabes", dial: "+971" },
  { code: "AF", flag: "🇦🇫", name: "Afganistán", dial: "+93" },
  { code: "AG", flag: "🇦🇬", name: "Antigua y Barbuda", dial: "+1" },
  { code: "AL", flag: "🇦🇱", name: "Albania", dial: "+355" },
  { code: "AM", flag: "🇦🇲", name: "Armenia", dial: "+374" },
  { code: "AO", flag: "🇦🇴", name: "Angola", dial: "+244" },
  { code: "AT", flag: "🇦🇹", name: "Austria", dial: "+43" },
  { code: "AU", flag: "🇦🇺", name: "Australia", dial: "+61" },
  { code: "AZ", flag: "🇦🇿", name: "Azerbaiyán", dial: "+994" },
  { code: "BA", flag: "🇧🇦", name: "Bosnia y Herzegovina", dial: "+387" },
  { code: "BB", flag: "🇧🇧", name: "Barbados", dial: "+1" },
  { code: "BD", flag: "🇧🇩", name: "Bangladés", dial: "+880" },
  { code: "BE", flag: "🇧🇪", name: "Bélgica", dial: "+32" },
  { code: "BF", flag: "🇧🇫", name: "Burkina Faso", dial: "+226" },
  { code: "BG", flag: "🇧🇬", name: "Bulgaria", dial: "+359" },
  { code: "BH", flag: "🇧🇭", name: "Baréin", dial: "+973" },
  { code: "BI", flag: "🇧🇮", name: "Burundi", dial: "+257" },
  { code: "BJ", flag: "🇧🇯", name: "Benín", dial: "+229" },
  { code: "BN", flag: "🇧🇳", name: "Brunéi", dial: "+673" },
  { code: "BR", flag: "🇧🇷", name: "Brasil", dial: "+55" },
  { code: "BS", flag: "🇧🇸", name: "Bahamas", dial: "+1" },
  { code: "BT", flag: "🇧🇹", name: "Bután", dial: "+975" },
  { code: "BW", flag: "🇧🇼", name: "Botsuana", dial: "+267" },
  { code: "BY", flag: "🇧🇾", name: "Bielorrusia", dial: "+375" },
  { code: "BZ", flag: "🇧🇿", name: "Belice", dial: "+501" },
  { code: "CA", flag: "🇨🇦", name: "Canadá", dial: "+1" },
  { code: "CD", flag: "🇨🇩", name: "Congo (RDC)", dial: "+243" },
  { code: "CF", flag: "🇨🇫", name: "Rep. Centroafricana", dial: "+236" },
  { code: "CG", flag: "🇨🇬", name: "Congo", dial: "+242" },
  { code: "CH", flag: "🇨🇭", name: "Suiza", dial: "+41" },
  { code: "CI", flag: "🇨🇮", name: "Costa de Marfil", dial: "+225" },
  { code: "CM", flag: "🇨🇲", name: "Camerún", dial: "+237" },
  { code: "CN", flag: "🇨🇳", name: "China", dial: "+86" },
  { code: "CU", flag: "🇨🇺", name: "Cuba", dial: "+53" },
  { code: "CV", flag: "🇨🇻", name: "Cabo Verde", dial: "+238" },
  { code: "CY", flag: "🇨🇾", name: "Chipre", dial: "+357" },
  { code: "CZ", flag: "🇨🇿", name: "Chequia", dial: "+420" },
  { code: "DE", flag: "🇩🇪", name: "Alemania", dial: "+49" },
  { code: "DJ", flag: "🇩🇯", name: "Yibuti", dial: "+253" },
  { code: "DK", flag: "🇩🇰", name: "Dinamarca", dial: "+45" },
  { code: "DM", flag: "🇩🇲", name: "Dominica", dial: "+1" },
  { code: "DZ", flag: "🇩🇿", name: "Argelia", dial: "+213" },
  { code: "EE", flag: "🇪🇪", name: "Estonia", dial: "+372" },
  { code: "EG", flag: "🇪🇬", name: "Egipto", dial: "+20" },
  { code: "ER", flag: "🇪🇷", name: "Eritrea", dial: "+291" },
  { code: "ET", flag: "🇪🇹", name: "Etiopía", dial: "+251" },
  { code: "FI", flag: "🇫🇮", name: "Finlandia", dial: "+358" },
  { code: "FJ", flag: "🇫🇯", name: "Fiyi", dial: "+679" },
  { code: "FR", flag: "🇫🇷", name: "Francia", dial: "+33" },
  { code: "GA", flag: "🇬🇦", name: "Gabón", dial: "+241" },
  { code: "GD", flag: "🇬🇩", name: "Granada", dial: "+1" },
  { code: "GE", flag: "🇬🇪", name: "Georgia", dial: "+995" },
  { code: "GH", flag: "🇬🇭", name: "Ghana", dial: "+233" },
  { code: "GM", flag: "🇬🇲", name: "Gambia", dial: "+220" },
  { code: "GN", flag: "🇬🇳", name: "Guinea", dial: "+224" },
  { code: "GQ", flag: "🇬🇶", name: "Guinea Ecuatorial", dial: "+240" },
  { code: "GR", flag: "🇬🇷", name: "Grecia", dial: "+30" },
  { code: "GT", flag: "🇬🇹", name: "Guatemala", dial: "+502" },
  { code: "GW", flag: "🇬🇼", name: "Guinea-Bisáu", dial: "+245" },
  { code: "GY", flag: "🇬🇾", name: "Guyana", dial: "+592" },
  { code: "HN", flag: "🇭🇳", name: "Honduras", dial: "+504" },
  { code: "HR", flag: "🇭🇷", name: "Croacia", dial: "+385" },
  { code: "HT", flag: "🇭🇹", name: "Haití", dial: "+509" },
  { code: "HU", flag: "🇭🇺", name: "Hungría", dial: "+36" },
  { code: "ID", flag: "🇮🇩", name: "Indonesia", dial: "+62" },
  { code: "IE", flag: "🇮🇪", name: "Irlanda", dial: "+353" },
  { code: "IL", flag: "🇮🇱", name: "Israel", dial: "+972" },
  { code: "IN", flag: "🇮🇳", name: "India", dial: "+91" },
  { code: "IQ", flag: "🇮🇶", name: "Irak", dial: "+964" },
  { code: "IR", flag: "🇮🇷", name: "Irán", dial: "+98" },
  { code: "IS", flag: "🇮🇸", name: "Islandia", dial: "+354" },
  { code: "IT", flag: "🇮🇹", name: "Italia", dial: "+39" },
  { code: "JM", flag: "🇯🇲", name: "Jamaica", dial: "+1" },
  { code: "JO", flag: "🇯🇴", name: "Jordania", dial: "+962" },
  { code: "JP", flag: "🇯🇵", name: "Japón", dial: "+81" },
  { code: "KE", flag: "🇰🇪", name: "Kenia", dial: "+254" },
  { code: "KG", flag: "🇰🇬", name: "Kirguistán", dial: "+996" },
  { code: "KH", flag: "🇰🇭", name: "Camboya", dial: "+855" },
  { code: "KI", flag: "🇰🇮", name: "Kiribati", dial: "+686" },
  { code: "KM", flag: "🇰🇲", name: "Comoras", dial: "+269" },
  { code: "KN", flag: "🇰🇳", name: "San Cristóbal y Nieves", dial: "+1" },
  { code: "KP", flag: "🇰🇵", name: "Corea del Norte", dial: "+850" },
  { code: "KR", flag: "🇰🇷", name: "Corea del Sur", dial: "+82" },
  { code: "KW", flag: "🇰🇼", name: "Kuwait", dial: "+965" },
  { code: "KZ", flag: "🇰🇿", name: "Kazajistán", dial: "+7" },
  { code: "LA", flag: "🇱🇦", name: "Laos", dial: "+856" },
  { code: "LB", flag: "🇱🇧", name: "Líbano", dial: "+961" },
  { code: "LC", flag: "🇱🇨", name: "Santa Lucía", dial: "+1" },
  { code: "LI", flag: "🇱🇮", name: "Liechtenstein", dial: "+423" },
  { code: "LK", flag: "🇱🇰", name: "Sri Lanka", dial: "+94" },
  { code: "LR", flag: "🇱🇷", name: "Liberia", dial: "+231" },
  { code: "LS", flag: "🇱🇸", name: "Lesoto", dial: "+266" },
  { code: "LT", flag: "🇱🇹", name: "Lituania", dial: "+370" },
  { code: "LU", flag: "🇱🇺", name: "Luxemburgo", dial: "+352" },
  { code: "LV", flag: "🇱🇻", name: "Letonia", dial: "+371" },
  { code: "LY", flag: "🇱🇾", name: "Libia", dial: "+218" },
  { code: "MA", flag: "🇲🇦", name: "Marruecos", dial: "+212" },
  { code: "MC", flag: "🇲🇨", name: "Mónaco", dial: "+377" },
  { code: "MD", flag: "🇲🇩", name: "Moldavia", dial: "+373" },
  { code: "ME", flag: "🇲🇪", name: "Montenegro", dial: "+382" },
  { code: "MG", flag: "🇲🇬", name: "Madagascar", dial: "+261" },
  { code: "MH", flag: "🇲🇭", name: "Islas Marshall", dial: "+692" },
  { code: "MK", flag: "🇲🇰", name: "Macedonia del Norte", dial: "+389" },
  { code: "ML", flag: "🇲🇱", name: "Malí", dial: "+223" },
  { code: "MM", flag: "🇲🇲", name: "Birmania", dial: "+95" },
  { code: "MN", flag: "🇲🇳", name: "Mongolia", dial: "+976" },
  { code: "MR", flag: "🇲🇷", name: "Mauritania", dial: "+222" },
  { code: "MT", flag: "🇲🇹", name: "Malta", dial: "+356" },
  { code: "MU", flag: "🇲🇺", name: "Mauricio", dial: "+230" },
  { code: "MV", flag: "🇲🇻", name: "Maldivas", dial: "+960" },
  { code: "MW", flag: "🇲🇼", name: "Malaui", dial: "+265" },
  { code: "MY", flag: "🇲🇾", name: "Malasia", dial: "+60" },
  { code: "MZ", flag: "🇲🇿", name: "Mozambique", dial: "+258" },
  { code: "NA", flag: "🇳🇦", name: "Namibia", dial: "+264" },
  { code: "NE", flag: "🇳🇪", name: "Níger", dial: "+227" },
  { code: "NG", flag: "🇳🇬", name: "Nigeria", dial: "+234" },
  { code: "NI", flag: "🇳🇮", name: "Nicaragua", dial: "+505" },
  { code: "NL", flag: "🇳🇱", name: "Países Bajos", dial: "+31" },
  { code: "NO", flag: "🇳🇴", name: "Noruega", dial: "+47" },
  { code: "NP", flag: "🇳🇵", name: "Nepal", dial: "+977" },
  { code: "NR", flag: "🇳🇷", name: "Nauru", dial: "+674" },
  { code: "NZ", flag: "🇳🇿", name: "Nueva Zelanda", dial: "+64" },
  { code: "OM", flag: "🇴🇲", name: "Omán", dial: "+968" },
  { code: "PG", flag: "🇵🇬", name: "Papúa Nueva Guinea", dial: "+675" },
  { code: "PH", flag: "🇵🇭", name: "Filipinas", dial: "+63" },
  { code: "PK", flag: "🇵🇰", name: "Pakistán", dial: "+92" },
  { code: "PL", flag: "🇵🇱", name: "Polonia", dial: "+48" },
  { code: "PS", flag: "🇵🇸", name: "Palestina", dial: "+970" },
  { code: "PT", flag: "🇵🇹", name: "Portugal", dial: "+351" },
  { code: "PW", flag: "🇵🇼", name: "Palaos", dial: "+680" },
  { code: "QA", flag: "🇶🇦", name: "Catar", dial: "+974" },
  { code: "RO", flag: "🇷🇴", name: "Rumanía", dial: "+40" },
  { code: "RS", flag: "🇷🇸", name: "Serbia", dial: "+381" },
  { code: "RU", flag: "🇷🇺", name: "Rusia", dial: "+7" },
  { code: "RW", flag: "🇷🇼", name: "Ruanda", dial: "+250" },
  { code: "SA", flag: "🇸🇦", name: "Arabia Saudita", dial: "+966" },
  { code: "SB", flag: "🇸🇧", name: "Islas Salomón", dial: "+677" },
  { code: "SC", flag: "🇸🇨", name: "Seychelles", dial: "+248" },
  { code: "SD", flag: "🇸🇩", name: "Sudán", dial: "+249" },
  { code: "SE", flag: "🇸🇪", name: "Suecia", dial: "+46" },
  { code: "SG", flag: "🇸🇬", name: "Singapur", dial: "+65" },
  { code: "SI", flag: "🇸🇮", name: "Eslovenia", dial: "+386" },
  { code: "SK", flag: "🇸🇰", name: "Eslovaquia", dial: "+421" },
  { code: "SL", flag: "🇸🇱", name: "Sierra Leona", dial: "+232" },
  { code: "SM", flag: "🇸🇲", name: "San Marino", dial: "+378" },
  { code: "SN", flag: "🇸🇳", name: "Senegal", dial: "+221" },
  { code: "SO", flag: "🇸🇴", name: "Somalia", dial: "+252" },
  { code: "SR", flag: "🇸🇷", name: "Surinam", dial: "+597" },
  { code: "SS", flag: "🇸🇸", name: "Sudán del Sur", dial: "+211" },
  { code: "ST", flag: "🇸🇹", name: "Santo Tomé y Príncipe", dial: "+239" },
  { code: "SV", flag: "🇸🇻", name: "El Salvador", dial: "+503" },
  { code: "SY", flag: "🇸🇾", name: "Siria", dial: "+963" },
  { code: "SZ", flag: "🇸🇿", name: "Esuatini", dial: "+268" },
  { code: "TD", flag: "🇹🇩", name: "Chad", dial: "+235" },
  { code: "TG", flag: "🇹🇬", name: "Togo", dial: "+228" },
  { code: "TH", flag: "🇹🇭", name: "Tailandia", dial: "+66" },
  { code: "TJ", flag: "🇹🇯", name: "Tayikistán", dial: "+992" },
  { code: "TL", flag: "🇹🇱", name: "Timor Oriental", dial: "+670" },
  { code: "TM", flag: "🇹🇲", name: "Turkmenistán", dial: "+993" },
  { code: "TN", flag: "🇹🇳", name: "Túnez", dial: "+216" },
  { code: "TO", flag: "🇹🇴", name: "Tonga", dial: "+676" },
  { code: "TR", flag: "🇹🇷", name: "Turquía", dial: "+90" },
  { code: "TT", flag: "🇹🇹", name: "Trinidad y Tobago", dial: "+1" },
  { code: "TV", flag: "🇹🇻", name: "Tuvalu", dial: "+688" },
  { code: "TZ", flag: "🇹🇿", name: "Tanzania", dial: "+255" },
  { code: "UA", flag: "🇺🇦", name: "Ucrania", dial: "+380" },
  { code: "UG", flag: "🇺🇬", name: "Uganda", dial: "+256" },
  { code: "UZ", flag: "🇺🇿", name: "Uzbekistán", dial: "+998" },
  { code: "VA", flag: "🇻🇦", name: "Ciudad del Vaticano", dial: "+39" },
  { code: "VC", flag: "🇻🇨", name: "San Vicente y Granadinas", dial: "+1" },
  { code: "VN", flag: "🇻🇳", name: "Vietnam", dial: "+84" },
  { code: "VU", flag: "🇻🇺", name: "Vanuatu", dial: "+678" },
  { code: "WS", flag: "🇼🇸", name: "Samoa", dial: "+685" },
  { code: "XK", flag: "🇽🇰", name: "Kosovo", dial: "+383" },
  { code: "YE", flag: "🇾🇪", name: "Yemen", dial: "+967" },
  { code: "ZA", flag: "🇿🇦", name: "Sudáfrica", dial: "+27" },
  { code: "ZM", flag: "🇿🇲", name: "Zambia", dial: "+260" },
  { code: "ZW", flag: "🇿🇼", name: "Zimbabue", dial: "+263" },
];

const ALL_COUNTRIES: CountryEntry[] = [...PRIORITY_COUNTRIES, ...REST_OF_WORLD];
const PRIORITY_SET = new Set(PRIORITY_COUNTRIES.map((c) => c.code + c.dial));

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePhoneValue(value: string): {
  country: CountryEntry;
  local: string;
} {
  if (!value || !value.startsWith("+")) {
    return { country: PRIORITY_COUNTRIES[0], local: value || "" };
  }
  // Sort by dial length descending to avoid prefix false-positives (+593 before +59)
  const sorted = [...ALL_COUNTRIES].sort(
    (a, b) => b.dial.length - a.dial.length,
  );
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { country: c, local: value.slice(c.dial.length) };
    }
  }
  return { country: PRIORITY_COUNTRIES[0], local: value };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhoneInput({
  value,
  onChange,
  name,
  className,
  style,
  placeholder,
  required,
  disabled,
}: PhoneInputProps) {
  const t = useThemeTokens();
  const parsed = parsePhoneValue(value);
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry>(
    parsed.country,
  );
  const [localNumber, setLocalNumber] = useState<string>(parsed.local);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when value changes from parent (e.g. modal opens with existing data)
  useEffect(() => {
    const p = parsePhoneValue(value);
    setSelectedCountry(p.country);
    setLocalNumber(p.local);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  function handleCountrySelect(country: CountryEntry) {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch("");
    onChange(country.dial + localNumber.replace(/\s/g, ""));
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const local = e.target.value;
    setLocalNumber(local);
    onChange(selectedCountry.dial + local.replace(/\s/g, ""));
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dial.includes(q) ||
          c.code.toLowerCase().includes(q),
      )
    : ALL_COUNTRIES;

  const filteredPriority = filtered.filter((c) =>
    PRIORITY_SET.has(c.code + c.dial),
  );
  const filteredRest = filtered.filter(
    (c) => !PRIORITY_SET.has(c.code + c.dial),
  );

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: `1.5px solid ${t.border}`,
    background: t.surface,
    transition: "all 0.2s ease",
    overflow: "visible",
    position: "relative",
    ...(style ?? {}),
  };

  const separatorColor = t.isDark ? "rgba(148,163,184,0.2)" : "#e2e8f0";
  const dropdownBg = t.surface;
  const dropdownBorder = t.border;
  const itemHoverBg = t.isDark ? "rgba(255,255,255,0.06)" : "#f0f9ff";

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Hidden input for FormData (fd.get("phone")) */}
      {name && <input type="hidden" name={name} value={value} />}

      <div className={className} style={wrapperStyle}>
        {/* Country selector button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsOpen((o) => !o);
            setSearch("");
          }}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "10px 10px 10px 14px",
            background: "transparent",
            border: "none",
            borderRight: `1.5px solid ${separatorColor}`,
            cursor: disabled ? "default" : "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: t.text,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>
            {selectedCountry.flag}
          </span>
          <span style={{ fontSize: "0.8rem", color: t.textSub, minWidth: 30 }}>
            {selectedCountry.dial}
          </span>
          <span style={{ fontSize: "0.6rem", color: t.textMuted }}>▾</span>
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          required={required}
          disabled={disabled}
          value={localNumber}
          onChange={handleLocalChange}
          placeholder={placeholder ?? "300 123 4567"}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            padding: "10px 14px",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: t.text,
            background: "transparent",
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: dropdownBg,
            border: `1.5px solid ${dropdownBorder}`,
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: `1px solid ${separatorColor}`,
            }}
          >
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país o código..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${dropdownBorder}`,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: "0.85rem",
                background: t.surface2,
                color: t.text,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filteredPriority.map((c) => (
              <button
                key={c.code + "-p"}
                type="button"
                onClick={() => handleCountrySelect(c)}
                style={itemStyle(
                  c.code === selectedCountry.code,
                  t.text,
                  itemHoverBg,
                )}
              >
                <span style={{ fontSize: "1.1rem" }}>{c.flag}</span>
                <span
                  style={{ flex: 1, textAlign: "left", fontSize: "0.875rem" }}
                >
                  {c.name}
                </span>
                <span style={{ fontSize: "0.8rem", color: t.textSub }}>
                  {c.dial}
                </span>
              </button>
            ))}
            {filteredPriority.length > 0 && filteredRest.length > 0 && (
              <div
                style={{
                  borderTop: `1px solid ${separatorColor}`,
                  margin: "2px 0",
                }}
              />
            )}
            {filteredRest.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCountrySelect(c)}
                style={itemStyle(
                  c.code === selectedCountry.code,
                  t.text,
                  itemHoverBg,
                )}
              >
                <span style={{ fontSize: "1.1rem" }}>{c.flag}</span>
                <span
                  style={{ flex: 1, textAlign: "left", fontSize: "0.875rem" }}
                >
                  {c.name}
                </span>
                <span style={{ fontSize: "0.8rem", color: t.textSub }}>
                  {c.dial}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  fontSize: "0.85rem",
                  color: t.textMuted,
                  textAlign: "center",
                }}
              >
                No se encontraron resultados
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function itemStyle(
  selected: boolean,
  text: string,
  hoverBg: string,
): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 12px",
    background: selected ? hoverBg : "transparent",
    border: "none",
    cursor: "pointer",
    color: text,
    textAlign: "left",
    transition: "background 0.1s",
  };
}
