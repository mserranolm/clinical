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
              <th style={{ width: '150px' }}>Fecha</th>
              <th className="evolution-cell">Evolución / Detalle</th>
              <th style={{ width: '150px' }}>Firma Autorizada</th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((proc) => (
              <tr key={proc.id}>
                <td>{new Date(proc.date).toLocaleDateString()}</td>
                <td>{proc.evolution}</td>
                <td style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  {proc.signed ? "Firmado Digitalmente" : "Pendiente"}
                </td>
              </tr>
            ))}
            {procedures.length === 0 && (
              <>
                {[1, 2, 3].map((i) => (
                  <tr key={`empty-${i}`}>
                    <td style={{ height: '40px' }}></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
