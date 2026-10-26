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
