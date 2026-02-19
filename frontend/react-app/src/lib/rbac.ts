import type { AuthSession } from "../types";

export function isPlatformAdmin(session: AuthSession | null | undefined): boolean {
  return String(session?.role || "").toLowerCase() === "platform_admin";
}

export function isOrgAdmin(session: AuthSession | null | undefined): boolean {
  return String(session?.role || "").toLowerCase() === "admin";
}
