import { useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { ChatMessage } from "../../types";
import type { DoccoMessage } from "./docco-types";

const WELCOME_MESSAGE: DoccoMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "¡Hola! Soy Docco, tu asistente clínico virtual. Puedo ayudarte con:\n• Consultar tus citas de hoy y la semana\n• Buscar información de pacientes\n• Ver pagos y presupuestos pendientes\n• Resumen de tu agenda\n\n¿En qué puedo ayudarte?",
  timestamp: new Date(),
};

export function useDoccoChat(token: string) {
  const [messages, setMessages] = useState<DoccoMessage[]>([WELCOME_MESSAGE]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function toggleChat() {
    setIsOpen(o => !o);
  }

  function clearChat() {
    setMessages([WELCOME_MESSAGE]);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMsg: DoccoMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Build history for the API (exclude the welcome message, only real turns)
    const history: ChatMessage[] = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await clinicalApi.chat(text.trim(), history, token);
      const assistantMsg: DoccoMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        timestamp: new Date(res.timestamp),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: DoccoMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Lo siento, hubo un problema al procesar tu consulta. Por favor intenta de nuevo.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  return { messages, isOpen, isLoading, toggleChat, clearChat, sendMessage };
}
