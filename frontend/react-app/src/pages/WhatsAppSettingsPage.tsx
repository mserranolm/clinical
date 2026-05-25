import { MessageSquare } from "lucide-react";
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
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <MessageSquare size={22} strokeWidth={1.5} />
          <div>
            <h1 className="page-title">WhatsApp Asistente</h1>
            <p className="page-subtitle">
              Conecta el número de WhatsApp de tu clínica y configura la
              información que usará el asistente virtual para responder a tus
              pacientes.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          maxWidth: 720,
        }}
      >
        <WhatsAppConnect token={session.token} />
        <BotModeSelector token={session.token} />
        <KnowledgeBaseEditor token={session.token} />
      </div>
    </div>
  );
}
