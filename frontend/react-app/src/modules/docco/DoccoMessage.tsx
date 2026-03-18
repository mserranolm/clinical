import type { DoccoMessage as DoccoMessageType } from "./docco-types";

function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}

function DoccoAvatar() {
  return (
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
  );
}

export function DoccoMessageItem({ msg }: { msg: DoccoMessageType }) {
  const isUser = msg.role === "user";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: 8,
        alignItems: "flex-end",
        marginBottom: 12,
      }}
    >
      {!isUser && <DoccoAvatar />}
      <div style={{ maxWidth: "75%" }}>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: isUser ? "var(--primary, #0ea5e9)" : "var(--surface-2, #f1f5f9)",
            color: isUser ? "#fff" : "var(--text, #0f172a)",
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.content}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted, #94a3b8)",
            marginTop: 2,
            textAlign: isUser ? "right" : "left",
          }}
        >
          {fmtTime(msg.timestamp)}
        </div>
      </div>
    </div>
  );
}
