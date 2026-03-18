import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Budget } from "../types";

export interface PdfBudgetData {
  budget: Budget;
  patientName: string;
  patientDocumentId: string;
  doctorName: string;
  doctorPhone: string;
  doctorEmail: string;
}

// -- helpers --

function fmtCedula(doc: string): string {
  if (!doc) return "—";
  const digits = doc.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtTarifa(amount: number, currency: string): string {
  const symbol = currency === "VES" ? "Bs." : "$";
  return `${symbol}${amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// -- colors --
const BEIGE = "#f5ece4";
const DARK_BROWN = "#3d2c1e";
const DOCTOR_NAME = "#2d2018";
const MUTED_TEXT = "#5a4a3a";
const LABEL_SIENNA = "#a0522d";
const TABLE_HEADER_BG = "#f0ebe5";

export function generateBudgetPdf(data: PdfBudgetData): void {
  const { budget, patientName, patientDocumentId, doctorName, doctorPhone, doctorEmail } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ═══════════════════════════════════════════
  // 1. HEADER — beige rectangle
  // ═══════════════════════════════════════════
  const headerH = 38;
  doc.setFillColor(BEIGE);
  doc.rect(0, 0, pageWidth, headerH, "F");

  // Left: "Presupuesto"
  doc.setFont("times", "normal");
  doc.setFontSize(28);
  doc.setTextColor(DARK_BROWN);
  doc.text("Presupuesto", margin, 22);

  // Right: doctor info
  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DOCTOR_NAME);
  doc.text(doctorName, rightX, 13, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED_TEXT);
  doc.text("ODONTOLOGÍA", rightX, 18, { align: "right" });

  if (doctorPhone) {
    doc.setFontSize(8);
    doc.text(`\u260E  ${doctorPhone}`, rightX, 25, { align: "right" });
  }
  if (doctorEmail) {
    doc.setFontSize(8);
    doc.text(`\u2709  ${doctorEmail}`, rightX, 30, { align: "right" });
  }

  // ═══════════════════════════════════════════
  // 2. PATIENT SECTION
  // ═══════════════════════════════════════════
  let y = headerH + 14;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(LABEL_SIENNA);
  doc.text("Paciente:", margin, y);
  y += 4;

  // Mini patient table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 4, right: 4 } },
    columnStyles: {
      0: { fontStyle: "bold", textColor: DARK_BROWN, cellWidth: 50 },
      1: { textColor: "#333333" },
    },
    body: [
      ["Nombre y Apellido", patientName],
      ["Cédula", fmtCedula(patientDocumentId)],
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ═══════════════════════════════════════════
  // 3. ITEMS TABLE
  // ═══════════════════════════════════════════
  const rows = (budget.items || []).map(it => {
    const desc = it.quantity > 1 ? `(${it.quantity}) ${it.description}` : it.description;
    return [desc, fmtTarifa(it.total, budget.currency)];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Descripción", "Tarifa"]],
    body: rows,
    foot: [["TOTAL", fmtTarifa(budget.totalAmount, budget.currency)]],
    theme: "grid",
    headStyles: {
      fillColor: TABLE_HEADER_BG,
      textColor: DARK_BROWN,
      fontStyle: "bold",
      fontSize: 10,
      lineWidth: 0.1,
      lineColor: "#d6cfc7",
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: "#333333",
      lineWidth: 0.1,
      lineColor: "#e8e2da",
    },
    footStyles: {
      fillColor: BEIGE,
      textColor: DOCTOR_NAME,
      fontStyle: "bold",
      fontSize: 10.5,
      lineWidth: 0.1,
      lineColor: "#d6cfc7",
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.65 },
      1: { halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ═══════════════════════════════════════════
  // 4. FOOTER — notes, validity, date
  // ═══════════════════════════════════════════
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED_TEXT);

  if (budget.notes) {
    doc.setFont("helvetica", "italic");
    doc.text("Notas:", margin, y);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(budget.notes, contentWidth);
    doc.text(noteLines, margin, y + 5);
    y += 5 + noteLines.length * 4;
  }

  if (budget.validUntil) {
    const validDate = new Date(budget.validUntil).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Válido hasta: ${validDate}`, margin, y);
    y += 6;
  }

  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(7.5);
  doc.setTextColor("#999999");
  doc.text(`Generado el ${today}`, margin, y + 4);

  // ═══════════════════════════════════════════
  // 5. SAVE
  // ═══════════════════════════════════════════
  const slug = budget.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`presupuesto-${slug}-${dateStr}.pdf`);
}
