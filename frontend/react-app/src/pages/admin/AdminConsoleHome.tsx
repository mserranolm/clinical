import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  CheckCircle,
  DollarSign,
  Shield,
  Users,
} from "lucide-react";
import { clinicalApi } from "../../api/clinical";
import { PhoneInput } from "../../components/ui/PhoneInput";
import { notify } from "../../lib/notify";
import type { AuthSession } from "../../types";
import { PageHeader } from "@/components/ui/shared";

type OrgLimits = {
  maxDoctors: number;
  maxAssistants: number;
  maxPatients: number;
};
type Org = {
  id: string;
  name: string;
  businessName: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  status: string;
  paymentStatus: string;
  limits: OrgLimits;
  createdAt: string;
  timezone?: string;
};
type Stats = {
  totalOrgs: number;
  activeOrgs: number;
  totalDoctors: number;
  totalAssistants: number;
  totalAdmins: number;
  totalUsers: number;
  totalPatients: number;
  totalAppointments?: number;
  totalConsultations: number;
  totalRevenue: number;
};

const TIMEZONES = [
  { value: "America/Caracas", label: "Venezuela (UTC-4)" },
  { value: "America/Bogota", label: "Colombia (UTC-5)" },
  { value: "America/Lima", label: "Perú (UTC-5)" },
  { value: "America/Guayaquil", label: "Ecuador (UTC-5)" },
  { value: "America/Panama", label: "Panamá (UTC-5)" },
  { value: "America/Mexico_City", label: "México Centro (UTC-6)" },
  { value: "America/Monterrey", label: "México Norte (UTC-6)" },
  { value: "America/Costa_Rica", label: "Costa Rica (UTC-6)" },
  { value: "America/El_Salvador", label: "El Salvador (UTC-6)" },
  { value: "America/Tegucigalpa", label: "Honduras (UTC-6)" },
  { value: "America/Managua", label: "Nicaragua (UTC-6)" },
  { value: "America/Guatemala", label: "Guatemala (UTC-6)" },
  { value: "America/Santo_Domingo", label: "Rep. Dominicana (UTC-4)" },
  { value: "America/Puerto_Rico", label: "Puerto Rico (UTC-4)" },
  { value: "America/Santiago", label: "Chile (UTC-3/-4)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (UTC-3)" },
  { value: "America/Sao_Paulo", label: "Brasil (UTC-3)" },
  { value: "America/Montevideo", label: "Uruguay (UTC-3)" },
  { value: "America/Asuncion", label: "Paraguay (UTC-4/-3)" },
  { value: "America/La_Paz", label: "Bolivia (UTC-4)" },
  { value: "Europe/Madrid", label: "España (UTC+1/+2)" },
  { value: "UTC", label: "UTC (sin zona)" },
];

const EMPTY_FORM = {
  name: "",
  businessName: "",
  taxId: "",
  address: "",
  email: "",
  phone: "",
  status: "active",
  paymentStatus: "current",
  maxDoctors: 5,
  maxAssistants: 2,
  maxPatients: 20,
  adminName: "",
  adminEmail: "",
  timezone: "America/Caracas",
};
type OrgForm = typeof EMPTY_FORM;

const SL: Record<string, string> = { active: "Activa", inactive: "Inactiva" };
const PL: Record<string, string> = {
  current: "Al día",
  overdue: "Vencido",
  suspended: "Suspendido",
};
const SC: Record<string, string> = { active: "#d1fae5", inactive: "#fee2e2" };
const PC: Record<string, string> = {
  current: "#d1fae5",
  overdue: "#fef3c7",
  suspended: "#fee2e2",
};
const ST: Record<string, string> = { active: "#065f46", inactive: "#991b1b" };
const PT: Record<string, string> = {
  current: "#065f46",
  overdue: "#92400e",
  suspended: "#991b1b",
};

const AUTO_REFRESH_OPTIONS = [
  { value: 0, label: "Desactivada" },
  { value: 10, label: "Cada 10 s" },
  { value: 15, label: "Cada 15 s" },
  { value: 30, label: "Cada 30 s" },
  { value: 60, label: "Cada 60 s" },
] as const;

