// Areas, vehicles, waste and report types. The database is the single source
// for what is offered and in what order (public.app_lookups()); the
// translation files hold the labels. There is no list of ids here: a type is
// offered only if the database has it in use and this build has a label for
// it, and until the database answers the app offers every type it can label.
// Area names are place names, not translations, and come from the database.
import en from "../i18n/en.json";
import { t, type MessageKey } from "../i18n";
import { backendConfigured, fetchLookups } from "../api";

type IdsOf<Prefix extends string> = MessageKey extends infer Key
  ? Key extends `${Prefix}.${infer Id}` ? Id : never
  : never;

export type VehicleId = IdsOf<"lookup.vehicle">;
export type WasteId = IdsOf<"lookup.waste">;
export type ReportTypeId = IdsOf<"lookup.report">;

export interface Area {
  id: string;
  name: string;
}

export const OTHER_AREA = "other";

// Every id this build has a label for, in the order of the translation file.
const labelled = <Id extends string>(prefix: string): Id[] =>
  Object.keys(en).filter((key) => key.startsWith(`${prefix}.`)).map((key) => key.slice(prefix.length + 1) as Id);

const KNOWN = {
  vehicles: labelled<VehicleId>("lookup.vehicle"),
  waste: labelled<WasteId>("lookup.waste"),
  reportTypes: labelled<ReportTypeId>("lookup.report")
};

interface Lookups {
  areas: Area[];
  vehicles: VehicleId[];
  waste: WasteId[];
  reportTypes: ReportTypeId[];
}

let current: Lookups = { areas: [], ...KNOWN };

export const isVehicle = (value: string): value is VehicleId => (KNOWN.vehicles as string[]).includes(value);
export const isWaste = (value: string): value is WasteId => (KNOWN.waste as string[]).includes(value);
export const isReportType = (value: string): value is ReportTypeId => (KNOWN.reportTypes as string[]).includes(value);

export const areas = (): Area[] => current.areas;
export const vehicles = (): VehicleId[] => current.vehicles;
export const wasteTypes = (): WasteId[] => current.waste;
export const reportTypes = (): ReportTypeId[] => current.reportTypes;

// "brikama-nyambai" → "Brikama Nyambai", for an area whose name hasn't loaded.
const fromId = (id: string): string =>
  id.split("-").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export const areaLabel = (id: string): string =>
  id === OTHER_AREA ? t("lookup.area.other") : current.areas.find((area) => area.id === id)?.name ?? fromId(id);
export const vehicleLabel = (id: VehicleId): string => t(`lookup.vehicle.${id}` as MessageKey);
export const wasteLabel = (id: WasteId): string => t(`lookup.waste.${id}` as MessageKey);
export const reportTypeLabel = (id: ReportTypeId): string => t(`lookup.report.${id}` as MessageKey);

// Loading ------------------------------------------------------------------------

const CACHE_KEY = "setsetal.lookups.v1";

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

// Anything unexpected from the server or the cache is ignored rather than shown.
function parse(value: unknown): Lookups | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const areaRows = Array.isArray(raw.areas) ? raw.areas : [];
  const parsed: Lookups = {
    areas: areaRows.filter((row): row is Area =>
      Boolean(row) && typeof (row as Area).id === "string" && typeof (row as Area).name === "string")
      .map(({ id, name }) => ({ id, name })),
    vehicles: strings(raw.vehicle_types).filter(isVehicle),
    waste: strings(raw.waste_types).filter(isWaste),
    reportTypes: strings(raw.report_types).filter(isReportType)
  };
  // A list that came back empty would leave a form with nothing to choose.
  return parsed.vehicles.length && parsed.waste.length && parsed.reportTypes.length ? parsed : null;
}

function readCache(): Lookups | null {
  try {
    return parse(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

function writeCache(raw: unknown): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  } catch {
    // Storage can be full or blocked; the next visit fetches again.
  }
}

let loading: Promise<boolean> | null = null;
let fresh = false;

async function load(onChange: () => void): Promise<boolean> {
  const cached = readCache();
  if (cached) {
    current = cached;
    onChange();
  }
  if (!backendConfigured || !navigator.onLine) return false;
  try {
    const raw = await fetchLookups();
    const parsed = parse(raw);
    if (!parsed) return false;
    current = parsed;
    fresh = true;
    writeCache(raw);
    onChange();
    return true;
  } catch {
    return false;
  }
}

let changed: () => void = () => {};

// Shows the last saved lists straight away, then asks the server. onChange
// runs each time the lists change, so screens can redraw their choices.
export function loadLookups(onChange: () => void): Promise<boolean> {
  changed = onChange;
  loading = load(onChange);
  return loading;
}

// For the screens that must not work from a stale list (a collector choosing
// their areas): true once the lists have come from the server in this visit.
export async function freshLookups(): Promise<boolean> {
  if (fresh) return true;
  if (loading) await loading;
  if (fresh) return true;
  loading = load(changed);
  return loading;
}

// Asks the server again, for example after an admin adds an area.
export function refreshLookups(): Promise<boolean> {
  loading = load(changed);
  return loading;
}
