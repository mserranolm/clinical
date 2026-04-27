import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { OdontogramChart } from "../modules/treatment/components/OdontogramChart";
import {
  type Surface,
  type SurfaceCondition,
  type ToothCondition,
  type ToothState,
  EMPTY_SURFACES,
  EMPTY_TOOTH_STATE,
  deserializeToothState,
  serializeToothState,
} from "../modules/treatment/components/odontogram-types";

type PatientData = {
  id: string;
  firstName: string;
  lastName: string;
  documentId?: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  medicalBackgrounds?: Array<{ type: string; description: string }>;
};

type PathologyEntry = { active: boolean; detail: string };

type MedicalHistory = {
  // campos de medicación/alergias (siguen siendo boolean/string)
  takeMedication: boolean;
  medicationDetail: string;
  allergyMed: boolean;
  allergyMedDetail: string;
  allergies: boolean;
  allergiesDetail: string;
  otherNotes: string;
  // chips personales
  anemia: PathologyEntry;
  hepatitis: PathologyEntry;
  diabetes: PathologyEntry;
  hypertension: PathologyEntry;
  cholesterol: PathologyEntry;
  cancer: PathologyEntry;
  // chips familiares
  anemiaFamily: PathologyEntry;
  hepatitisFamily: PathologyEntry;
  diabetesFamily: PathologyEntry;
  hypertensionFamily: PathologyEntry;
  cholesterolFamily: PathologyEntry;
  cancerFamily: PathologyEntry;
};

const emptyEntry = (): PathologyEntry => ({ active: false, detail: "" });

const EMPTY_HISTORY: MedicalHistory = {
  takeMedication: false,
  medicationDetail: "",
  allergyMed: false,
  allergyMedDetail: "",
  allergies: false,
  allergiesDetail: "",
  otherNotes: "",
  anemia: emptyEntry(),
  hepatitis: emptyEntry(),
  diabetes: emptyEntry(),
  hypertension: emptyEntry(),
  cholesterol: emptyEntry(),
  cancer: emptyEntry(),
  anemiaFamily: emptyEntry(),
  hepatitisFamily: emptyEntry(),
  diabetesFamily: emptyEntry(),
  hypertensionFamily: emptyEntry(),
  cholesterolFamily: emptyEntry(),
  cancerFamily: emptyEntry(),
};

function patientToHistory(
  medicalBackgrounds: Array<{ type: string; description: string }>,
): MedicalHistory {
  const h: MedicalHistory = {
    ...EMPTY_HISTORY,
    anemia: emptyEntry(),
    hepatitis: emptyEntry(),
    diabetes: emptyEntry(),
    hypertension: emptyEntry(),
    cholesterol: emptyEntry(),
    cancer: emptyEntry(),
    anemiaFamily: emptyEntry(),
    hepatitisFamily: emptyEntry(),
    diabetesFamily: emptyEntry(),
    hypertensionFamily: emptyEntry(),
    cholesterolFamily: emptyEntry(),
    cancerFamily: emptyEntry(),
  };
  for (const bg of medicalBackgrounds) {
    switch (bg.type) {
      case "anemia":
        h.anemia = { active: true, detail: bg.description };
        break;
      case "hepatitis":
        h.hepatitis = { active: true, detail: bg.description };
        break;
      case "diabetes":
        h.diabetes = { active: true, detail: bg.description };
        break;
      case "hypertension":
        h.hypertension = { active: true, detail: bg.description };
        break;
      case "cholesterol":
        h.cholesterol = { active: true, detail: bg.description };
        break;
      case "cancer":
        h.cancer = { active: true, detail: bg.description };
        break;
      case "family_anemia":
        h.anemiaFamily = { active: true, detail: bg.description };
        break;
      case "family_hepatitis":
        h.hepatitisFamily = { active: true, detail: bg.description };
        break;
      case "family_diabetes":
        h.diabetesFamily = { active: true, detail: bg.description };
        break;
      case "family_hypertension":
        h.hypertensionFamily = { active: true, detail: bg.description };
        break;
      case "family_cholesterol":
        h.cholesterolFamily = { active: true, detail: bg.description };
        break;
      case "family_cancer":
        h.cancerFamily = { active: true, detail: bg.description };
        break;
      case "medication":
        h.takeMedication = true;
        h.medicationDetail = bg.description;
        break;
      case "allergy_med":
        h.allergyMed = true;
        h.allergyMedDetail = bg.description;
        break;
      case "allergies":
        h.allergies = true;
        h.allergiesDetail = bg.description;
        break;
      case "notes":
        h.otherNotes = bg.description;
        break;
    }
  }
  return h;
}

