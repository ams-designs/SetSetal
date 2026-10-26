// Collector sign-in with a code sent by SMS (Supabase Auth). Residents never
// sign in. The session lives in localStorage, as supabase-js would keep it.
import { backendConfigured, call } from "./api";

const SESSION_KEY = "setsetal.session.v1";
// Phones are often shared: a sign-in unused for a week ends on this phone.
const IDLE_LIMIT = 7 * 24 * 60 * 60 * 1000;

export interface Session {
  accessToken: string;
  refreshToken: string;
  // Milliseconds since the epoch.
  expiresAt: number;
  userId: string;
  phone: string;
  lastUsed?: number;
}

export type AuthResult = "ok" | "unavailable" | "offline" | "invalid" | "rate-limited" | "failed";

// Accepts what people type in The Gambia: 7 local digits, 220…, 00220… or +220…
export function normalisePhone(input: string): string | null {
  let phone = input.replace(/[\s\-().]/g, "");
  if (/^\d{7}$/.test(phone)) phone = `+220${phone}`;
  else if (/^00\d+$/.test(phone)) phone = `+${phone.slice(2)}`;
  else if (/^220\d{7}$/.test(phone)) phone = `+${phone}`;
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}

function readSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    return saved && typeof saved.accessToken === "string" && typeof saved.userId === "string" ? saved : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the collector stays signed in for this visit only.
  }
}

let memorySession: Session | null = null;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; phone?: string };
}

function toSession(body: TokenResponse): Session {
  const phone = body.user.phone ?? "";
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    userId: body.user.id,
    phone: phone && !phone.startsWith("+") ? `+${phone}` : phone
  };
}

async function failure(response: Response): Promise<AuthResult> {
  if (response.status === 429) return "rate-limited";
  let message = "";
  try {
    const body = (await response.json()) as { msg?: string; message?: string; error_description?: string };
    message = body.msg ?? body.message ?? body.error_description ?? "";
  } catch {
    // No body.
  }
  // Phone sign-in switched off, or no SMS provider set up yet.
  if (/provider|disabled|not enabled/i.test(message)) return "unavailable";
  return response.status >= 500 ? "failed" : "invalid";
}

export async function requestCode(phone: string): Promise<AuthResult> {
  if (!backendConfigured) return "unavailable";
  if (!navigator.onLine) return "offline";
  try {
    const response = await call("auth/v1/otp", { method: "POST", body: JSON.stringify({ phone }) });
    return response.ok ? "ok" : failure(response);
  } catch {
    return "offline";
  }
}

export async function verifyCode(phone: string, code: string): Promise<AuthResult> {
  if (!backendConfigured) return "unavailable";
  if (!navigator.onLine) return "offline";
  try {
    const response = await call("auth/v1/verify", {
      method: "POST",
      body: JSON.stringify({ type: "sms", phone, token: code })
    });
    if (!response.ok) return failure(response);
    memorySession = toSession((await response.json()) as TokenResponse);
    writeSession(memorySession);
    return "ok";
  } catch {
    return "offline";
  }
}

// The signed-in collector, refreshing the token when it is about to expire.
// Offline, a stale session is returned and requests will say so.
export async function currentSession(): Promise<Session | null> {
  const session = memorySession ?? readSession();
  if (!session) return null;
  if (Date.now() - (session.lastUsed ?? Date.now()) > IDLE_LIMIT) {
    memorySession = null;
    writeSession(null);
    return null;
  }
  session.lastUsed = Date.now();
  writeSession(session);
  memorySession = session;
  if (session.expiresAt - Date.now() > 60_000 || !navigator.onLine) return session;
  try {
    const response = await call("auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refreshToken })
    });
    if (response.ok) {
      memorySession = { ...toSession((await response.json()) as TokenResponse), lastUsed: Date.now() };
      writeSession(memorySession);
      return memorySession;
    }
    if (response.status >= 400 && response.status < 500) {
      memorySession = null;
      writeSession(null);
      return null;
    }
  } catch {
    // Network trouble: keep the session and let the next request report it.
  }
  return session;
}

export async function signOut(): Promise<void> {
  const session = memorySession ?? readSession();
  memorySession = null;
  writeSession(null);
  if (session && navigator.onLine) {
    try {
      await call("auth/v1/logout", { method: "POST" }, session.accessToken);
    } catch {
      // Signed out on this phone either way.
    }
  }
}
