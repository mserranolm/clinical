import type { AuthSession } from "../types";

const SESSION_KEY = "clinical_session";

/** Retrieves the current auth session from localStorage, or null if not found/invalid. */
export function getSession(): AuthSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

/** Persists the auth session to localStorage. */
export function saveSession(session: AuthSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/** Removes the auth session from localStorage (logout). */
export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