function historyToBackgrounds(
  h: MedicalHistory,
): Array<{ type: string; description: string }> {
  const bgs: Array<{ type: string; description: string }> = [];
  // chips personales
  if (h.anemia.active)
    bgs.push({ type: "anemia", description: h.anemia.detail });
  if (h.hepatitis.active)
    bgs.push({ type: "hepatitis", description: h.hepatitis.detail });
  if (h.diabetes.active)
    bgs.push({ type: "diabetes", description: h.diabetes.detail });
  if (h.hypertension.active)
    bgs.push({ type: "hypertension", description: h.hypertension.detail });
  if (h.cholesterol.active)
    bgs.push({ type: "cholesterol", description: h.cholesterol.detail });
  if (h.cancer.active)
    bgs.push({ type: "cancer", description: h.cancer.detail });
  // chips familiares
  if (h.anemiaFamily.active)
    bgs.push({ type: "family_anemia", description: h.anemiaFamily.detail });
  if (h.hepatitisFamily.active)
    bgs.push({
      type: "family_hepatitis",
      description: h.hepatitisFamily.detail,
    });
  if (h.diabetesFamily.active)
    bgs.push({ type: "family_diabetes", description: h.diabetesFamily.detail });
  if (h.hypertensionFamily.active)
    bgs.push({
      type: "family_hypertension",
      description: h.hypertensionFamily.detail,
    });
  if (h.cholesterolFamily.active)
    bgs.push({
      type: "family_cholesterol",
      description: h.cholesterolFamily.detail,
    });
  if (h.cancerFamily.active)
    bgs.push({ type: "family_cancer", description: h.cancerFamily.detail });
  // otros
  if (h.takeMedication)
    bgs.push({ type: "medication", description: h.medicationDetail });
  if (h.allergyMed)
    bgs.push({ type: "allergy_med", description: h.allergyMedDetail });
  if (h.allergies)
    bgs.push({ type: "allergies", description: h.allergiesDetail });
  if (h.otherNotes) bgs.push({ type: "notes", description: h.otherNotes });
  return bgs;
}

type ConsultaPageProps = { token: string; doctorId: string };

