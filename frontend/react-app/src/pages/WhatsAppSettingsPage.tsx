import { BotModeSelector } from "../modules/whatsapp/BotModeSelector";
import { KnowledgeBaseEditor } from "../modules/whatsapp/KnowledgeBaseEditor";
import { WhatsAppConnect } from "../modules/whatsapp/WhatsAppConnect";
import type { AuthSession } from "../types";

type Props = {
  session: AuthSession;
};

export function WhatsAppSettingsPage({ session }: Props) {
  if (!session.token) return null;

  return (
    <div className="page-container">
      {/* Header */}
      <div
        style={{
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "var(--r-lg)",
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              flexShrink: 0,
              boxShadow: "0 4px 14px rgba(22,163,74,0.3)",
            }}
          >
            💬
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: "0.3rem" }}>
              WhatsApp Asistente
            </h1>
            <p className="page-subtitle" style={{ maxWidth: 520 }}>
              Conecta el número de WhatsApp de tu clínica y configura cómo
              responde el asistente virtual a tus pacientes.
            </p>
          </div>
        </div>
      </div>

      {/* Layout principal: columna izquierda + columna derecha */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "1.5rem",
          alignItems: "start",
          maxWidth: 1100,
        }}
      >
        {/* Columna principal */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <WhatsAppConnect token={session.token} />
          <KnowledgeBaseEditor token={session.token} />
        </div>

        {/* Columna lateral */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            position: "sticky",
            top: "1.5rem",
          }}
        >
          <BotModeSelector token={session.token} />

          {/* Tips de uso */}
          <div
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--r-xl)",
              padding: "1.25rem 1.5rem",
            }}
          >
            <h4
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--accent)",
                marginBottom: "0.75rem",
              }}
            >
              💡 Buenas prácticas
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              {[
                "Empieza en modo Beta con tu número personal para probar.",
                "Detalla los servicios y precios en la base de conocimiento.",
                "El asistente nunca hace diagnósticos — solo agenda citas.",
                "Activa producción cuando hayas validado las respuestas.",
              ].map((tip) => (
                <li
                  key={tip}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      color: "var(--accent)",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    ·
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
