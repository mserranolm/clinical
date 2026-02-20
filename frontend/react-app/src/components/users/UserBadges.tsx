export type OrgUser = { 
  id: string; 
  name: string; 
  email: string; 
  phone?: string; 
  address?: string; 
  role: string; 
  status: string; 
  createdAt: string;
};

export const ROLE_LABELS: Record<string, string> = { 
  admin: "Admin", 
  doctor: "Doctor", 
  assistant: "Asistente", 
  patient: "Paciente" 
};

export const roleBadge = (role: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    admin: { bg: "#dbeafe", text: "#1e40af" },
    doctor: { bg: "#d1fae5", text: "#065f46" },
    assistant: { bg: "#fef3c7", text: "#92400e" },
    patient: { bg: "#f3f4f6", text: "#374151" },
  };
  const c = colors[role] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span 
      style={{ 
        background: c.bg, 
        color: c.text, 
        padding: "2px 8px", 
        borderRadius: 4, 
        fontSize: "0.75rem", 
        fontWeight: 600 
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
};

export const statusBadge = (status: string) => (
  <span
    style={{
      background: status === "active" ? "#d1fae5" : "#fee2e2",
      color: status === "active" ? "#065f46" : "#991b1b",
      padding: "2px 8px", 
      borderRadius: 4, 
      fontSize: "0.75rem", 
      fontWeight: 600
    }}
  >
    {status === "active" ? "Activo" : "Deshabilitado"}
  </span>
);
