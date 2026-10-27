// Single source for areas, vehicles, waste and report types until Phase 2
// moves them into the database. Labels for vehicles, waste and report types
// live in the translation files; area names are place names, not translations.
import { t, type MessageKey } from "../i18n";

export const AREAS = [
  { id: "banjul", name: "Banjul" },
  { id: "bakau", name: "Bakau" },
  { id: "kanifing", name: "Kanifing" },
  { id: "serrekunda", name: "Serrekunda" },
  { id: "brikama", name: "Brikama" }
] as const;
export const OTHER_AREA = "other";

export const VEHICLES = ["municipal-truck", "private-truck", "small-van", "tricycle", "donkey-cart", "horse-cart"] as const;
export const WASTE_TYPES = ["household", "garden", "bulky", "recyclables", "business"] as const;
export const REPORT_TYPES = ["general", "incorrect-listing", "safety", "accessibility"] as const;

export type AreaId = (typeof AREAS)[number]["id"];
export type VehicleId = (typeof VEHICLES)[number];
export type WasteId = (typeof WASTE_TYPES)[number];
export type ReportTypeId = (typeof REPORT_TYPES)[number];

export const isArea = (value: string): value is AreaId => AREAS.some((area) => area.id === value);
export const isVehicle = (value: string): value is VehicleId => (VEHICLES as readonly string[]).includes(value);
export const isWaste = (value: string): value is WasteId => (WASTE_TYPES as readonly string[]).includes(value);
export const isReportType = (value: string): value is ReportTypeId => (REPORT_TYPES as readonly string[]).includes(value);

export const areaLabel = (id: string): string =>
  id === OTHER_AREA ? t("lookup.area.other") : AREAS.find((area) => area.id === id)?.name ?? id;
export const vehicleLabel = (id: VehicleId): string => t(`lookup.vehicle.${id}` as MessageKey);
export const wasteLabel = (id: WasteId): string => t(`lookup.waste.${id}` as MessageKey);
export const reportTypeLabel = (id: ReportTypeId): string => t(`lookup.report.${id}` as MessageKey);
