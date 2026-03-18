import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import type { AuthSession, Budget, BudgetItem } from "../types";
import { Download, FileSpreadsheet, Plus, Printer, Trash2, X } from "lucide-react";
import { generateBudgetPdf } from "../lib/generateBudgetPdf";
import { Modal } from "../components/Modal";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  approved: "Aprobado",
  partial: "Abonado",
  paid: "Pagado",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:    { bg: "#f1f5f9", color: "#475569" },
  sent:     { bg: "#dbeafe", color: "#1e40af" },
  approved: { bg: "#d1fae5", color: "#065f46" },
  partial:  { bg: "#fef3c7", color: "#92400e" },
  paid:     { bg: "#bbf7d0", color: "#065f46" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(amount: number, currency: string) {
  return `${currency === "VES" ? "Bs." : "$"}${amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function newItem(): BudgetItem {
  return { id: "", description: "", tooth: "", quantity: 1, unitPrice: 0, total: 0, status: "pending" };
}

export function PresupuestoPage({ token, session }: { token: string; session: AuthSession }) {
  const { patientId } = useParams<{ patientId: string }>();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<BudgetItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientDocId, setPatientDocId] = useState("");

  useEffect(() => {
    if (!patientId) return;
    clinicalApi.getPatient(patientId, token)
      .then(p => {
        setPatientName(`${(p as any).firstName} ${(p as any).lastName}`);
        setPatientDocId((p as any).documentId || "");
      })
      .catch(() => {});
    loadBudgets();
  }, [patientId, token]);

  function loadBudgets() {
    if (!patientId) return;
    setLoading(true);
    clinicalApi.listPatientBudgets(patientId, token)
      .then(res => setBudgets(res.items || []))
      .catch(() => notify.error("Error al cargar presupuestos"))
      .finally(() => setLoading(false));
  }

  function openCreate() {
    setEditBudget(null);
    setTitle("");
    setCurrency("USD");
    setStatus("draft");
    setNotes("");
    setValidUntil("");
    setItems([newItem()]);
    setShowModal(true);
  }

  function openEdit(b: Budget) {
    setEditBudget(b);
    setTitle(b.title);
    setCurrency(b.currency);
    setStatus(b.status);
    setNotes(b.notes || "");
    setValidUntil(b.validUntil ? b.validUntil.slice(0, 10) : "");
    setItems(b.items?.length ? b.items : [newItem()]);
    setShowModal(true);
  }

  function addItem() {
    setItems(prev => [...prev, newItem()]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof BudgetItem, value: string | number) {
    setItems(prev => {
      const next = prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      });
      return next;
    });
  }

  const totalAmount = items.reduce((s, it) => s + (Number(it.quantity) * Number(it.unitPrice)), 0);

  async function save() {
    if (!patientId || !title) {
      notify.error("Completa el título");
      return;
    }
    setSaving(true);
    try {
      const data = {
        title, currency, status, notes,
        doctorId: session.userId,
        validUntil: validUntil || undefined,
        items: items.map(it => ({ ...it, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), total: Number(it.quantity) * Number(it.unitPrice) })),
      };
      if (editBudget) {
        await clinicalApi.updateBudget(editBudget.id, data, token);
        notify.success("Presupuesto actualizado");
      } else {
        await clinicalApi.createBudget(patientId, data, token);
        notify.success("Presupuesto creado");
      }
      setShowModal(false);
      loadBudgets();
    } catch (err) {
      notify.error("Error al guardar", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    if (!window.confirm("¿Eliminar este presupuesto?")) return;
    clinicalApi.deleteBudget(id, token)
      .then(() => { notify.success("Eliminado"); loadBudgets(); })
      .catch(() => notify.error("Error al eliminar"));
  }

  async function handleDownloadPdf(b: Budget) {
    setPdfLoading(b.id);
    try {
      const profile = await clinicalApi.getUserProfile(token);
      generateBudgetPdf({
        budget: b,
        patientName,
        patientDocumentId: patientDocId,
        doctorName: session.name || "",
        doctorPhone: (profile as any).phone || "",
        doctorEmail: profile.email || "",
      });
    } catch (err) {
      notify.error("Error al generar PDF", err instanceof Error ? err.message : String(err));
    } finally {
      setPdfLoading(null);
    }
  }

  function printBudget(b: Budget) {
    const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const rowsHtml = (b.items || []).map((it, i) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;">${it.description}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">${it.tooth || "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;">${it.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtMoney(it.unitPrice, b.currency)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${fmtMoney(it.total, b.currency)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto — ${b.title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; padding: 30px 40px; }
  .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
  .header h1 { font-size: 13pt; color: #3b82f6; margin-bottom: 4px; }
  .header p { font-size: 9pt; color: #64748b; margin: 2px 0; }
  .doc-title { font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 20px; color: #0f172a; }
  .info-row { display: flex; gap: 20px; margin-bottom: 16px; }
  .info-field { flex: 1; }
  .info-field label { font-size: 8pt; text-transform: uppercase; color: #94a3b8; font-weight: bold; letter-spacing: 0.05em; display: block; margin-bottom: 4px; }
  .info-field p { font-size: 11pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  thead th { background: #f8fafc; padding: 10px; text-align: left; font-size: 9pt; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; border-bottom: 2px solid #e2e8f0; }
  .total-row td { padding: 12px 10px; background: #f0fdf4; font-weight: 700; font-size: 12pt; color: #065f46; }
  .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Presupuesto de Tratamiento</h1>
      <p>Generado: ${today}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:11pt;font-weight:700;color:#0f172a;">${b.title}</p>
      <p style="font-size:9pt;color:${b.status === 'approved' ? '#065f46' : '#64748b'};">${STATUS_LABELS[b.status] || b.status}</p>
    </div>
  </div>

  <div class="info-row">
    <div class="info-field"><label>Paciente</label><p>${patientName}</p></div>
    <div class="info-field"><label>Moneda</label><p>${b.currency}</p></div>
    ${b.validUntil ? `<div class="info-field"><label>Válido hasta</label><p>${fmtDate(b.validUntil)}</p></div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th>Descripción</th>
        <th style="width:80px;text-align:center;">Diente</th>
        <th style="width:60px;text-align:center;">Cant.</th>
        <th style="width:100px;text-align:right;">P. Unit.</th>
        <th style="width:110px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="5" style="text-align:right;padding:12px 10px;">TOTAL</td>
        <td style="text-align:right;padding:12px 10px;">${fmtMoney(b.totalAmount, b.currency)}</td>
      </tr>
    </tbody>
  </table>

  ${b.notes ? `<div style="margin-top:20px;padding:12px;background:#f8fafc;border-radius:6px;border-left:3px solid #3b82f6;font-size:10pt;color:#475569;">${b.notes}</div>` : ""}

  <div class="footer">DOCCO — Presupuesto generado el ${today}</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=850,height=950");
    if (!win) { notify.error("No se pudo abrir la impresión."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  return (
    <section className="page-section">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileSpreadsheet size={20} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Presupuestos</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>{patientName || "Paciente"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
        >
          <Plus size={16} />
          Nuevo Presupuesto
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Cargando...</div>
      ) : budgets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <FileSpreadsheet size={48} strokeWidth={1} style={{ opacity: 0.2, marginBottom: 16 }} />
          <p style={{ color: "#64748b" }}>No hay presupuestos. Crea el primero.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {budgets.map(b => {
            const sc = STATUS_COLORS[b.status] || { bg: "#f1f5f9", color: "#475569" };
            return (
              <article key={b.id} className="card elite-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>{b.title}</h3>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => handleDownloadPdf(b)} title="Descargar PDF" disabled={pdfLoading === b.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", cursor: "pointer", opacity: pdfLoading === b.id ? 0.5 : 1 }}>
                      <Download size={14} />
                    </button>
                    <button type="button" onClick={() => printBudget(b)} title="Imprimir" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                      <Printer size={14} />
                    </button>
                    <button type="button" onClick={() => openEdit(b)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Editar</button>
                    <button type="button" onClick={() => deleteBudget(b.id)} style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#991b1b" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: "0.85rem", color: "#64748b", marginBottom: 12 }}>
                  <span>Creado: {fmtDate(b.createdAt)}</span>
                  {b.validUntil && <span>Válido hasta: {fmtDate(b.validUntil)}</span>}
                  <span>Moneda: {b.currency}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{b.items?.length || 0} ítem(s)</span>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#10b981" }}>{fmtMoney(b.totalAmount, b.currency)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          {/* Widen modal for budget form */}
          <style>{`.modal-card { max-width: 640px !important; }`}</style>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>{editBudget ? "Editar Presupuesto" : "Nuevo Presupuesto"}</h3>
            <button type="button" onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div className="input-group" style={{ gridColumn: "1/-1", margin: 0 }}>
              <label>Título</label>
              <input type="text" className="elite-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Presupuesto Implante Dental" />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <label>Moneda</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="USD">USD (Dólares)</option>
                <option value="VES">VES (Bolívares)</option>
              </select>
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <label>Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <label>Válido hasta</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          {/* Items table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: "0.875rem" }}>Ítems del presupuesto</label>
              <button type="button" onClick={addItem} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", color: "#065f46", border: "1px solid #bbf7d0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                <Plus size={12} /> Agregar ítem
              </button>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#64748b" }}>Descripción</th>
                    <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, color: "#64748b", width: 70 }}>Diente</th>
                    <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 600, color: "#64748b", width: 60 }}>Cant.</th>
                    <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: "#64748b", width: 90 }}>P. Unit.</th>
                    <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600, color: "#64748b", width: 90 }}>Total</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="text" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Descripción..." className="budget-item-input" />
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <input type="text" value={item.tooth || ""} onChange={e => updateItem(i, "tooth", e.target.value)} placeholder="—" className="budget-item-input" style={{ textAlign: "center" }} />
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", Number(e.target.value))} className="budget-item-input" style={{ textAlign: "center" }} />
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <input type="number" min={0} step={0.01} value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", Number(e.target.value))} placeholder="0.00" className="budget-item-input" style={{ textAlign: "right" }} />
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                        {fmtMoney(Number(item.quantity) * Number(item.unitPrice), currency)}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "center" }}>
                        <button type="button" onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f0fdf4" }}>
                    <td colSpan={4} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#065f46" }}>TOTAL</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#065f46", fontSize: "1rem" }}>
                      {fmtMoney(totalAmount, currency)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="input-group">
            <label>Notas</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones adicionales..." style={{ width: "100%", resize: "vertical", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.875rem" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="action-btn action-btn-confirm" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : editBudget ? "Actualizar" : "Crear Presupuesto"}
            </button>
            <button type="button" className="action-btn" onClick={() => setShowModal(false)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// Also export a list page for the /presupuestos route (shows all, or redirects)
export function PresupuestosListPage({ token: _token, session: _session }: { token: string; session: AuthSession }) {
  return (
    <section className="page-section">
      <div style={{ textAlign: "center", padding: 60 }}>
        <FileSpreadsheet size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 16 }} />
        <h3>Presupuestos de Pacientes</h3>
        <p style={{ color: "#64748b", marginTop: 8 }}>Para ver o crear presupuestos, accede desde el perfil de un paciente.</p>
      </div>
    </section>
  );
}
