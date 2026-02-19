import React from "react";

interface Procedure {
  id: string;
  date: string;
  evolution: string;
  signed: boolean;
}

interface ProceduresTableProps {
  procedures: Procedure[];
}

export function ProceduresTable({ procedures }: ProceduresTableProps) {
  return (
    <div className="procedures-section">
      <header className="form-section-header">
        <h4>Procedimientos Realizados</h4>
      </header>
      
      <div className="table-wrap">
        <table className="procedures-table">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Fecha</th>
              <th className="evolution-cell">Evolución / Detalle del Procedimiento</th>
              <th style={{ width: '100px' }}>Firma</th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((proc) => (
              <tr key={proc.id}>
                <td>{new Date(proc.date).toLocaleDateString()}</td>
                <td>{proc.evolution}</td>
                <td style={{ textAlign: 'center' }}>
                  {proc.signed ? "✅" : "—"}
                </td>
              </tr>
            ))}
            {procedures.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">No hay procedimientos registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
