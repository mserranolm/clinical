import { useCallback, useEffect, useRef, useState } from "react";
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

// ─── Helpers SOAP ────────────────────────────────────────────────────────────

type SoapParts = { S: string; O: string; A: string; P: string };

function parseSoap(raw: string): SoapParts {
  if (!raw.trimStart().startsWith("S:")) {
    return { S: raw, O: "", A: "", P: "" };
  }
  const result: SoapParts = { S: "", O: "", A: "", P: "" };
  const regex = /([SOAP]):\s*([\s\S]*?)(?=\n[SOAP]:|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const key = match[1] as keyof SoapParts;
    result[key] = match[2].trim();
  }
  return result;
}

function serializeSoap(parts: SoapParts): string {
  return `S: ${parts.S}\nO: ${parts.O}\nA: ${parts.A}\nP: ${parts.P}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ConsultaPageProps = { token: string; doctorId: string };

// ─── Component ───────────────────────────────────────────────────────────────

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
    "historia" | "odontograma" | "evolucion" | "documentos"
  >("evolucion");
  const [appointmentStatus, setAppointmentStatus] =
    useState<string>("scheduled");
  const [appointmentDate, setAppointmentDate] = useState<string>("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // ── New UI state ──────────────────────────────────────────────────────────
  const [vitals, setVitals] = useState({
    pa: "",
    fc: "",
    sat: "",
    temp: "",
    peso: "",
    glu: "",
  });
  const [soapTab, setSoapTab] = useState<"S" | "O" | "A" | "P">("S");
  const [paymentMethod, setPaymentMethod] = useState<
    "tarjeta" | "efectivo" | "transferencia" | "mixto"
  >("efectivo");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isClosed = appointmentStatus === "completed";
  const isInProgress = appointmentStatus === "in_progress";

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isInProgress && appointmentDate) {
      const start = new Date(appointmentDate).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isInProgress, appointmentDate]);

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

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 12,
          color: "#64748b",
        }}
      >
        <div className="auth-spinner" />
        <p>Cargando expediente del paciente...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 12,
        }}
      >
        <p style={{ color: "#64748b" }}>No se pudo cargar el paciente.</p>
        <button
          className="action-btn"
          onClick={() => navigate("/dashboard/citas")}
        >
          Volver
        </button>
      </div>
    );
  }

  // ─── Derived values ───────────────────────────────────────────────────────

  const age = patient.birthDate
    ? Math.floor(
        (Date.now() - new Date(patient.birthDate).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
    : null;

  const initials = (patient.firstName[0] ?? "") + (patient.lastName[0] ?? "");

  const elapsedLabel = (() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  // SOAP helpers
  const soapParts = parseSoap(evolutionNotes);

  function handleSoapChange(value: string) {
    const updated = { ...soapParts, [soapTab]: value };
    setEvolutionNotes(serializeSoap(updated));
  }

  // Medication list from detail
  const medicationList = history.medicationDetail
    ? history.medicationDetail
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Alerts derived from history
  type Alert = { label: string; detail: string };
  const alerts: Alert[] = [];
  if (history.allergyMed && history.allergyMedDetail)
    alerts.push({
      label: "Alergia medicamento",
      detail: history.allergyMedDetail,
    });
  if (history.allergies && history.allergiesDetail)
    alerts.push({ label: "Alergia general", detail: history.allergiesDetail });
  if (history.diabetes.active)
    alerts.push({
      label: "Diabetes",
      detail: history.diabetes.detail || "activa",
    });
  if (history.hypertension.active)
    alerts.push({
      label: "Hipertensión",
      detail: history.hypertension.detail || "activa",
    });

  const isEvolucionTab = activeTab === "evolucion";

  // ─── Paleta ───────────────────────────────────────────────────────────────
  const teal = "#0D9488";
  const tealDark = "#0F766E";
  const tealLight = "#F0FDFA";
  const tealMid = "#CCFBF1";
  const panelBg = "#FAFBFC";
  const border = "1px solid #F1F5F9";

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#F8FAFC",
        fontFamily: "inherit",
      }}
    >
      {/* ── HEADER TOPBAR ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderBottom: border,
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {/* Botón volver */}
        <button
          onClick={() => navigate("/dashboard/citas")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
            color: "#475569",
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          ← Agenda
        </button>

        {/* Avatar */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: teal,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Info paciente */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>
              {patient.firstName} {patient.lastName}
            </span>
            <span style={{ color: "#94A3B8", fontSize: 13 }}>
              — · {age !== null ? `${age} años` : "—"}
            </span>
            {patient.documentId && (
              <span style={{ color: "#64748B", fontSize: 12 }}>
                CC: {patient.documentId}
              </span>
            )}
            {/* Badge alergia */}
            {history.allergies && history.allergiesDetail && (
              <span
                style={{
                  background: "#FEF2F2",
                  color: "#DC2626",
                  border: "1px solid #FECACA",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Alergia: {history.allergiesDetail}
              </span>
            )}
          </div>
        </div>

        {/* Timer + Finalizar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {isInProgress && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: tealLight,
                border: `1px solid ${tealMid}`,
                borderRadius: 8,
                padding: "5px 10px",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: teal,
                  display: "inline-block",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span style={{ fontSize: 12, color: tealDark, fontWeight: 600 }}>
                EN CURSO
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "#0F766E",
                  fontFamily: "monospace",
                }}
              >
                {elapsedLabel}
              </span>
            </div>
          )}

          <button
            onClick={() =>
              navigate(`/dashboard/pacientes/${patientId}?tab=historial`)
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "none",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              color: "#475569",
              fontSize: 12,
            }}
          >
            <FileText size={13} />
            Historial
          </button>

          {!isClosed && (
            <button
              onClick={finalizarConsulta}
              disabled={saving || !evolutionNotes.trim()}
              style={{
                background: saving || !evolutionNotes.trim() ? "#94A3B8" : teal,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "7px 16px",
                cursor:
                  saving || !evolutionNotes.trim() ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? "Guardando..." : "Finalizar"}
            </button>
          )}
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderBottom: border,
          padding: "0 20px",
          display: "flex",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {(
          [
            { key: "historia", label: "Historial" },
            { key: "odontograma", label: "Odontograma" },
            { key: "evolucion", label: "Consulta" },
          ] as { key: typeof activeTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom:
                activeTab === key
                  ? `2px solid ${teal}`
                  : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? teal : "#64748B",
              transition: "color 0.15s",
            }}
          >
            {label}
            {key === "evolucion" && imageUrls.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: teal,
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {imageUrls.length}
              </span>
            )}
          </button>
        ))}

        {/* Presupuesto — navegación directa */}
        <button
          onClick={() =>
            navigate(`/dashboard/pacientes/${patientId}/presupuesto`)
          }
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: "2px solid transparent",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 400,
            color: "#64748B",
          }}
        >
          Presupuesto
        </button>

        {/* Documentos */}
        <button
          onClick={() => setActiveTab("documentos")}
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom:
              activeTab === "documentos"
                ? `2px solid ${teal}`
                : "2px solid transparent",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: activeTab === "documentos" ? 600 : 400,
            color: activeTab === "documentos" ? teal : "#64748B",
          }}
        >
          Documentos
        </button>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {/* ── TAB: HISTORIAL (pantalla completa) ─────────────────────────── */}
        {activeTab === "historia" && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 24,
            }}
          >
            {isClosed && (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 8,
                  padding: "10px 16px",
                  marginBottom: 16,
                  color: "#15803D",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Consulta finalizada — solo lectura
              </div>
            )}

            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, color: "#0F172A" }}>
                  Historial Médico
                </h3>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>
                  {isClosed
                    ? "Solo lectura"
                    : "Antecedentes permanentes / familiares"}
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
                          setHistory((h) => ({
                            ...h,
                            allergies: e.target.checked,
                          }))
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

              <div className="historia-other" style={{ marginTop: 20 }}>
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 20,
                  }}
                >
                  <button
                    className="action-btn action-btn-confirm"
                    onClick={saveHistoria}
                    disabled={saving}
                  >
                    Guardar Historial
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ODONTOGRAMA (pantalla completa) ───────────────────────── */}
        {activeTab === "odontograma" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {isClosed && (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 8,
                  padding: "10px 16px",
                  marginBottom: 16,
                  color: "#15803D",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Consulta finalizada — solo lectura
              </div>
            )}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, color: "#0F172A" }}>
                  Odontograma Dental
                </h3>
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
                      style={{
                        background: "#ef4444",
                        border: "2px solid #dc2626",
                      }}
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 24,
                  }}
                >
                  <button
                    className="action-btn action-btn-confirm"
                    onClick={saveOdontogram}
                    disabled={saving}
                  >
                    Guardar Odontograma
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: DOCUMENTOS (pantalla completa) ────────────────────────── */}
        {activeTab === "documentos" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94A3B8",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>📄</span>
            <p style={{ fontSize: 15, fontWeight: 500 }}>Documentos</p>
            <p style={{ fontSize: 13 }}>Proximamente</p>
          </div>
        )}

        {/* ── TAB: CONSULTA — 3 columnas ─────────────────────────────────── */}
        {isEvolucionTab && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* ── COLUMNA IZQUIERDA ─────────────────────────────────────── */}
            <div
              style={{
                width: 240,
                flexShrink: 0,
                background: panelBg,
                borderRight: border,
                overflowY: "auto",
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Signos vitales */}
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 8px 0",
                  }}
                >
                  Signos vitales
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      ["pa", "PA", "mmHg"],
                      ["fc", "FC", "bpm"],
                      ["sat", "SAT", "%"],
                      ["temp", "TEMP", "°C"],
                      ["peso", "PESO", "kg"],
                      ["glu", "GLU", "mg/dl"],
                    ] as [keyof typeof vitals, string, string][]
                  ).map(([field, label, unit]) => (
                    <div
                      key={field}
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid #F1F5F9",
                        borderRadius: 8,
                        padding: "6px 8px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          color: "#94A3B8",
                          margin: 0,
                          marginBottom: 2,
                        }}
                      >
                        {label} <span style={{ color: "#CBD5E1" }}>{unit}</span>
                      </p>
                      <input
                        value={vitals[field]}
                        onChange={(e) =>
                          setVitals((v) => ({ ...v, [field]: e.target.value }))
                        }
                        disabled={isClosed}
                        placeholder="—"
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0F172A",
                          outline: "none",
                          padding: 0,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertas */}
              {alerts.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#DC2626",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      margin: "0 0 6px 0",
                    }}
                  >
                    Alertas
                  </p>
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: 8,
                      padding: "8px 10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {alerts.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#B91C1C" }}>
                        <strong>{a.label}</strong>
                        {a.detail && (
                          <span style={{ color: "#DC2626" }}>
                            {" "}
                            · {a.detail}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medicación activa */}
              {history.takeMedication && medicationList.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      margin: "0 0 6px 0",
                    }}
                  >
                    Medicación activa
                  </p>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {medicationList.map((med, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 12,
                          color: "#1E40AF",
                        }}
                      >
                        {med} · 1-0-1
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visitas recientes */}
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 6px 0",
                  }}
                >
                  Visitas recientes
                </p>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
                  Cargando...
                </p>
              </div>
            </div>

            {/* ── COLUMNA CENTRAL ───────────────────────────────────────── */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Banner consulta cerrada */}
              {isClosed && (
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: "10px 16px",
                    color: "#15803D",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Consulta finalizada — registro guardado. Solo lectura.
                </div>
              )}

              {/* Notas SOAP */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  border,
                  padding: 16,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "#0F172A",
                      }}
                    >
                      Notas de evolución
                    </span>
                    <span
                      style={{
                        background: tealLight,
                        color: teal,
                        border: `1px solid ${tealMid}`,
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                      }}
                    >
                      SOAP
                    </span>
                  </div>
                  <button
                    style={{
                      fontSize: 12,
                      color: "#64748B",
                      background: "#F8FAFC",
                      border,
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Plantilla
                  </button>
                </div>

                {/* SOAP tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {(["S", "O", "A", "P"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSoapTab(tab)}
                      style={{
                        padding: "5px 14px",
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: soapTab === tab ? teal : "#E2E8F0",
                        background: soapTab === tab ? teal : "#fff",
                        color: soapTab === tab ? "#fff" : "#475569",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <textarea
                  value={soapParts[soapTab]}
                  onChange={(e) => handleSoapChange(e.target.value)}
                  disabled={isClosed}
                  rows={6}
                  placeholder={
                    soapTab === "S"
                      ? "Subjetivo: motivo de consulta, síntomas del paciente..."
                      : soapTab === "O"
                        ? "Objetivo: hallazgos clínicos, signos vitales, examen físico..."
                        : soapTab === "A"
                          ? "Análisis / diagnóstico..."
                          : "Plan: tratamiento indicado, indicaciones, próxima cita..."
                  }
                  style={{
                    width: "100%",
                    resize: "vertical",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "#0F172A",
                    background: isClosed ? "#F8FAFC" : "#fff",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Plan de tratamiento */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  border,
                  padding: 16,
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#0F172A",
                    marginBottom: 8,
                  }}
                >
                  Plan de tratamiento
                </label>
                <textarea
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  disabled={isClosed}
                  rows={4}
                  placeholder="Indica el plan de tratamiento acordado con el paciente para próximas visitas..."
                  style={{
                    width: "100%",
                    resize: "vertical",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "#0F172A",
                    background: isClosed ? "#F8FAFC" : "#fff",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Procedimientos sesión */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  border,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, fontSize: 14, color: "#0F172A" }}
                  >
                    Procedimientos sesión
                  </span>
                  <button
                    style={{
                      fontSize: 12,
                      color: teal,
                      background: tealLight,
                      border: `1px solid ${tealMid}`,
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    + Añadir
                  </button>
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      {[
                        "PIEZA",
                        "PROCEDIMIENTO",
                        "CARA",
                        "MATERIAL",
                        "COSTO",
                      ].map((col) => (
                        <th
                          key={col}
                          style={{
                            textAlign: "left",
                            padding: "4px 8px",
                            color: "#94A3B8",
                            fontWeight: 600,
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ color: "#64748B" }}>
                      <td style={{ padding: "6px 8px" }}>—</td>
                      <td style={{ padding: "6px 8px" }}>Anestesia local</td>
                      <td style={{ padding: "6px 8px" }}>—</td>
                      <td style={{ padding: "6px 8px" }}>Lidocaína 2%</td>
                      <td style={{ padding: "6px 8px" }}>$0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Imágenes */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  border,
                  padding: 16,
                }}
              >
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  Imágenes
                </h4>
                {!isClosed && (
                  <label
                    style={{
                      display: "block",
                      border: "2px dashed #E2E8F0",
                      borderRadius: 8,
                      padding: 16,
                      textAlign: "center",
                      cursor: "pointer",
                      marginBottom: 12,
                      background: "#FAFBFC",
                    }}
                  >
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
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          className="auth-spinner"
                          style={{ margin: "0 auto" }}
                        />
                        <p
                          style={{ margin: 0, fontSize: 12, color: "#64748B" }}
                        >
                          Comprimiendo y subiendo...
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 24 }}>📷</span>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: "#475569",
                            fontWeight: 500,
                          }}
                        >
                          Haz clic o arrastra imágenes aquí
                        </p>
                        <small style={{ color: "#94A3B8", fontSize: 11 }}>
                          JPEG · PNG · WebP · máx. 8MB
                        </small>
                      </div>
                    )}
                  </label>
                )}
                {imageUrls.length === 0 && !uploadingImages && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#94A3B8",
                      padding: "8px 0",
                      fontSize: 13,
                    }}
                  >
                    Sin imágenes registradas
                  </div>
                )}
                {imageUrls.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(80px, 1fr))",
                      gap: 8,
                    }}
                  >
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
                          style={{
                            width: "100%",
                            borderRadius: 6,
                            objectFit: "cover",
                            aspectRatio: "1",
                          }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMNA DERECHA ───────────────────────────────────────── */}
            <div
              style={{
                width: 260,
                flexShrink: 0,
                background: panelBg,
                borderLeft: border,
                overflowY: "auto",
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Cobro sesión */}
              <div
                style={{
                  background: "#fff",
                  border,
                  borderRadius: 10,
                  padding: "14px 14px 16px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 10px 0",
                  }}
                >
                  Cobro · sesión
                </p>

                {/* Monto */}
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  {!isClosed ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: teal,
                        border: "none",
                        background: "transparent",
                        textAlign: "center",
                        width: "100%",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: teal,
                      }}
                    >
                      ${paymentAmount}
                    </span>
                  )}
                </div>

                {/* Método de pago */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {(
                    [
                      ["tarjeta", "Tarjeta"],
                      ["efectivo", "Efectivo"],
                      ["transferencia", "Transf."],
                      ["mixto", "Mixto"],
                    ] as [typeof paymentMethod, string][]
                  ).map(([method, label]) => (
                    <button
                      key={method}
                      onClick={() => !isClosed && setPaymentMethod(method)}
                      style={{
                        padding: "6px 0",
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor:
                          paymentMethod === method ? teal : "#E2E8F0",
                        background:
                          paymentMethod === method ? tealLight : "#fff",
                        color: paymentMethod === method ? teal : "#64748B",
                        fontSize: 12,
                        fontWeight: paymentMethod === method ? 600 : 400,
                        cursor: isClosed ? "default" : "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {!isClosed && (
                  <button
                    style={{
                      width: "100%",
                      background: teal,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "9px 0",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Cobrar ${paymentAmount}
                  </button>
                )}
              </div>

              {/* Próxima cita */}
              <div
                style={{
                  background: "#fff",
                  border,
                  borderRadius: 10,
                  padding: "14px 14px 16px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 10px 0",
                  }}
                >
                  Proxima cita
                </p>

                {/* Quick chips */}
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  {["Mañana", "+1 sem", "+2 sem", "+1 mes"].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        padding: "4px 8px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: 6,
                        fontSize: 11,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <input
                  type="date"
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12,
                    color: "#0F172A",
                    marginBottom: 6,
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="time"
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12,
                    color: "#0F172A",
                    marginBottom: 10,
                    boxSizing: "border-box",
                  }}
                />

                <button
                  style={{
                    width: "100%",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "8px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  + Agendar
                </button>
              </div>

              {/* Acciones rápidas */}
              <div
                style={{
                  background: "#fff",
                  border,
                  borderRadius: 10,
                  padding: "14px 14px 12px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 10px 0",
                  }}
                >
                  Acciones rapidas
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {[
                    {
                      icon: "💊",
                      label: "Generar receta médica",
                      action: () => {},
                    },
                    {
                      icon: "📋",
                      label: "Crear presupuesto",
                      action: () =>
                        navigate(
                          `/dashboard/pacientes/${patientId}/presupuesto`,
                        ),
                    },
                    {
                      icon: "✍️",
                      label: "Enviar consentimiento",
                      action: () => {},
                    },
                    { icon: "🖨️", label: "Imprimir resumen", action: () => {} },
                  ].map(({ icon, label, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 8px",
                        background: "none",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 12,
                        color: "#374151",
                        width: "100%",
                      }}
                      onMouseEnter={(e) =>
                        ((
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#F8FAFC")
                      }
                      onMouseLeave={(e) =>
                        ((
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "none")
                      }
                    >
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
