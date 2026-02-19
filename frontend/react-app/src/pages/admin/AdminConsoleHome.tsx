import type { AuthSession } from "../../types";

export function AdminConsoleHome({ session }: { session: AuthSession }) {
  return (
    <section>
      <h1>Consola de Plataforma</h1>
      <p>
        Usuario: <strong>{session.email || session.userId}</strong>
      </p>
      <p>
        Rol: <strong>{session.role}</strong>
      </p>
      <p>
        Aquí se gestionarán organizaciones y admins de organizaciones.
      </p>
    </section>
  );
}
