import { useMemo } from "react";

interface MedicalHistoryFormProps {
  patientData: any;
  readOnly?: boolean;
}

export function MedicalHistoryForm({ patientData, readOnly = false }: MedicalHistoryFormProps) {
  const historyMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (Array.isArray(patientData?.medicalBackgrounds)) {
      patientData.medicalBackgrounds.forEach((bg: any) => {
        map[bg.type] = true;
      });
    }
    return map;
  }, [patientData]);

  const pathologies = [
    { id: "medication", label: "¿Toma algún medicamento?" },
    { id: "allergy_med", label: "¿Alergia a algún medicamento?" },
    { id: "allergies", label: "Alergias" },
    { id: "anemia", label: "Anemia" },
    { id: "hepatitis", label: "Hepatitis" },
    { id: "diabetes", label: "Diabetes" },
    { id: "hypertension", label: "Hipertensión" },
    { id: "cholesterol", label: "Colesterol" },
  ];

  return (
    <div className="medical-history-form">
      <header className="form-section-header">
        <h4>Histórico Médico</h4>
      </header>
      
      <div className="history-checklist">
        {pathologies.map((path) => (
          <div key={path.id} className="check-item">
            <div className={`custom-checkbox ${historyMap[path.id] ? 'checked' : ''} ${readOnly ? 'readonly' : ''}`}>
              {historyMap[path.id] && "✓"}
            </div>
            <label>{path.label}</label>
          </div>
        ))}
      </div>

      <div className="other-pathologies">
        <label>Otra patología / Observaciones</label>
        <div className={`dotted-line-text ${readOnly ? 'readonly' : ''}`}>
          {patientData?.medicalBackgrounds?.find((bg: any) => bg.type === "notes")?.description || "Ninguna observada."}
        </div>
      </div>
    </div>
  );
}
