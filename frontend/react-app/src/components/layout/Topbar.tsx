import React from "react";
import type { AuthSession } from "../../types";

export function Topbar({ session, onLogout, title }: { session: AuthSession; onLogout: () => void; title: string }) {
  return (
    <header className="topbar">
      <div className="topbar-info">
        <h1>{title}</h1>
        <div className="user-badge">
          <div className="user-avatar">{session.name?.[0] || session.email?.[0] || "U"}</div>
          <div className="user-meta">
            <strong>{session.name || "Usuario Médico"}</strong>
            <span>{session.email}</span>
          </div>
        </div>
      </div>
      <button className="ghost logout-trigger-top" onClick={onLogout} style={{ marginLeft: '20px', display: 'none' }}>
        Cerrar sesión
      </button>
    </header>
  );
}
