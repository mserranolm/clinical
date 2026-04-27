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
  // Opcionales — identidad visual de la clínica
  logoBase64?: string;
  logoMimeType?: string; // "PNG" | "JPEG"
  signatureBase64?: string;
  signatureMimeType?: string; // "PNG" | "JPEG"
}

// -- helpers --

function fmtTarifa(amount: number, currency: string): string {
  const symbol = currency === "VES" ? "Bs." : "$";
  return `${symbol}${amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// -- colors --
const HEADER_BG = "#e8edf2";
const DARK = "#1e293b";
const MUTED = "#64748b";
const TABLE_HEAD = "#1e293b";
const ZEBRA_ODD = "#f8fafc";
const TABLE_FOOT = "#1e293b";

export function generateBudgetPdf(data: PdfBudgetData): void {
  const {
    budget,
    patientName,
    doctorName,
    doctorPhone,
    doctorEmail,
    logoBase64,
    logoMimeType,
    signatureBase64,
    signatureMimeType,
  } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // ═══════════════════════════════════════════
  // 1. HEADER — fondo gris azulado suave
  // ═══════════════════════════════════════════
  const headerH = 58;
  const [hR, hG, hB] = hexToRgb(HEADER_BG);
  doc.setFillColor(hR, hG, hB);
  doc.rect(0, 0, pageWidth, headerH, "F");

  // Logo (arriba izquierda) o nombre de la clínica
  if (logoBase64 && logoMimeType) {
    try {
      // Ancho máx 40mm, alto máx 20mm — mantener proporciones
      doc.addImage(
        logoBase64,
        logoMimeType as "PNG" | "JPEG",
        margin,
        8,
        40,
        20,
      );
    } catch {
      // fallback: nombre de la clínica en texto
      doc.setFont("times", "italic");
      doc.setFontSize(18);
      doc.setTextColor(hexToRgb(DARK)[0], hexToRgb(DARK)[1], hexToRgb(DARK)[2]);
      doc.text(doctorName, margin, 22);
    }
  } else {
    doc.setFont("times", "italic");
    doc.setFontSize(18);
    const [dR, dG, dB] = hexToRgb(DARK);
    doc.setTextColor(dR, dG, dB);
    doc.text(doctorName, margin, 22);
  }

  // Título "Cotización" (arriba derecha)
  const rightX = pageWidth - margin;
  doc.setFont("times", "normal");
  doc.setFontSize(36);
  const [dkR, dkG, dkB] = hexToRgb(DARK);
  doc.setTextColor(dkR, dkG, dkB);
  doc.text("Cotización", rightX, 22, { align: "right" });

  // Fecha y folio debajo del título
  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const shortId = budget.id ? budget.id.slice(-8).toUpperCase() : "—";
  const [mR, mG, mB] = hexToRgb(MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(mR, mG, mB);
  doc.text(`Fecha: ${today}`, rightX, 30, { align: "right" });
  doc.text(`Folio: ${shortId}`, rightX, 36, { align: "right" });

  // Nombre del paciente (debajo del logo)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(dkR, dkG, dkB);
  doc.text(`Pac. ${patientName}`, margin, 40);

  // Info del doctor (debajo del paciente, lado izquierdo)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(dkR, dkG, dkB);
  doc.text(`DR. ${doctorName.toUpperCase()}`, margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(mR, mG, mB);
  const infoY = 56;
  const contactParts: string[] = [];
  if (doctorPhone) contactParts.push(doctorPhone);
  if (doctorEmail) contactParts.push(doctorEmail);
  if (contactParts.length > 0) {
    doc.text(contactParts.join("  ·  "), margin, infoY);
  }

  // ═══════════════════════════════════════════
  // 2. TABLA DE ITEMS
  // ═══════════════════════════════════════════
  const tableStartY = headerH + 10;

  const rows = (budget.items || []).map((it, i) => [
    it.description,
    String(i + 1).padStart(2, "0"),
    fmtTarifa(it.unitPrice, budget.currency),
    fmtTarifa(it.total, budget.currency),
  ]);

  const [thR, thG, thB] = hexToRgb(TABLE_HEAD);
  const [tfR, tfG, tfB] = hexToRgb(TABLE_FOOT);
  const [zoR, zoG, zoB] = hexToRgb(ZEBRA_ODD);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [["Descripción", "CANTIDAD", "PRECIO UNIT.", "TOTAL"]],
    body: rows,
    foot: [
      [
        {
          content: `TOTAL A PAGAR: ${fmtTarifa(budget.totalAmount, budget.currency)}`,
          colSpan: 4,
          styles: { halign: "right" },
        },
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [thR, thG, thB],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      lineWidth: 0,
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: hexToRgb("#334155"),
      lineWidth: 0.1,
      lineColor: hexToRgb("#e2e8f0"),
    },
    footStyles: {
      fillColor: [tfR, tfG, tfB],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      lineWidth: 0,
    },
    alternateRowStyles: {
      fillColor: [zoR, zoG, zoB],
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.5 },
      1: { halign: "center", cellWidth: contentWidth * 0.15 },
      2: { halign: "right", cellWidth: contentWidth * 0.17 },
      3: { halign: "right", cellWidth: contentWidth * 0.18 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 12;

  // ═══════════════════════════════════════════
  // 3. FOOTER — nota legal + firma
  // ═══════════════════════════════════════════
  const halfWidth = contentWidth / 2;
  const signatureX = margin + halfWidth + 4;

  // Notas personalizadas (si existen)
  if (budget.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(mR, mG, mB);
    const noteLines = doc.splitTextToSize(budget.notes, halfWidth - 4);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
  }

  // Nota legal (lado izquierdo)
  const legalY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(dkR, dkG, dkB);
  doc.text("NOTA", margin, legalY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(mR, mG, mB);
  const legal1 =
    "Algunos tratamientos pudieran estar sujetos a cambios al momento de la apertura de la unidad dentaria.";
  const legal2 =
    "Este documento tiene un tiempo de 15 (quince) días de validez.";
  const l1Lines = doc.splitTextToSize(legal1, halfWidth - 4);
  const l2Lines = doc.splitTextToSize(legal2, halfWidth - 4);
  doc.text(l1Lines, margin, legalY + 5);
  doc.text(l2Lines, margin, legalY + 5 + l1Lines.length * 3.8);

  // Bloque de firma (lado derecho)
  const signCenterX = signatureX + halfWidth / 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(mR, mG, mB);
  doc.text("APROBADO POR", signCenterX, legalY, { align: "center" });

  if (signatureBase64 && signatureMimeType) {
    try {
      // Imagen de firma: 40mm de ancho, centrada, con margen superior
      const imgW = 40;
      const imgH = 18;
      const imgX = signCenterX - imgW / 2;
      doc.addImage(
        signatureBase64,
        signatureMimeType as "PNG" | "JPEG",
        imgX,
        legalY + 4,
        imgW,
        imgH,
      );
      // Línea debajo de la imagen
      const lineY = legalY + 4 + imgH + 2;
      doc.setDrawColor(mR, mG, mB);
      doc.setLineWidth(0.3);
      doc.line(signatureX, lineY, signatureX + halfWidth - 4, lineY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(dkR, dkG, dkB);
      doc.text(doctorName, signCenterX, lineY + 5, { align: "center" });
    } catch {
      // fallback sin imagen
      doc.text("______________________", signCenterX, legalY + 20, {
        align: "center",
      });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(dkR, dkG, dkB);
      doc.text(doctorName, signCenterX, legalY + 26, { align: "center" });
    }
  } else {
    doc.setTextColor(mR, mG, mB);
    doc.text("______________________", signCenterX, legalY + 20, {
      align: "center",
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(dkR, dkG, dkB);
    doc.text(doctorName, signCenterX, legalY + 26, { align: "center" });
  }

  // Línea separadora inferior
  const footerLineY = pageHeight - 12;
  doc.setDrawColor(
    hexToRgb("#e2e8f0")[0],
    hexToRgb("#e2e8f0")[1],
    hexToRgb("#e2e8f0")[2],
  );
  doc.setLineWidth(0.3);
  doc.line(margin, footerLineY, pageWidth - margin, footerLineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(mR, mG, mB);
  doc.text("DOCCO — Sistema de gestión clínica", margin, footerLineY + 5);
  doc.text(`Generado el ${today}`, pageWidth - margin, footerLineY + 5, {
    align: "right",
  });

  // ═══════════════════════════════════════════
  // 4. GUARDAR
  // ═══════════════════════════════════════════
  const slug = budget.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`presupuesto-${slug}-${dateStr}.pdf`);
}
