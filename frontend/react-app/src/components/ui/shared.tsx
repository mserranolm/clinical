import type { ReactNode } from "react";

// ── StatusBadge ───────────────────────────────────────────────────────────────

type AppointmentStatus =
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "scheduled";
type BudgetStatus = "draft" | "sent" | "approved" | "partial" | "paid";
type BadgeStatus = AppointmentStatus | BudgetStatus | string;

const APPOINTMENT_STATUS: Record<
  AppointmentStatus,
  { label: string; bg: string; color: string }
> = {
  confirmed: { label: "Confirmada", bg: "#DCFCE7", color: "#15803D" },
  in_progress: { label: "En consulta", bg: "#DBEAFE", color: "#1D4ED8" },
  completed: { label: "Finalizada", bg: "#F1F5F9", color: "#475569" },
  cancelled: { label: "Cancelada", bg: "#FEE2E2", color: "#DC2626" },
  scheduled: { label: "No confirmada", bg: "#FEF3C7", color: "#B45309" },
};

const BUDGET_STATUS: Record<
  BudgetStatus,
  { label: string; bg: string; color: string }
> = {
  draft: { label: "Borrador", bg: "#F1F5F9", color: "#475569" },
  sent: { label: "Enviado", bg: "#DBEAFE", color: "#1D4ED8" },
  approved: { label: "Aprobado", bg: "#DCFCE7", color: "#15803D" },
  partial: { label: "Abonado", bg: "#FEF3C7", color: "#B45309" },
  paid: { label: "Pagado", bg: "#F0FDFA", color: "#0D9488" },
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const config = APPOINTMENT_STATUS[status as AppointmentStatus] ??
    BUDGET_STATUS[status as BudgetStatus] ?? {
      label: status,
      bg: "#F1F5F9",
      color: "#475569",
    };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 100,
        background: config.bg,
        color: config.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────

type PageHeaderProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        background: "white",
        borderBottom: "1px solid #F1F5F9",
        padding: "0 28px",
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "#F0FDFA",
          border: "1px solid #CCFBF1",
          color: "#0D9488",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#0F172A",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{ fontSize: 12, color: "#94A3B8", margin: 0, marginTop: 1 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 24px",
        gap: 12,
        textAlign: "center",
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#F0FDFA",
            border: "1px solid #CCFBF1",
            color: "#0D9488",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <strong style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
        {title}
      </strong>
      {description && (
        <p
          style={{
            fontSize: 13,
            color: "#94A3B8",
            margin: 0,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