const inp: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  width: "100%",
  fontSize: 13,
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748B",
  marginBottom: 4,
};
const sec: React.CSSProperties = {
  borderTop: "1px solid #F1F5F9",
  paddingTop: "1rem",
  marginBottom: "1rem",
};

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #F1F5F9",
        borderRadius: 12,
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0D9488",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.75rem", fontWeight: 800, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function AdminConsoleHome({ session }: { session: AuthSession }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgAdmins, setOrgAdmins] = useState<
    Record<string, { name: string; email: string }>
  >({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [form, setForm] = useState<OrgForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeView, setActiveView] = useState<"orgs" | "settings">("orgs");
  const [platformSettings, setPlatformSettings] = useState<{
    sendSMS: boolean;
    sendEmail: boolean;
    logoUrl?: string;
    signatureUrl?: string;
  } | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const token = session.token;

  async function loadAll(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [orgsRes, statsRes] = await Promise.all([
        clinicalApi.listOrgs(token),
        clinicalApi.getPlatformStats(token),
      ]);
      const items = orgsRes.items ?? [];
      setOrgs(items);
      setStats(statsRes);
      const adminsMap: Record<string, { name: string; email: string }> = {};
      await Promise.all(
        items.map(async (org) => {
          try {
            const users = await clinicalApi.listOrgUsers(org.id, token);
            const admin = (users.items ?? []).find(
              (u) => u.role === "admin" && u.status === "active",
            );
            if (admin)
              adminsMap[org.id] = { name: admin.name, email: admin.email };
          } catch {
            /* non-critical */
          }
        }),
      );
      setOrgAdmins(adminsMap);
    } catch (e) {
      notify.error("Error cargando datos", e instanceof Error ? e.message : "");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    loadPlatformSettings();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefreshSeconds > 0) {
      intervalRef.current = setInterval(
        () => loadAll(true),
        autoRefreshSeconds * 1000,
      );
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefreshSeconds]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll(true);
    setRefreshing(false);
  }

  async function loadPlatformSettings() {
    setSettingsLoading(true);
    try {
      const s = await clinicalApi.getPlatformSettings(token);
      setPlatformSettings(s);
    } catch (e) {
      notify.error(
        "Error cargando configuración",
        e instanceof Error ? e.message : "",
      );
    } finally {
      setSettingsLoading(false);
    }
  }

  async function savePlatformSettings() {
    if (!platformSettings) return;
    setSettingsSaving(true);
    try {
      const updated = await clinicalApi.updatePlatformSettings(
        platformSettings,
        token,
      );
      setPlatformSettings(updated);
      notify.success("Configuración guardada");
    } catch (e) {
      notify.error(
        "Error guardando configuración",
        e instanceof Error ? e.message : "",
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  function openCreate() {
    setEditingOrg(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(org: Org) {
    setEditingOrg(org);
    setForm({
      name: org.name,
      businessName: org.businessName || "",
      taxId: org.taxId || "",
      address: org.address || "",
      email: org.email || "",
      phone: org.phone || "",
      status: org.status || "active",
      paymentStatus: org.paymentStatus || "current",
      maxDoctors: org.limits?.maxDoctors ?? 5,
      maxAssistants: org.limits?.maxAssistants ?? 2,
      maxPatients: org.limits?.maxPatients ?? 20,
      adminName: "",
      adminEmail: "",
      timezone: org.timezone || "America/Caracas",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name,
      businessName: form.businessName,
      taxId: form.taxId,
      address: form.address,
      email: form.email,
      phone: form.phone,
      status: form.status,
      paymentStatus: form.paymentStatus,
      maxDoctors: Number(form.maxDoctors),
      maxAssistants: Number(form.maxAssistants),
      maxPatients: Number(form.maxPatients),
      timezone: form.timezone,
    };

    try {
      if (editingOrg) {
        await clinicalApi.updateOrg(editingOrg.id, payload, token);
        notify.success("Organización actualizada");
      } else {
        const created = (await clinicalApi.createOrg(payload, token)) as {
          id: string;
        };
        if (form.adminEmail) {
          await clinicalApi.createOrgAdmin(
            created.id,
            {
              name: form.adminName || form.adminEmail,
              email: form.adminEmail,
            },
            token,
          );
        }
        notify.success(
          form.adminEmail
            ? "Organización creada. Se envió un correo al admin con la contraseña temporal."
            : "Organización creada",
        );
      }
      setShowForm(false);
      setEditingOrg(null);
      loadAll();
    } catch (e) {
      notify.error("Error", e instanceof Error ? e.message : "");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(org: Org) {
    if (
      !window.confirm(
        `¿Eliminar "${org.name}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    notify.promise(clinicalApi.deleteOrg(org.id, token), {
      loading: "Eliminando...",
      success: () => {
        loadAll();
        return "Organización eliminada";
      },
      error: "Error al eliminar",
    });
  }

  async function uploadOrgAsset(kind: "logo" | "signature", file: File) {
    const setter = kind === "logo" ? setUploadingLogo : setUploadingSignature;
    setter(true);
    try {
      const { uploadUrl, imageUrl } = await clinicalApi.getOrgUploadUrl(
        kind,
        file.name,
        token,
      );
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      const fieldKey = kind === "logo" ? "logoUrl" : "signatureUrl";
      const updated = {
        ...(platformSettings ?? { sendEmail: true, sendSMS: true }),
        [fieldKey]: imageUrl,
      };
      const saved = await clinicalApi.updatePlatformSettings(updated, token);
      setPlatformSettings(saved);
      notify.success(
        kind === "logo" ? "Logo actualizado" : "Firma actualizada",
      );
    } catch {
      notify.error("Error al subir el archivo");
    } finally {
      setter(false);
    }
  }

  const btnPrimary: React.CSSProperties = {
    background: "#0D9488",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "0.5rem 1.25rem",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.875rem",
  };
  const btnCancel: React.CSSProperties = {
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "0.5rem 1.25rem",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.875rem",
  };
  const btnDanger: React.CSSProperties = {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    padding: "0.4rem 0.75rem",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
  };
  const btnEdit: React.CSSProperties = {
    background: "#F0FDFA",
    color: "#0F766E",
    border: "1px solid #CCFBF1",
    borderRadius: 6,
    padding: "0.4rem 0.75rem",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        icon={<Shield size={18} />}
        title="Consola de Plataforma"
        subtitle="Administración global del sistema"
        action={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              style={{
                ...btnCancel,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              title="Actualizar datos"
            >
              {refreshing ? "⟳ Actualizando..." : "↻ Actualizar"}
            </button>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                color: "#64748B",
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>Auto:</span>
              <select
                value={autoRefreshSeconds}
                onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
                style={{
                  ...inp,
                  width: "auto",
                  minWidth: 100,
                  padding: "0.4rem 0.6rem",
                  fontSize: "0.8rem",
                }}
              >
                {AUTO_REFRESH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={openCreate} style={btnPrimary}>
              + Nueva organización
            </button>
          </div>
        }
      />

      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: 0,
        }}
      >
        {(["orgs", "settings"] as const).map((view) => {
          const labels = {
            orgs: "Organizaciones",
            settings: "Configuración de Plataforma",
          };
          const active = activeView === view;
          return (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                background: "none",
                border: "none",
                borderBottom: active
                  ? "2px solid #0D9488"
                  : "2px solid transparent",
                marginBottom: -2,
                padding: "0.5rem 1rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: active ? 700 : 500,
                color: active ? "#0D9488" : "#6b7280",
              }}
            >
              {labels[view]}
            </button>
          );
        })}
      </div>

      {activeView === "orgs" && (
        <>
          {/* Stats dashboard */}
          {stats && (
            <div style={{ marginBottom: "2rem" }}>
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.75rem",
                }}
              >
                Resumen de la plataforma
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <StatCard
                  value={stats.totalOrgs}
                  label="Organizaciones"
                  color="#F0FDFA"
                  icon={<Building2 size={18} />}
                />
                <StatCard
                  value={stats.activeOrgs}
                  label="Activas"
                  color="#DCFCE7"
                  icon={<CheckCircle size={18} />}
                />
                <StatCard
                  value={stats.totalDoctors}
                  label="Doctores"
                  color="#DBEAFE"
                  icon={<Users size={18} />}
                />
                <StatCard
                  value={stats.totalAssistants}
                  label="Asistentes"
                  color="#F0FDFA"
                  icon={<Users size={18} />}
                />
                <StatCard
                  value={stats.totalPatients}
                  label="Pacientes"
                  color="#FCE7F3"
                  icon={<Users size={18} />}
                />
                <StatCard
                  value={stats.totalConsultations ?? 0}
                  label="Consultas finalizadas"
                  color="#FEF9C3"
                  icon={<BarChart3 size={18} />}
                />
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "1.25rem 1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    gridColumn: "span 2",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "#F0FDFA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#0D9488",
                      flexShrink: 0,
                    }}
                  >
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "1.75rem",
                        fontWeight: 800,
                        lineHeight: 1,
                        color: "#10b981",
                      }}
                    >
                      $
                      {(stats.totalRevenue ?? 0).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#6b7280",
                        marginTop: 2,
                      }}
                    >
                      Ingresos totales (todas las orgs)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form crear/editar org */}
          {showForm && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.25rem",
                }}
              >
                <h3 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>
                  {editingOrg
                    ? `Editar: ${editingOrg.name}`
                    : "Nueva organización"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                    color: "#6b7280",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                {/* Datos de la organización */}
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.75rem",
                  }}
                >
                  Datos de la organización
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <label style={lbl}>Nombre de la clínica *</label>
                    <input
                      required
                      style={inp}
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Clínica San José"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Razón social</label>
                    <input
                      style={inp}
                      value={form.businessName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, businessName: e.target.value }))
                      }
                      placeholder="Clínica San José S.A.S."
                    />
                  </div>
                  <div>
                    <label style={lbl}>NIT / RUC / Tax ID</label>
                    <input
                      style={inp}
                      value={form.taxId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, taxId: e.target.value }))
                      }
                      placeholder="900.123.456-7"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Teléfono</label>
                    <PhoneInput
                      style={inp}
                      value={form.phone}
                      onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                      placeholder="300 000 0000"
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={lbl}>Dirección</label>
                    <input
                      style={inp}
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                      placeholder="Calle 10 # 5-20, Bogotá"
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={lbl}>Email de contacto</label>
                    <input
                      type="email"
                      style={inp}
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="contacto@clinica.com"
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={lbl}>Zona horaria (GMT) *</label>
                    <select
                      style={inp}
                      value={form.timezone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, timezone: e.target.value }))
                      }
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label} — {tz.value}
                        </option>
                      ))}
                    </select>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "0.72rem",
                        color: "#6b7280",
                      }}
                    >
                      Define el horario local para notificaciones y validación
                      de citas.
                    </p>
                  </div>
                </div>

                {/* Estado y pago */}
                <div style={sec}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Estado y pago
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <label style={lbl}>Estado</label>
                      <select
                        style={inp}
                        value={form.status}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, status: e.target.value }))
                        }
                      >
                        <option value="active">Activa</option>
                        <option value="inactive">Inactiva</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Estado de pago</label>
                      <select
                        style={inp}
                        value={form.paymentStatus}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            paymentStatus: e.target.value,
                          }))
                        }
                      >
                        <option value="current">Al día</option>
                        <option value="overdue">Vencido</option>
                        <option value="suspended">Suspendido</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Límites */}
                <div style={sec}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Límites de usuarios
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <label style={lbl}>Máx. Doctores</label>
                      <input
                        type="number"
                        min={1}
                        style={inp}
                        value={form.maxDoctors}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            maxDoctors: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={lbl}>Máx. Asistentes</label>
                      <input
                        type="number"
                        min={1}
                        style={inp}
                        value={form.maxAssistants}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            maxAssistants: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={lbl}>Máx. Pacientes</label>
                      <input
                        type="number"
                        min={1}
                        style={inp}
                        value={form.maxPatients}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            maxPatients: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Admin inicial — solo al crear */}
                {!editingOrg && (
                  <div
                    style={{
                      ...sec,
                      background: "#F0FDFA",
                      border: "1px solid #CCFBF1",
                      borderRadius: 8,
                      padding: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: "#0F766E",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: "0.75rem",
                      }}
                    >
                      Admin de la organización
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <label style={lbl}>Nombre del admin</label>
                        <input
                          style={inp}
                          value={form.adminName}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              adminName: e.target.value,
                            }))
                          }
                          placeholder="Dr. Juan Pérez"
                        />
                      </div>
                      <div>
                        <label style={lbl}>Email del admin</label>
                        <input
                          type="email"
                          style={inp}
                          value={form.adminEmail}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              adminEmail: e.target.value,
                            }))
                          }
                          placeholder="admin@clinica.com"
                        />
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#0D9488",
                        marginTop: "0.5rem",
                      }}
                    >
                      Se enviará un correo con una contraseña temporal. El admin
                      deberá cambiarla en el primer inicio de sesión. Opcional —
                      si no indicas email, podrás crear el admin después desde
                      la organización.
                    </p>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={btnCancel}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={btnPrimary}
                  >
                    {submitting
                      ? "Guardando..."
                      : editingOrg
                        ? "Guardar cambios"
                        : "Crear organización"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de organizaciones */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <h2 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>
              Organizaciones ({orgs.length})
            </h2>
          </div>

          {loading ? (
            <div
              style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}
            >
              Cargando...
            </div>
          ) : orgs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#6b7280",
                background: "#f9fafb",
                borderRadius: 12,
                border: "1px dashed #d1d5db",
              }}
            >
              <Building2
                size={32}
                color="#94A3B8"
                style={{ marginBottom: "0.5rem" }}
              />
              <p>No hay organizaciones aún. Crea la primera.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {orgs.map((org) => (
                <div
                  key={org.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "1.25rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong style={{ fontSize: "1rem" }}>{org.name}</strong>
                        <span
                          style={{
                            background: SC[org.status] || "#f3f4f6",
                            color: ST[org.status] || "#374151",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                          }}
                        >
                          {SL[org.status] || org.status}
                        </span>
                        <span
                          style={{
                            background: PC[org.paymentStatus] || "#f3f4f6",
                            color: PT[org.paymentStatus] || "#374151",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                          }}
                        >
                          💳 {PL[org.paymentStatus] || org.paymentStatus}
                        </span>
                      </div>
                      {org.businessName && (
                        <p
                          style={{
                            color: "#6b7280",
                            fontSize: "0.8rem",
                            margin: "0 0 0.25rem",
                          }}
                        >
                          {org.businessName}
                          {org.taxId ? ` · ${org.taxId}` : ""}
                        </p>
                      )}
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          fontSize: "0.8rem",
                          color: "#6b7280",
                        }}
                      >
                        {org.address && <span>📍 {org.address}</span>}
                        {org.email && <span>✉️ {org.email}</span>}
                        {org.phone && <span>📞 {org.phone}</span>}
                        {org.timezone && <span>🕐 {org.timezone}</span>}
                      </div>
                      {orgAdmins[org.id] ? (
                        <div
                          style={{
                            marginTop: "0.4rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              background: "#ede9fe",
                              color: "#5b21b6",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: "0.7rem",
                              fontWeight: 700,
                            }}
                          >
                            ADMIN
                          </span>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "#374151",
                              fontWeight: 600,
                            }}
                          >
                            {orgAdmins[org.id].name}
                          </span>
                          <span
                            style={{ fontSize: "0.8rem", color: "#6b7280" }}
                          >
                            {orgAdmins[org.id].email}
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginTop: "0.4rem" }}>
                          <span
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: "0.7rem",
                              fontWeight: 700,
                            }}
                          >
                            Sin admin asignado
                          </span>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          background: "#F0FDFA",
                          border: "1px solid #CCFBF1",
                          borderRadius: 8,
                          padding: "0.4rem 0.6rem",
                          fontSize: "0.75rem",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0D9488" }}>
                          {org.limits?.maxDoctors ?? 5}
                        </div>
                        <div style={{ color: "#64748B" }}>Dr.</div>
                      </div>
                      <div
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 8,
                          padding: "0.4rem 0.6rem",
                          fontSize: "0.75rem",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#15803d" }}>
                          {org.limits?.maxAssistants ?? 2}
                        </div>
                        <div style={{ color: "#6b7280" }}>Asist.</div>
                      </div>
                      <div
                        style={{
                          background: "#fefce8",
                          border: "1px solid #fde68a",
                          borderRadius: 8,
                          padding: "0.4rem 0.6rem",
                          fontSize: "0.75rem",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#a16207" }}>
                          {org.limits?.maxPatients ?? 20}
                        </div>
                        <div style={{ color: "#6b7280" }}>Pac.</div>
                      </div>
                      <button onClick={() => openEdit(org)} style={btnEdit}>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(org)}
                        style={btnDanger}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.7rem",
                      color: "#9ca3af",
                      fontFamily: "monospace",
                    }}
                  >
                    ID: {org.id} · Creada:{" "}
                    {new Date(org.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeView === "settings" && (
        <div style={{ maxWidth: 520 }}>
          <h2
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              marginBottom: "1.5rem",
              color: "#1e293b",
            }}
          >
            Configuración de Plataforma
          </h2>

          {settingsLoading ? (
            <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
              Cargando...
            </p>
          ) : platformSettings ? (
            <>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "1.5rem",
                  marginBottom: "1.5rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    color: "#374151",
                    marginBottom: "1rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Canales de Notificación
                </h3>

                {/* Toggle Email */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "1rem",
                    marginBottom: "1rem",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#1e293b",
                      }}
                    >
                      Email
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Notificaciones por correo (bienvenida, citas,
                      consentimientos)
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: platformSettings.sendEmail
                          ? "#059669"
                          : "#dc2626",
                      }}
                    >
                      {platformSettings.sendEmail ? "Activo" : "Inactivo"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPlatformSettings({
                          ...platformSettings,
                          sendEmail: !platformSettings.sendEmail,
                        })
                      }
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        border: "none",
                        background: platformSettings.sendEmail
                          ? "#0D9488"
                          : "#d1d5db",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 3,
                          left: platformSettings.sendEmail ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* Toggle SMS */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#1e293b",
                      }}
                    >
                      SMS
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Notificaciones por mensaje de texto (confirmación de
                      citas)
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: platformSettings.sendSMS ? "#059669" : "#dc2626",
                      }}
                    >
                      {platformSettings.sendSMS ? "Activo" : "Inactivo"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPlatformSettings({
                          ...platformSettings,
                          sendSMS: !platformSettings.sendSMS,
                        })
                      }
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        border: "none",
                        background: platformSettings.sendSMS
                          ? "#0D9488"
                          : "#d1d5db",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 3,
                          left: platformSettings.sendSMS ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Identidad Visual */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "1.5rem",
                  marginBottom: "1.5rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    color: "#374151",
                    marginBottom: "1rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Identidad Visual (PDF de Presupuesto)
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5rem",
                  }}
                >
                  {/* Logo */}
                  <div>
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 8,
                      }}
                    >
                      Logo de la clínica
                    </p>
                    {platformSettings?.logoUrl && (
                      <img
                        src={platformSettings.logoUrl}
                        alt="Logo"
                        style={{
                          maxHeight: 60,
                          maxWidth: "100%",
                          objectFit: "contain",
                          marginBottom: 8,
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          display: "block",
                        }}
                      />
                    )}
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        background: uploadingLogo
                          ? "#e5e7eb"
                          : "linear-gradient(135deg, #0ea5e9, #0284c7)",
                        color: uploadingLogo ? "#6b7280" : "white",
                        borderRadius: 8,
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        cursor: uploadingLogo ? "default" : "pointer",
                      }}
                    >
                      {uploadingLogo ? "Subiendo..." : "Subir logo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        style={{ display: "none" }}
                        disabled={uploadingLogo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadOrgAsset("logo", file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Firma */}
                  <div>
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 8,
                      }}
                    >
                      Firma del doctor
                    </p>
                    {platformSettings?.signatureUrl && (
                      <img
                        src={platformSettings.signatureUrl}
                        alt="Firma"
                        style={{
                          maxHeight: 60,
                          maxWidth: "100%",
                          objectFit: "contain",
                          marginBottom: 8,
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          display: "block",
                        }}
                      />
                    )}
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
                        background: uploadingSignature
                          ? "#e5e7eb"
                          : "linear-gradient(135deg, #0D9488, #0F766E)",
                        color: uploadingSignature ? "#6b7280" : "white",
                        borderRadius: 8,
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        cursor: uploadingSignature ? "default" : "pointer",
                      }}
                    >
                      {uploadingSignature ? "Subiendo..." : "Subir firma"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        disabled={uploadingSignature}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadOrgAsset("signature", file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={savePlatformSettings}
                disabled={settingsSaving}
                style={{
                  background: "#0D9488",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.625rem 1.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: settingsSaving ? "not-allowed" : "pointer",
                  opacity: settingsSaving ? 0.7 : 1,
                }}
              >
                {settingsSaving ? "Guardando..." : "Guardar configuración"}
              </button>
            </>
          ) : (
            <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
              No se pudo cargar la configuración.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
