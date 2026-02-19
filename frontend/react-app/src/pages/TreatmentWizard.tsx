import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { MedicalHistoryForm } from "../modules/treatment/components/MedicalHistoryForm";
import { OdontogramChart } from "../modules/treatment/components/OdontogramChart";
import { ProceduresTable } from "../modules/treatment/components/ProceduresTable";

type WizardStep = 1 | 2;

export function TreatmentWizard({ token }: { token: string; doctorId: string }) {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<WizardStep>(1);
  const [cedula, setCedula] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [odontogramData, setOdontogramData] = useState<any>(null);
  const [toothStates, setToothStates] = useState<Record<number, Record<string, string>>>({});
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (!patientId) {
      return;
    }

    setCedula(patientId);
    setSearching(true);
    clinicalApi
      .getPatient(patientId, token)
      .then(async (patientResult) => {
        setPatient(patientResult);
        try {
          const odnResult = await clinicalApi.getOdontogramByPatient(patientResult.id, token);
          setOdontogramData(odnResult);
        } catch {
          setOdontogramData(null);
        }
        setStep(2);
      })
      .catch(() => {
        notify.error("No se pudo cargar el paciente seleccionado", "Verifica el identificador del paciente e intenta nuevamente.");
      })
      .finally(() => setSearching(false));
  }, [searchParams, token]);

  async function handleSearch() {
    if (!cedula.trim()) return;
    setSearching(true);

    const promise = clinicalApi.getPatient(cedula, token).then(async (patientResult) => {
      setPatient(patientResult);
      try {
        const odnResult = await clinicalApi.getOdontogramByPatient(patientResult.id, token);
        setOdontogramData(odnResult);
      } catch {
        setOdontogramData(null);
      }
      setStep(2);
      return patientResult;
    });

    notify.promise(promise, {
      loading: "Buscando expediente...",
      success: (_p: any) => "Expediente localizado",
      successDesc: (p: any) => `${p.firstName} ${p.lastName}`,
      error: "Paciente no encontrado",
      errorDesc: (err) => err instanceof Error ? err.message : "Verifica la cédula e intenta de nuevo.",
    }).finally(() => setSearching(false));
  }

  const handleToothSurfaceClick = (toothNum: number, surface: string) => {
    setToothStates(prev => {
      const currentTooth = prev[toothNum] || { O: 'none', V: 'none', L: 'none', M: 'none', D: 'none' };
      const conditions = ['none', 'caries', 'restored', 'completed'];
      const currentIdx = conditions.indexOf(currentTooth[surface] || 'none');
      const nextCondition = conditions[(currentIdx + 1) % conditions.length];
      
      return {
        ...prev,
        [toothNum]: {
          ...currentTooth,
          [surface]: nextCondition
        }
      };
    });
  };

  return (
    <div className="wizard-container reveal-up">
      <header className="page-header">
        <div className="header-badge">Módulo Clínico</div>
        <h2>{step === 1 ? "Iniciando Nuevo Tratamiento" : "Evaluación Clínica Elite"}</h2>
        <p>{step === 1 ? "Sincronice el expediente del paciente para comenzar." : "Complete el diagnóstico y plan de tratamiento."}</p>
      </header>

      <div className="wizard-steps">
        <div className={`step-indicator ${step >= 1 ? "active" : ""}`}>
          <div className="step-number">1</div>
          <span>Validación de Identidad</span>
        </div>
        <div className={`step-indicator ${step >= 2 ? "active" : ""}`}>
          <div className="step-number">2</div>
          <span>Planificación Clínica</span>
        </div>
      </div>

      {step === 1 && (
        <article className="card elite-card">
          <div className="card-header">
            <h3>Identificación del Paciente</h3>
          </div>
          <p className="helper-text">Ingrese el número de documento oficial para recuperar la historia clínica digital.</p>
          
          <div className="card-form" style={{ marginTop: '24px' }}>
            <div className="input-group">
              <label>Cédula de Identidad / Pasaporte</label>
              <div className="inline-actions">
                <input 
                  value={cedula} 
                  onChange={(e) => setCedula(e.target.value)} 
                  placeholder="Ej. 12345678" 
                  autoFocus
                  className="elite-input"
                />
                <button onClick={handleSearch} className="primary-btn" disabled={searching}>
                  {searching ? <><span className="auth-spinner" />Buscando...</> : "Localizar Expediente"}
                </button>
              </div>
            </div>
          </div>
        </article>
      )}

      {step === 2 && patient && (
        <div className="wizard-details">
          <article className="patient-summary-header elite-card">
            <div className="summary-main">
              <div className="patient-avatar-large">
                {patient.firstName[0]}{patient.lastName[0]}
              </div>
              <div className="summary-info">
                <h3>{patient.firstName} {patient.lastName}</h3>
                <p>Cédula: <strong>{patient.documentId || patient.id}</strong></p>
                <div className="patient-tags">
                  <span className="badge status-confirmed">Expediente Activo</span>
                  <span className="badge status-scheduled">{patient.phone}</span>
                </div>
              </div>
            </div>
            <button className="ghost" onClick={() => setStep(1)}>Cambiar Paciente</button>
          </article>

          <div className="grid-2-cols" style={{ marginTop: '32px' }}>
            <div className="details-main-column">
              <article className="card elite-card">
                <MedicalHistoryForm patientData={patient} readOnly />
              </article>

              <article className="card elite-card" style={{ marginTop: '32px' }}>
                <header className="card-header">
                  <h3>Odontograma Interactivo</h3>
                  <p>
                    {odontogramData 
                      ? "Sincronizado con el registro histórico." 
                      : "Inicializando nuevo mapeo para este paciente."}
                  </p>
                </header>
                <OdontogramChart 
                  toothStates={toothStates} 
                  onToothClick={handleToothSurfaceClick} 
                />
              </article>

              <article className="card elite-card" style={{ marginTop: '32px' }}>
                <ProceduresTable procedures={[]} />
              </article>
            </div>

            <div className="details-side-column">
              <article className="card elite-card sticky-card">
                <h3>Propuesta de Plan</h3>
                <p>Genere un nuevo plan de tratamiento basado en el diagnóstico actual.</p>
                <form className="card-form" style={{ marginTop: '24px' }}>
                  <div className="input-group">
                    <label>Título del Procedimiento</label>
                    <input placeholder="Ej. Restauración Estética" required className="elite-input" />
                  </div>
                  <div className="input-group">
                    <label>Observaciones del Especialista</label>
                    <textarea rows={6} placeholder="Detalle la evolución esperada..." className="elite-input" />
                  </div>
                  <button type="submit" className="primary-btn full-width">Finalizar y Guardar</button>
                </form>
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
