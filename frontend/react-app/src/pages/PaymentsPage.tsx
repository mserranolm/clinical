import { useEffect, useMemo, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import type { AuthSession } from "../types";
import type { PaymentRecord } from "../types";
import { DollarSign, Download, Receipt } from "lucide-react";
import { useThemeTokens } from "../lib/use-is-dark";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtCurrency(amount: number, currency: string) {
  return `${currency === "VES" ? "Bs." : "$"}${amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  zelle: "Zelle",
  otro: "Otro",
};

const TYPE_LABELS: Record<string, string> = {
  pago_completo: "Pago completo",
  abono: "Abono",
};

export function PaymentsPage({ token, session: _session }: { token: string; session: AuthSession }) {
  const t = useThemeTokens();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    loadPayments();
  }, [token]);

  function loadPayments() {
    setLoading(true);
    clinicalApi.listPayments(token)
      .then((res) => setPayments(res.items || []))
      .catch(() => notify.error("Error al cargar pagos"))
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filterMethod && p.paymentMethod !== filterMethod) return false;
      if (filterCurrency && p.currency !== filterCurrency) return false;
      if (filterFrom && p.createdAt < filterFrom) return false;
      if (filterTo && p.createdAt > filterTo + "T23:59:59") return false;
      return true;
    });
  }, [payments, filterMethod, filterCurrency, filterFrom, filterTo]);

  const totalUSD = useMemo(() => filtered.filter(p => p.currency === "USD").reduce((s, p) => s + p.amount, 0), [filtered]);
  const totalVES = useMemo(() => filtered.filter(p => p.currency === "VES").reduce((s, p) => s + p.amount, 0), [filtered]);

  function exportCSV() {
    const header = ["Fecha", "Monto", "Moneda", "Tipo", "Método", "Notas", "Paciente ID", "Doctor ID", "Cita ID"];
    const escape = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((p) => [
      escape(fmtDate(p.createdAt)),
      escape(p.amount.toFixed(2)),
      escape(p.currency),
      escape(TYPE_LABELS[p.paymentType] ?? p.paymentType),
      escape(METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod),
      escape(p.notes),
      escape(p.patientId),
      escape(p.doctorId),
      escape(p.appointmentId),
    ].join(","));
    const csv = [header.map(h => `"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="page-section">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Receipt size={20} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>Registro de Pagos</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Historial de pagos de la organización</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <article className="stat-card elite-card" style={{ borderLeft: "3px solid #10b981" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.iconGreen, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} strokeWidth={1.5} color={t.iconGreenText} />
            </div>
            <small style={{ margin: 0 }}>Total USD</small>
          </div>
          <h3 style={{ color: "#10b981", fontSize: "1.6rem" }}>{fmtCurrency(totalUSD, "USD")}</h3>
          <span style={{ color: t.textSub, fontSize: "0.75rem" }}>{filtered.filter(p => p.currency === "USD").length} transacciones</span>
        </article>
        <article className="stat-card elite-card" style={{ borderLeft: "3px solid #8b5cf6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.iconPurple, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} strokeWidth={1.5} color={t.iconPurpleText} />
            </div>
            <small style={{ margin: 0 }}>Total VES</small>
          </div>
          <h3 style={{ color: "#8b5cf6", fontSize: "1.6rem" }}>{fmtCurrency(totalVES, "VES")}</h3>
          <span style={{ color: t.textSub, fontSize: "0.75rem" }}>{filtered.filter(p => p.currency === "VES").length} transacciones</span>
        </article>
        <article className="stat-card elite-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.successBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Receipt size={16} strokeWidth={1.5} color={t.successText} />
            </div>
            <small style={{ margin: 0 }}>Total pagos</small>
          </div>
          <h3 style={{ fontSize: "1.6rem" }}>{filtered.length}</h3>
          <span style={{ color: t.textSub, fontSize: "0.75rem" }}>Registros filtrados</span>
        </article>
      </div>

      {/* Filters */}
      <article className="card elite-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="input-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label style={{ fontSize: "0.75rem" }}>Método de pago</label>
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={{ fontSize: "0.875rem" }}>
              <option value="">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="zelle">Zelle</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 120, margin: 0 }}>
            <label style={{ fontSize: "0.75rem" }}>Moneda</label>
            <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} style={{ fontSize: "0.875rem" }}>
              <option value="">Todas</option>
              <option value="USD">USD</option>
              <option value="VES">VES</option>
            </select>
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label style={{ fontSize: "0.75rem" }}>Desde</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ fontSize: "0.875rem" }} />
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label style={{ fontSize: "0.75rem" }}>Hasta</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ fontSize: "0.875rem" }} />
          </div>
          <button
            type="button"
            onClick={exportCSV}
            style={{ display: "flex", alignItems: "center", gap: 6, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: t.textSub, whiteSpace: "nowrap" }}
          >
            <Download size={14} strokeWidth={1.5} />
            Exportar CSV
          </button>
        </div>
      </article>

      {/* Table */}
      <article className="card elite-card">
        <header className="card-header" style={{ marginBottom: 16 }}>
          <h3>Historial de Pagos</h3>
          <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{filtered.length} registros</span>
        </header>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
            <Receipt size={40} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p>No se encontraron pagos</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${t.border}`, background: t.surface2 }}>
                  {["Fecha","Monto","Tipo","Método","Moneda","Notas"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Monto" ? "right" : "left", fontWeight: 600, color: t.textSub, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${t.borderFaint}`, transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.surfaceHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "10px 12px", color: t.textSub }}>{fmtDate(p.createdAt)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{fmtCurrency(p.amount, p.currency)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
                        background: p.paymentType === "pago_completo" ? t.pillPagoCompleto.bg : t.pillAbono.bg,
                        color: p.paymentType === "pago_completo" ? t.pillPagoCompleto.color : t.pillAbono.color,
                      }}>
                        {TYPE_LABELS[p.paymentType] ?? p.paymentType}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: t.textSub }}>{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</td>
                    <td style={{ padding: "10px 12px", color: t.textSub }}>{p.currency}</td>
                    <td style={{ padding: "10px 12px", color: t.textMuted, fontSize: "0.8rem" }}>{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
