import React from "react";

interface MedicalHistoryFormProps {
  patientData: any;
  readOnly?: boolean;
}

export function MedicalHistoryForm({ patientData, readOnly = false }: MedicalHistoryFormProps) {
  const historyMap = React.useMemo(() => {
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
            <input 
              type="checkbox" 
              id={path.id} 
              checked={historyMap[path.id] || false} 
              disabled={readOnly}
              onChange={() => {}} 
            />
            <label htmlFor={path.id}>{path.label}</label>
          </div>
        ))}
      </div>

      <div className="input-group" style={{ marginTop: '24px' }}>
        <label>Otras patologías / Observaciones</label>
        <textarea 
          defaultValue={patientData?.medicalBackgrounds?.find((bg: any) => bg.type === "notes")?.description || ""} 
          readOnly={readOnly}
          rows={3} 
          placeholder="Detalle adicional..."
        />
      </div>
    </div>
  );
}
