// A signed-in collector's own listing: load it, with the latest review reason,
// and save it through save_my_listing() so all of it is saved or none of it.
import { call } from "./api";
import type { Session } from "./auth";
import type { Database } from "./types/db";

export type ListingStatus = Database["public"]["Enums"]["collector_status"];

export interface MyListing {
  id: string;
  name: string;
  vehicle: string;
  description: string;
  status: ListingStatus;
  consent: boolean;
  phone: string;
  whatsapp: string;
  areas: string[];
  waste: string[];
  // Why it was last rejected or suspended, from the audit log.
  reason: string | null;
}

export interface ListingDraft {
  id: string | null;
  name: string;
  vehicle: string;
  description: string;
  phone: string;
  whatsapp: string;
  areas: string[];
  waste: string[];
  consent: boolean;
}

export interface Area {
  id: string;
  name: string;
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; error: "offline" | "signed-out" | "failed" };

async function getJSON<T>(path: string, token?: string): Promise<LoadResult<T>> {
  if (!navigator.onLine) return { ok: false, error: "offline" };
  try {
    const response = await call(`rest/v1/${path}`, {}, token);
    if (response.status === 401) return { ok: false, error: "signed-out" };
    if (!response.ok) return { ok: false, error: "failed" };
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, error: "offline" };
  }
}

// The areas a listing can choose: the database's list, not the demo list.
export const fetchAreas = (): Promise<LoadResult<Area[]>> =>
  getJSON("areas?select=id,name&order=sort_order.asc,name.asc");

interface ListingRow {
  id: string;
  name: string;
  vehicle_type: string;
  description: string;
  consent_at: string | null;
  status: ListingStatus;
  // One-to-one embeds come back as an object; allow an array too.
  collector_contacts: { phone: string | null; whatsapp: string | null } | { phone: string | null; whatsapp: string | null }[] | null;
  collector_areas: { area_id: string }[];
  collector_waste_types: { waste_type_id: string }[];
}

export async function fetchMyListing(session: Session): Promise<LoadResult<MyListing | null>> {
  const rows = await getJSON<ListingRow[]>(
    "collectors?select=id,name,vehicle_type,description,consent_at,status," +
    "collector_contacts(phone,whatsapp),collector_areas(area_id),collector_waste_types(waste_type_id)" +
    `&owner=eq.${encodeURIComponent(session.userId)}&order=created_at.asc&limit=1`,
    session.accessToken);
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (!row) return { ok: true, value: null };

  let reason: string | null = null;
  if (row.status === "rejected" || row.status === "suspended") {
    const audit = await getJSON<{ reason: string }[]>(
      `audit_log?select=reason&collector_id=eq.${encodeURIComponent(row.id)}&to_status=eq.${row.status}&order=id.desc&limit=1`,
      session.accessToken);
    reason = audit.ok ? audit.value[0]?.reason ?? null : null;
  }
  const contacts = Array.isArray(row.collector_contacts) ? row.collector_contacts[0] : row.collector_contacts;
  return {
    ok: true,
    value: {
      id: row.id,
      name: row.name,
      vehicle: row.vehicle_type,
      description: row.description,
      status: row.status,
      consent: row.consent_at !== null,
      phone: contacts?.phone ?? "",
      whatsapp: contacts?.whatsapp ?? "",
      areas: row.collector_areas.map((link) => link.area_id),
      waste: row.collector_waste_types.map((link) => link.waste_type_id),
      reason
    }
  };
}

// "unknown": the request left the phone but no answer came back (a timeout),
// so it may or may not have been saved.
export type SaveResult =
  | { ok: true; id: string; status: ListingStatus }
  | { ok: false; error: "offline" | "unknown" | "signed-out" | "invalid" | "failed" };

export async function saveMyListing(session: Session, draft: ListingDraft): Promise<SaveResult> {
  if (!navigator.onLine) return { ok: false, error: "offline" };
  try {
    const response = await call("rest/v1/rpc/save_my_listing", {
      method: "POST",
      body: JSON.stringify({
        p_id: draft.id,
        p_name: draft.name,
        p_vehicle_type: draft.vehicle,
        p_description: draft.description,
        p_phone: draft.phone || null,
        p_whatsapp: draft.whatsapp || null,
        p_areas: draft.areas,
        p_waste_types: draft.waste,
        p_consent: draft.consent
      })
    }, session.accessToken);
    if (response.ok) {
      const saved = (await response.json()) as { id: string; status: ListingStatus };
      return { ok: true, id: saved.id, status: saved.status };
    }
    if (response.status === 401) return { ok: false, error: "signed-out" };
    return { ok: false, error: response.status >= 500 ? "failed" : "invalid" };
  } catch {
    return { ok: false, error: navigator.onLine ? "unknown" : "offline" };
  }
}
