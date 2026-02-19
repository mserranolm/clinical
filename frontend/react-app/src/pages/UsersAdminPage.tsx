import type { AuthSession } from "../types";

export function UsersAdminPage({ session }: { session: AuthSession }) {
  return (
    <section>
      <h1>Usuarios y permisos</h1>
      <p>
        Organización: <strong>{session.orgId || "-"}</strong>
      </p>
      <p>
        Aquí podrás invitar usuarios, cambiar roles y habilitar/deshabilitar.
      </p>
    </section>
  );
}
