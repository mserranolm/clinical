import "./docco.css";

export function DoccoBubble({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      className={`docco-bubble${isOpen ? " docco-bubble--open" : ""}`}
      onClick={onClick}
      aria-label={isOpen ? "Cerrar Docco" : "Abrir Docco — Asistente Clínico"}
      title={isOpen ? "Cerrar Docco" : "Docco — Asistente Clínico Virtual"}
    >
      {isOpen ? (
        <span style={{ fontSize: 22, lineHeight: 1 }}>✕</span>
      ) : (
        <span style={{ fontSize: 26, lineHeight: 1 }}>🦷</span>
      )}
    </button>
  );
}