export function ConsultaPage({ token, doctorId }: ConsultaPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") ?? "";
  const patientId = searchParams.get("patientId") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [history, setHistory] = useState<MedicalHistory>(EMPTY_HISTORY);
  const [toothStates, setToothStates] = useState<Record<number, ToothState>>(
    {},
  );
  const [odontogramId, setOdontogramId] = useState<string | null>(null);
  const [evolutionNotes, setEvolutionNotes] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "historia" | "odontograma" | "evolucion"
  >("historia");
  const [appointmentStatus, setAppointmentStatus] =
    useState<string>("scheduled");
  const [appointmentDate, setAppointmentDate] = useState<string>("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const isClosed = appointmentStatus === "completed";

  useEffect(() => {
    if (!patientId) {
      navigate("/dashboard/citas");
      return;
    }
    loadAll();
  }, [patientId]);

  async function loadAll() {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        clinicalApi.getPatient(patientId, token),
        clinicalApi.getOdontogramByPatient(patientId, token),
        appointmentId
          ? clinicalApi.getAppointment(appointmentId, token)
          : Promise.reject("no-id"),
      ]);

      const [pat, odnResult, apptResult] = results;

      if (pat.status === "fulfilled") {
        const p = pat.value as PatientData;
        setPatient(p);
        setHistory(patientToHistory(p.medicalBackgrounds ?? []));
      }

      if (apptResult.status === "fulfilled") {
        const appt = apptResult.value as {
          status: string;
          startAt?: string;
          evolutionNotes?: string;
          treatmentPlan?: string;
          paymentAmount?: number;
          paymentMethod?: string;
        };
        setAppointmentStatus(appt.status ?? "scheduled");
        setAppointmentDate(appt.startAt ?? "");
        if (appt.evolutionNotes) setEvolutionNotes(appt.evolutionNotes);
        if (appt.treatmentPlan) setTreatmentPlan(appt.treatmentPlan);
        if (appt.paymentAmount) setPaymentAmount(appt.paymentAmount);
        if ((appt as { imageKeys?: string[] }).imageKeys?.length) {
          const bucket = (appt as { imageKeys?: string[] }).imageKeys!;
          setImageUrls(
            bucket.map((k) =>
              k.startsWith("http")
                ? k
                : `https://clinical-appointment-images-975738006503.s3.amazonaws.com/${k}`,
            ),
          );
        }
      }

      if (odnResult.status === "fulfilled") {
        const odn = odnResult.value as { id: string; teeth?: unknown[] };
        setOdontogramId(odn.id);
        if (Array.isArray(odn.teeth)) {
          const states: Record<number, ToothState> = {};
          (
            odn.teeth as Array<{
              toothNumber: number;
              isPresent?: boolean;
              surfaces?: Array<{
                surface: string;
                condition: string;
                severity?: number;
              }>;
              generalNotes?: string;
            }>
          ).forEach((t) => {
            states[t.toothNumber] = deserializeToothState(t);
          });
          setToothStates(states);
        }
      }
    } catch {
      notify.error("Error cargando datos del paciente");
    } finally {
      setLoading(false);
    }
  }

  const handleSurfaceChange = useCallback(
    (toothNum: number, surface: Surface, cond: SurfaceCondition) => {
      if (isClosed) return;
      setToothStates((prev) => {
        const current = prev[toothNum] ?? {
          ...EMPTY_TOOTH_STATE,
          surfaces: { ...EMPTY_SURFACES },
        };
        return {
          ...prev,
          [toothNum]: {
            ...current,
            surfaces: { ...current.surfaces, [surface]: cond },
          },
        };
      });
    },
    [isClosed],
  );

  const handleToothConditionChange = useCallback(
    (toothNum: number, cond: ToothCondition) => {
      if (isClosed) return;
      setToothStates((prev) => {
        const current = prev[toothNum] ?? {
          ...EMPTY_TOOTH_STATE,
          surfaces: { ...EMPTY_SURFACES },
        };
        return {
          ...prev,
          [toothNum]: { ...current, condition: cond },
        };
      });
    },
    [isClosed],
  );

  const handleResetTooth = useCallback(
    (toothNum: number) => {
      if (isClosed) return;
      setToothStates((prev) => {
        const next = { ...prev };
        delete next[toothNum];
        return next;
      });
    },
    [isClosed],
  );

  async function saveHistoria() {
    if (!patient || isClosed) return;
    setSaving(true);
    try {
      await clinicalApi.updatePatient(
        patient.id,
        { medicalBackgrounds: historyToBackgrounds(history) },
        token,
      );
      notify.success("Historial médico guardado");
    } catch (err) {
      notify.error(
        "Error guardando historial",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveOdontogram() {
    if (isClosed) return;
    setSaving(true);
    try {
      let currentId = odontogramId?.trim() || null;
      if (!currentId) {
        const created = await clinicalApi.createOdontogram(
          { doctorId, patientId },
          token,
        );
        currentId = created.id?.trim() || null;
        if (!currentId)
          throw new Error(
            "El servidor no devolvió un ID de odontograma válido",
          );
        setOdontogramId(currentId);
      }
      await clinicalApi.updateOdontogramTeeth(
        currentId,
        toothStates,
        token,
        serializeToothState as unknown as (
          n: number,
          s: unknown,
        ) => {
          toothNumber: number;
          isPresent: boolean;
          surfaces: unknown[];
          generalNotes?: string;
        },
      );
      notify.success("Odontograma guardado");
    } catch (err) {
      notify.error(
        "Error guardando odontograma",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  }

  async function compressImage(
    file: File,
    maxWidthPx = 1200,
    qualityJpeg = 0.82,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxWidthPx / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("compression failed")),
          "image/jpeg",
          qualityJpeg,
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function uploadImages(files: FileList) {
    const MAX_MB = 8;
    const newKeys: string[] = [];
    const newUrls: string[] = [];
    setUploadingImages(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          notify.error("Archivo no válido", `${file.name} no es una imagen.`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          notify.error(
            "Imagen muy grande",
            `${file.name} supera ${MAX_MB}MB. Se comprimirá automáticamente.`,
          );
        }
        const compressed = await compressImage(file);
        const { uploadUrl, key, imageUrl } =
          await clinicalApi.getAppointmentUploadUrl(
            appointmentId,
            file.name,
            "image/jpeg",
            token,
          );
        await fetch(uploadUrl, {
          method: "PUT",
          body: compressed,
          headers: { "Content-Type": "image/jpeg" },
        });
        newKeys.push(key);
        newUrls.push(imageUrl);
      }
      if (newKeys.length > 0) {
        await clinicalApi.updateAppointment(
          appointmentId,
          { imageKeys: newKeys },
          token,
        );
        setImageUrls((prev) => [...prev, ...newUrls]);
        notify.success(
          `${newKeys.length} imagen${newKeys.length > 1 ? "es" : ""} guardada${newKeys.length > 1 ? "s" : ""}`,
        );
      }
    } catch (err) {
      notify.error(
        "Error subiendo imagen",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setUploadingImages(false);
    }
  }

  async function finalizarConsulta() {
    if (!evolutionNotes.trim()) {
      notify.error(
        "Notas requeridas",
        "Agrega notas de evolución antes de finalizar.",
      );
      return;
    }
    if (isClosed) return;
    setSaving(true);
    try {
      await clinicalApi.closeAppointmentDay(
        appointmentId,
        {
          evolutionNotes,
          paymentAmount,
          paymentMethod: "",
          treatmentPlan,
        },
        token,
      );
      notify.success("Consulta finalizada correctamente");
      navigate("/dashboard/citas");
    } catch (err) {
      notify.error(
        "Error finalizando consulta",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="consulta-loading">
        <div className="auth-spinner" />
        <p>Cargando expediente del paciente...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="consulta-loading">
        <p>No se pudo cargar el paciente.</p>
        <button
          className="action-btn"
          onClick={() => navigate("/dashboard/citas")}
        >
          Volver
        </button>
      </div>
    );
  }

  const age = patient.birthDate
    ? Math.floor(
        (Date.now() - new Date(patient.birthDate).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
    : null;

  const apptDateLabel = appointmentDate
    ? new Date(appointmentDate).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="consulta-page">
      {/* Header del paciente */}
      <div className="consulta-header">
        <button
          className="consulta-back-btn"
          onClick={() => navigate("/dashboard/citas")}
        >
          ← Volver a Agenda
        </button>
        <div className="consulta-patient-card">
          <div className="consulta-avatar">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div className="consulta-patient-info">
            <h2>
              {patient.firstName} {patient.lastName}
            </h2>
            <div className="consulta-patient-meta">
              {patient.documentId && <span>🪪 {patient.documentId}</span>}
              {age !== null && <span>🎂 {age} años</span>}
              {patient.phone && <span>📞 {patient.phone}</span>}
              {patient.email && <span>✉️ {patient.email}</span>}
            </div>
          </div>
          <div className="consulta-appointment-badge">
            {isClosed ? (
              <span className="badge status-completed">
                ✓ Consulta finalizada
              </span>
            ) : (
              <span className="badge status-confirmed">Consulta en curso</span>
            )}
            {apptDateLabel && (
              <small style={{ color: "#64748b", fontSize: "0.72rem" }}>
                {apptDateLabel}
              </small>
            )}
            <button
              className="btn-patient-history"
              onClick={() => navigate(`/dashboard/pacientes/${patientId}`)}
            >
              <FileText size={15} />
              Ver ficha completa
            </button>
          </div>
        </div>
      </div>

      {/* Banner de consulta cerrada */}
      {isClosed && (
        <div className="consulta-closed-banner">
          🔒 Esta consulta ya fue finalizada y no puede modificarse. Solo
          lectura.
        </div>
      )}

      {/* Tabs */}
      <div className="consulta-tabs">
        <button
          className={`consulta-tab ${activeTab === "historia" ? "active" : ""}`}
          onClick={() => setActiveTab("historia")}
        >
          📋 Historial Médico
        </button>
        <button
          className={`consulta-tab ${activeTab === "odontograma" ? "active" : ""}`}
          onClick={() => setActiveTab("odontograma")}
        >
          🦷 Odontograma
        </button>
        <button
          className={`consulta-tab ${activeTab === "evolucion" ? "active" : ""}`}
          onClick={() => setActiveTab("evolucion")}
        >
          📝 Consulta{" "}
          {imageUrls.length > 0 && (
            <span className="tab-count">{imageUrls.length}</span>
          )}
        </button>
      </div>

      {/* Tab: Historial Médico */}
      {activeTab === "historia" && (
        <div className="consulta-section card elite-card">
          <div className="consulta-section-header">
            <h3>Historial Médico</h3>
            <span className="consulta-hint" style={{ margin: 0 }}>
              {isClosed
                ? "Solo lectura — consulta finalizada"
                : "Antecedentes permanentes del paciente"}
            </span>
          </div>

          <div className="historia-grid">
            <div className="historia-field-group">
              <div className="historia-check-field">
                <label className="historia-check-label">
                  <input
                    type="checkbox"
                    checked={history.takeMedication}
                    disabled={isClosed}
                    onChange={(e) =>
                      setHistory((h) => ({
                        ...h,
                        takeMedication: e.target.checked,
                      }))
                    }
                  />
                  <span>¿Toma algún medicamento?</span>
                </label>
                {history.takeMedication && (
                  <input
                    className="historia-detail-input"
                    placeholder="¿Cuál(es)?"
                    value={history.medicationDetail}
                    disabled={isClosed}
                    onChange={(e) =>
                      setHistory((h) => ({
                        ...h,
                        medicationDetail: e.target.value,
                      }))
                    }
                  />
                )}
              </div>

              <div className="historia-check-field">
                <label className="historia-check-label">
                  <input
                    type="checkbox"
                    checked={history.allergyMed}
                    disabled={isClosed}
                    onChange={(e) =>
                      setHistory((h) => ({
                        ...h,
                        allergyMed: e.target.checked,
                      }))
                    }
                  />
                  <span>¿Alergia a algún medicamento?</span>
                </label>
                {history.allergyMed && (
                  <input
                    className="historia-detail-input"
                    placeholder="¿A cuál(es)?"
                    value={history.allergyMedDetail}
                    disabled={isClosed}
                    onChange={(e) =>
                      setHistory((h) => ({
                        ...h,
                        allergyMedDetail: e.target.value,
                      }))
                    }
                  />
                )}
              </div>

              <div className="historia-check-field">
                <label className="historia-check-label">
                  <input
                    type="checkbox"
                    checked={history.allergies}
                    disabled={isClosed}
                    onChange={(e) =>
                      setHistory((h) => ({ ...h, allergies: e.target.checked }))
                    }
                  />
                  <span>Alergias generales</span>
                </label>
                {history.allergies && (
                  <input
                    className="historia-detail-input"
                    placeholder="Especificar..."
                    value={history.allergiesDetail}
                    disabled={isClosed}
                    onChange={(e) =>
                      setHistory((h) => ({
                        ...h,
                        allergiesDetail: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            </div>

            <div className="historia-pathologies">
              <p className="historia-subtitle">
                Antecedentes patológicos / familiares
              </p>
              <div className="antecedentes-grid">
                {/* Columna Personales */}
                <div className="antecedentes-col">
                  <p className="antecedentes-col-title">Personales</p>
                  {(
                    [
                      ["anemia", "Anemia"],
                      ["hepatitis", "Hepatitis"],
                      ["diabetes", "Diabetes"],
                      ["hypertension", "Hipertensión"],
                      ["cholesterol", "Colesterol"],
                      ["cancer", "Cáncer"],
                    ] as [keyof MedicalHistory, string][]
                  ).map(([key, label]) => {
                    const entry = history[key] as PathologyEntry;
                    return (
                      <div key={key} className="pathology-chip-group">
                        <button
                          type="button"
                          className={`pathology-chip ${entry.active ? "active" : ""} ${isClosed ? "disabled" : ""}`}
                          onClick={() => {
                            if (isClosed) return;
                            setHistory((h) => ({
                              ...h,
                              [key]: { ...entry, active: !entry.active },
                            }));
                          }}
                        >
                          {label}
                        </button>
                        {entry.active && (
                          <input
                            className="pathology-detail-input"
                            type="text"
                            placeholder="Observación..."
                            value={entry.detail}
                            disabled={isClosed}
                            onChange={(e) =>
                              setHistory((h) => ({
                                ...h,
                                [key]: { ...entry, detail: e.target.value },
                              }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Columna Familiares */}
                <div className="antecedentes-col">
                  <p className="antecedentes-col-title">Familiares</p>
                  {(
                    [
                      ["anemiaFamily", "Anemia"],
                      ["hepatitisFamily", "Hepatitis"],
                      ["diabetesFamily", "Diabetes"],
                      ["hypertensionFamily", "Hipertensión"],
                      ["cholesterolFamily", "Colesterol"],
                      ["cancerFamily", "Cáncer"],
                    ] as [keyof MedicalHistory, string][]
                  ).map(([key, label]) => {
                    const entry = history[key] as PathologyEntry;
                    return (
                      <div key={key} className="pathology-chip-group">
                        <button
                          type="button"
                          className={`pathology-chip ${entry.active ? "active" : ""} ${isClosed ? "disabled" : ""}`}
                          onClick={() => {
                            if (isClosed) return;
                            setHistory((h) => ({
                              ...h,
                              [key]: { ...entry, active: !entry.active },
                            }));
                          }}
                        >
                          {label}
                        </button>
                        {entry.active && (
                          <input
                            className="pathology-detail-input"
                            type="text"
                            placeholder="Observación..."
                            value={entry.detail}
                            disabled={isClosed}
                            onChange={(e) =>
                              setHistory((h) => ({
                                ...h,
                                [key]: { ...entry, detail: e.target.value },
                              }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="historia-other">
            <label>Otra patología / Observaciones</label>
            <textarea
              className="historia-textarea"
              placeholder="Describa otras condiciones relevantes..."
              value={history.otherNotes}
              rows={3}
              disabled={isClosed}
              onChange={(e) =>
                setHistory((h) => ({ ...h, otherNotes: e.target.value }))
              }
            />
          </div>

          {!isClosed && (
            <div className="consulta-actions">
              <button
                className="action-btn action-btn-confirm"
                onClick={saveHistoria}
                disabled={saving}
              >
                💾 Guardar Historial
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Odontograma */}
      {activeTab === "odontograma" && (
        <div className="consulta-section card elite-card">
          <div className="consulta-section-header">
            <h3>Odontograma Dental</h3>
            <div className="odn-legend-grid">
              <span className="odn-legend-item">
                <span
                  className="odn-legend-swatch"
                  style={{ background: "#fff" }}
                />{" "}
                Sano
              </span>
              <span className="odn-legend-item">
                <span
                  className="odn-legend-swatch"
                  style={{ background: "#ef4444" }}
                />{" "}
                Caries
              </span>
              <span className="odn-legend-item">
                <span
                  className="odn-legend-swatch"
                  style={{ background: "#3b82f6" }}
                />{" "}
                Restauración
              </span>
              <span className="odn-legend-item">
                <span
                  className="odn-legend-swatch"
                  style={{ background: "#ef4444", border: "2px solid #dc2626" }}
                />{" "}
                Indicado
              </span>
              <span className="odn-legend-item">
                <span
                  className="odn-legend-swatch"
                  style={{ background: "#2563eb" }}
                />{" "}
                Realizado
              </span>
              <span className="odn-legend-item">
                <span
                  className="odn-legend-swatch"
                  style={{ background: "#94a3b8" }}
                />{" "}
                Ausente
              </span>
            </div>
          </div>
          <p className="consulta-hint">
            {isClosed
              ? "Solo lectura — el odontograma de esta consulta no puede modificarse."
              : "Haz clic en una superficie del diente para abrir el menú de condiciones."}
          </p>

          <OdontogramChart
            toothStates={toothStates}
            onSurfaceChange={isClosed ? undefined : handleSurfaceChange}
            onToothConditionChange={
              isClosed ? undefined : handleToothConditionChange
            }
            onResetTooth={isClosed ? undefined : handleResetTooth}
            readOnly={isClosed}
            patientAge={age}
          />

          {!isClosed && (
            <div className="consulta-actions" style={{ marginTop: 24 }}>
              <button
                className="action-btn action-btn-confirm"
                onClick={saveOdontogram}
                disabled={saving}
              >
                💾 Guardar Odontograma
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Consulta (Evolución + Imágenes + Cierre) */}
      {activeTab === "evolucion" && (
        <div className="consulta-section card elite-card">
          <div className="consulta-section-header">
            <h3>Consulta</h3>
            {apptDateLabel && (
              <span className="consulta-hint" style={{ margin: 0 }}>
                📅 {apptDateLabel}
              </span>
            )}
          </div>

          {/* Imágenes de la consulta */}
          <div className="consulta-images-block">
            <h4 className="consulta-subheading">Imágenes</h4>
            {!isClosed && (
              <label className="image-upload-zone">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  style={{ display: "none" }}
                  disabled={uploadingImages}
                  onChange={(e) =>
                    e.target.files && uploadImages(e.target.files)
                  }
                />
                {uploadingImages ? (
                  <div className="image-upload-uploading">
                    <span
                      className="auth-spinner"
                      style={{ margin: "0 auto" }}
                    />
                    <p>Comprimiendo y subiendo...</p>
                  </div>
                ) : (
                  <div className="image-upload-prompt">
                    <span style={{ fontSize: "2rem" }}>📷</span>
                    <p>
                      <strong>Haz clic o arrastra imágenes aquí</strong>
                    </p>
                    <small>
                      JPEG · PNG · WebP · máx. 8MB · se comprimen
                      automáticamente
                    </small>
                  </div>
                )}
              </label>
            )}
            {imageUrls.length === 0 && !uploadingImages && (
              <div className="image-empty">
                <span style={{ fontSize: "1.5rem" }}>🖼️</span>
                <p>Sin imágenes registradas</p>
              </div>
            )}
            {imageUrls.length > 0 && (
              <div className="image-gallery">
                {imageUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="image-thumb-link"
                  >
                    <img
                      src={url}
                      alt={`Imagen ${i + 1}`}
                      className="image-thumb"
                    />
                    <span className="image-thumb-label">Ver original</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="evolucion-grid">
            <div className="input-group">
              <label>
                Notas de evolución{" "}
                {!isClosed && <span className="required">*</span>}
              </label>
              <textarea
                className="historia-textarea evolucion-textarea"
                placeholder="Describe el motivo de consulta, hallazgos clínicos, procedimientos realizados y observaciones..."
                value={evolutionNotes}
                rows={6}
                disabled={isClosed}
                onChange={(e) => setEvolutionNotes(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Plan de tratamiento para esta consulta</label>
              <textarea
                className="historia-textarea"
                placeholder="Indica el plan de tratamiento acordado con el paciente para próximas visitas..."
                value={treatmentPlan}
                rows={4}
                disabled={isClosed}
                onChange={(e) => setTreatmentPlan(e.target.value)}
              />
            </div>
          </div>

          <div className="pago-section">
            <h4>Monto de la Consulta</h4>
            <div className="pago-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="input-group">
                <label>Valor cobrado</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={paymentAmount}
                  disabled={isClosed}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="elite-input"
                  placeholder="0.00"
                />
                {!isClosed && (
                  <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                    El método de pago y confirmación se registran desde la
                    agenda después de finalizar.
                  </small>
                )}
              </div>
            </div>
          </div>

          <div className="consulta-actions finalizar-actions">
            {isClosed ? (
              <div className="consulta-closed-note">
                ✓ Consulta finalizada — registro guardado
              </div>
            ) : (
              <>
                <button
                  className="action-btn action-btn-treat finalizar-btn"
                  onClick={finalizarConsulta}
                  disabled={saving || !evolutionNotes.trim()}
                >
                  {saving ? (
                    <>
                      <span className="auth-spinner" /> Guardando...
                    </>
                  ) : (
                    "✅ Finalizar Consulta"
                  )}
                </button>
                <button
                  className="action-btn"
                  onClick={() => navigate("/dashboard/citas")}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
