// Reads from the hosted Supabase project through its REST API. Plain fetch
// instead of supabase-js keeps the app small on slow, paid data. Row-level
// security on the server decides what each request can see.
import type { Database } from "./types/db";

export type PublicCollectorRow = Database["public"]["Views"]["public_collectors"]["Row"];

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TIMEOUT_MS = 10_000;

export const backendConfigured = Boolean(url && key);

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key ?? "", Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Ordered by name: never by anything paid (product rule 5).
export const fetchPublicCollectors = (): Promise<PublicCollectorRow[]> =>
  get("public_collectors?select=id,name,vehicle_type,description,phone,whatsapp,areas,waste_types&order=name.asc");

export type NewReport = Pick<Database["public"]["Tables"]["reports"]["Insert"], "type" | "message" | "collector_id">;

// "retry": it didn't arrive but may later (offline, a timeout, the server
// busy). "link-rejected": the server refused the listing it names, usually
// because that listing is no longer shown. "rejected": it never will as it
// stands. "unavailable": this build has no server to send to.
export type SendResult = "sent" | "retry" | "link-rejected" | "rejected" | "unavailable";

async function refusedLink(response: Response, report: NewReport): Promise<boolean> {
  if (!report.collector_id) return false;
  try {
    const error = (await response.json()) as { code?: string; message?: string };
    return (error.code === "42501" && /row-level security/.test(error.message ?? "")) ||
      (error.code === "23503" && /collector_id/.test(error.message ?? ""));
  } catch {
    return false;
  }
}

// Residents can't read reports back, so the insert asks for nothing in return.
export async function sendReport(report: NewReport): Promise<SendResult> {
  if (!backendConfigured) return "unavailable";
  if (!navigator.onLine) return "retry";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/rest/v1/reports`, {
      method: "POST",
      headers: { apikey: key ?? "", "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(report),
      signal: controller.signal
    });
    if (response.ok) return "sent";
    if (response.status >= 500 || response.status === 429) return "retry";
    return (await refusedLink(response, report)) ? "link-rejected" : "rejected";
  } catch {
    return "retry";
  } finally {
    clearTimeout(timer);
  }
}
