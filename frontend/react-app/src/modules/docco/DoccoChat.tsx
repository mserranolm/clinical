import type { AuthSession } from "../../types";
import { DoccoBubble } from "./DoccoBubble";
import { DoccoChatPanel } from "./DoccoChatPanel";
import { useDoccoChat } from "./useDoccoChat";
import "./docco.css";

export function DoccoChat({ session }: { session: AuthSession }) {
  const { messages, isOpen, isLoading, toggleChat, clearChat, sendMessage } = useDoccoChat(
    session.token
  );

  return (
    <div className="docco-root">
      {isOpen && (
        <DoccoChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onClose={toggleChat}
          onClear={clearChat}
        />
      )}
      <DoccoBubble isOpen={isOpen} onClick={toggleChat} />
    </div>
  );
}
