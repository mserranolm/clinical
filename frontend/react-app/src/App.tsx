import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getSession, saveSession, clearSession } from "./lib/session";
import { AuthSession } from "./types";
import { isPlatformAdmin } from "./lib/rbac";

// Layout components
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { AdminConsoleLayout } from "./components/layout/AdminConsoleLayout";

// Page components
import { Landing } from "./pages/Landing";
import { LoginView } from "./pages/LoginView";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";

const initialSession = getSession();

export function App() {
  const [session, setSession] = useState<AuthSession | null>(initialSession);

  function handleAuthSuccess(nextSession: AuthSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return (
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
      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}
