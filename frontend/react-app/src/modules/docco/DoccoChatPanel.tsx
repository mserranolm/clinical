import { useEffect, useRef, useState } from "react";
import type { DoccoMessage } from "./docco-types";
import { DoccoMessageItem } from "./DoccoMessage";
import { DoccoTypingIndicator } from "./DoccoTypingIndicator";
import "./docco.css";

const SUGGESTIONS = [
  "¿Tengo citas hoy?",
  "Resumen de mi semana",
  "Pacientes registrados",
  "Pagos recientes",
];

type Props = {
  messages: DoccoMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  onClear: () => void;
};

export function DoccoChatPanel({ messages, isLoading, onSend, onClose, onClear }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  }

  function handleSuggestion(text: string) {
    if (isLoading) return;
    onSend(text);
  }

  return (
    <div className="docco-panel">
      {/* Header */}
      <div className="docco-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🦷</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Docco</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Asistente Clínico Virtual</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="docco-panel__btn-icon"
            onClick={onClear}
            title="Limpiar conversación"
            aria-label="Limpiar conversación"
          >
            🗑️
          </button>
          <button
            className="docco-panel__btn-icon"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar Docco"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="docco-panel__messages">
        {messages.map(msg => (
          <DoccoMessageItem key={msg.id} msg={msg} />
        ))}
        {isLoading && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--primary, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 14,
              }}
            >
              🦷
            </div>
            <DoccoTypingIndicator />
          </div>
        )}
        {/* Suggestion chips — only shown below welcome */}
        {messages.length === 1 && !isLoading && (
          <div className="docco-suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="docco-chip" onClick={() => handleSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="docco-panel__footer" onSubmit={handleSubmit}>
        <input
          className="docco-panel__input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu pregunta..."
          disabled={isLoading}
          autoComplete="off"
        />
        <button
          type="submit"
          className="docco-panel__send"
          disabled={isLoading || !input.trim()}
          aria-label="Enviar"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
