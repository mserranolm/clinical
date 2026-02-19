import { Navigate, Route, Routes } from "react-router-dom";
import type { AuthSession } from "../../types";
import { AdminConsoleHome } from "../../pages/admin/AdminConsoleHome";

export function AdminConsoleLayout({ session }: { session: AuthSession }) {
  return (
    <main className="admin-layout">
      <section className="content-area" style={{ width: "100%" }}>
        <div className="page-content">
          <Routes>
            <Route index element={<AdminConsoleHome session={session} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </section>
    </main>
  );
}
