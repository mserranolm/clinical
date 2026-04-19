import { useState, useEffect, createContext, useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getSession, saveSession, clearSession } from "./lib/session";
import { AuthSession } from "./types";
import { isPlatformAdmin } from "./lib/rbac";
import {
  type ThemeMode,
  applyTheme,
  getStoredTheme,
  setStoredTheme,
} from "./lib/theme";

// Layout components
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { AdminConsoleLayout } from "./components/layout/AdminConsoleLayout";

// Page components
import { Landing } from "./pages/Landing";
import { LoginView } from "./pages/LoginView";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";
import { ConsentAcceptPage } from "./pages/ConsentAcceptPage";
import ConfirmAppointmentPage from "./pages/ConfirmAppointmentPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";

// ── Theme context ───────────────────────────────────────────
type ThemeCtx = { theme: ThemeMode; setTheme: (m: ThemeMode) => void };
export const ThemeContext = createContext<ThemeCtx>({ theme: "system", setTheme: () => {} });
export function useTheme() { return useContext(ThemeContext); }

function loadValidSession(): AuthSession | null {
  const s = getSession();
  if (!s || !s.token || !s.role) { clearSession(); return null; }
  return s;
}

const initialSession = loadValidSession();

export function App() {
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  // Apply theme on load and on change
  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) =>
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  function setTheme(m: ThemeMode) {
    setThemeState(m);
    applyTheme(m);
    setStoredTheme(m);
  }

  function handleAuthSuccess(nextSession: AuthSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handlePasswordChanged(updated: AuthSession) {
    saveSession(updated);
    setSession(updated);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={session ? <Navigate to="/dashboard" replace /> : <LoginView onSuccess={handleAuthSuccess} />}
        />
        <Route
          path="/dashboard/*"
          element={session ? <DashboardLayout session={session} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin/*"
          element={session && isPlatformAdmin(session) ? <AdminConsoleLayout session={session} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route path="/accept-invitation" element={<AcceptInvitationPage onSuccess={handleAuthSuccess} />} />
        <Route path="/consent" element={<ConsentAcceptPage />} />
        <Route path="/confirm-appointment" element={<ConfirmAppointmentPage />} />
        <Route
          path="/change-password"
          element={session ? <ChangePasswordPage session={session} onSuccess={handlePasswordChanged} /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to={session ? (session.mustChangePassword ? "/change-password" : "/dashboard") : "/"} replace />} />
      </Routes>
    </ThemeContext.Provider>
  );
}
