import { useState } from "react";
import { clinicalApi } from "../api/clinical";
import { SectionResult, type ActionState } from "../components/ui/SectionResult";
import { MedicalHistoryForm } from "../modules/treatment/components/MedicalHistoryForm";
import { OdontogramChart } from "../modules/treatment/components/OdontogramChart";
import { ProceduresTable } from "../modules/treatment/components/ProceduresTable";

type WizardStep = 1 | 2;

export function TreatmentWizard({ token, doctorId }: { token: string; doctorId: string }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [cedula, setCedula] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });

  async function handleSearch() {
    if (!cedula.trim()) return;
    setState({ status: "loading", title: "Buscando paciente..." });
    
    try {
      // For now, we use getPatient assuming the input might be the ID or we'd need a search by documentId
      // Ideally backend should have GET /patients/search?documentId=...
      // Since we don't have it, we'll try to find it or simulate for the demo
      const result = await clinicalApi.getPatient(cedula, token);
      setPatient(result);
      setStep(2);
      setState({ status: "success", title: "Paciente encontrado" });
    } catch (error) {
      setState({ 
        status: "error", 
        title: "No encontrado", 
        payload: { message: "No se encontró un paciente con esa cédula/ID." } 
      });
    }
  }

  return (
    <div className="wizard-container">
      <header className="page-header">
        <h2>Nuevo Tratamiento</h2>
        <p>Inicie un nuevo proceso clínico para un paciente existente.</p>
      </header>

      <div className="wizard-steps">
        <div className={`step-indicator ${step >= 1 ? "active" : ""}`}>
          <div className="step-number">1</div>
          <span>Identificación</span>
        </div>
        <div className={`step-indicator ${step >= 2 ? "active" : ""}`}>
          <div className="step-number">2</div>
          <span>Evaluación Elite</span>
        </div>
      </div>

      {step === 1 && (
        <article className="card elite-card reveal-up">
          <h3>Identificación del Paciente</h3>
          <p>Ingrese el número de cédula o ID para recuperar el expediente.</p>
          <div className="card-form" style={{ marginTop: '20px' }}>
            <div className="input-group">
              <label>Cédula de Identidad</label>
              <div className="inline-actions">
                <input 
                  value={cedula} 
                  onChange={(e) => setCedula(e.target.value)} 
                  placeholder="Ej. 12345678" 
                  autoFocus
                />
                <button onClick={handleSearch}>Continuar</button>
              </div>
            </div>
          </div>
          <SectionResult state={state} />
        </article>
      )}

      {step === 2 && patient && (
        <div className="wizard-details reveal-up">
          <article className="card elite-card patient-summary-header">
            <div className="summary-main">
              <div className="patient-avatar-large">
                {patient.firstName[0]}{patient.lastName[0]}
              </div>
              <div className="summary-info">
                <h3>{patient.firstName} {patient.lastName}</h3>
                <p>Cédula: <strong>{patient.documentId || patient.id}</strong> | Tel: {patient.phone || "N/A"}</p>
              </div>
            </div>
            <button className="ghost" onClick={() => setStep(1)}>Cambiar Paciente</button>
          </article>

          <div className="grid-2-cols" style={{ marginTop: '24px' }}>
            <div className="details-main-column">
              <article className="card elite-card">
                <MedicalHistoryForm patientData={patient} readOnly />
              </article>

              <article className="card elite-card" style={{ marginTop: '24px' }}>
                <header className="card-header">
                  <h3>Odontograma Clínico</h3>
                </header>
                <OdontogramChart />
              </article>

              <article className="card elite-card" style={{ marginTop: '24px' }}>
                <ProceduresTable procedures={[]} />
              </article>
            </div>

            <div className="details-side-column">
              <article className="card elite-card sticky-card">
                <h3>Plan de Tratamiento</h3>
                <p>Proponga los procedimientos a realizar.</p>
                <form className="card-form" style={{ marginTop: '20px' }}>
                  <div className="input-group">
                    <label>Título del Plan</label>
                    <input placeholder="Ej. Fase inicial" required />
                  </div>
                  <div className="input-group">
                    <label>Notas de la Propuesta</label>
                    <textarea rows={5} placeholder="Detalles del tratamiento sugerido..." />
                  </div>
                  <button type="submit">Generar Propuesta Elite</button>
                </form>
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
