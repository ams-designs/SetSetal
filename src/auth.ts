// Collector sign-in with a code sent by SMS (Supabase Auth), and admin sign-in
// with a code sent by email until SMS is switched on. Residents never sign in. The session lives in localStorage, as supabase-js would keep it.
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
  // Set for an admin who signed in by email; phone is then empty.
  email?: string;
  lastUsed?: number;
}

export type AuthResult = "ok" | "unavailable" | "offline" | "invalid" | "rate-limited" | "captcha" | "failed";

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
  user: { id: string; phone?: string; email?: string };
}

function toSession(body: TokenResponse): Session {
  const phone = body.user.phone ?? "";
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    userId: body.user.id,
    phone: phone && !phone.startsWith("+") ? `+${phone}` : phone,
    ...(body.user.email ? { email: body.user.email } : {})
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
  // The "are you a person?" check was missing, used twice or refused.
  if (/captcha/i.test(message)) return "captcha";
  // Phone sign-in switched off, or no SMS provider set up yet.
  if (/provider|disabled|not enabled/i.test(message)) return "unavailable";
  return response.status >= 500 ? "failed" : "invalid";
}

// A plain check, enough to catch typing mistakes; Supabase has the last word.
export function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function sendCode(body: Record<string, unknown>, captchaToken: string | null): Promise<AuthResult> {
  if (!backendConfigured) return "unavailable";
  if (!navigator.onLine) return "offline";
  try {
    const response = await call("auth/v1/otp", {
      method: "POST",
      body: JSON.stringify(captchaToken ? { ...body, gotrue_meta_security: { captcha_token: captchaToken } } : body)
    });
    return response.ok ? "ok" : failure(response);
  } catch {
    return "offline";
  }
}

// captchaToken is the proof from the sign-in check, when the build has one.
export function requestCode(phone: string, captchaToken: string | null = null): Promise<AuthResult> {
  return sendCode({ phone }, captchaToken);
}

// Admins only: create_user is false, so an address without an account (one
// the project owner hasn't set up) gets no code and no new account.
export function requestEmailCode(email: string, captchaToken: string | null = null): Promise<AuthResult> {
  return sendCode({ email, create_user: false }, captchaToken);
}

export function verifyCode(phone: string, code: string): Promise<AuthResult> {
  return verify({ type: "sms", phone, token: code });
}

export function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  return verify({ type: "email", email, token: code });
}

async function verify(body: Record<string, string>): Promise<AuthResult> {
  if (!backendConfigured) return "unavailable";
  if (!navigator.onLine) return "offline";
  try {
    const response = await call("auth/v1/verify", {
      method: "POST",
      body: JSON.stringify(body)
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
    // A refused refresh token ends the sign-in. "Too many requests" (429) and
    // a timeout (408) are temporary, like network trouble: keep the session.
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      memorySession = null;
      writeSession(null);
      return null;
    }
  } catch {
    // Network trouble: keep the session and let the next request report it.
  }
  return session;
}

// Ends the sign-in on this phone only, for an account that no longer exists.
export function forgetSession(): void {
  memorySession = null;
  writeSession(null);
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
