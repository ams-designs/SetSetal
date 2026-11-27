// Pictures that carry meaning for people who read little: every vehicle, waste
// type and main action has one. Filled, two-tone, one outline colour and
// weight, so they read at a glance in bright sun. Always paired with a label
// (visible or accessible); never shown alone as the only way to know a thing.
import type { ReportTypeId, VehicleId, WasteId } from "./data/lookups";

const INK = "#174B3A";
const line = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const wheel = (x: number, y: number, r = 6) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" ${line}/><circle cx="${x}" cy="${y}" r="1.6" fill="${INK}"/>`;

const svg = (viewBox: string, body: string, className: string) =>
  `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;

const vehicleBodies: Record<VehicleId, string> = {
  "municipal-truck": `
    <path d="M3 12h36v24H3z" fill="#147D59" ${line}/>
    <path d="M3 22h36" stroke="#FFFFFF" stroke-width="3"/>
    <path d="M39 19h12l9 10v7H39z" fill="#E7F2EA" ${line}/>
    <path d="M44 22h6l5 6H44z" fill="#9FD3BD"/>
    ${wheel(13, 38)}${wheel(50, 38)}`,
  "private-truck": `
    <path d="M4 14h33l-3 22H4z" fill="#C46A43" ${line}/>
    <path d="M37 19h12l9 10v7H37z" fill="#FDF1D3" ${line}/>
    <path d="M42 22h6l5 6H42z" fill="#F0D58C"/>
    ${wheel(14, 38)}${wheel(49, 38)}`,
  "small-van": `
    <path d="M5 36V20c0-3 2-6 6-6h28c3 0 5 1 7 4l9 11v7z" fill="#E8B84A" ${line}/>
    <path d="M40 18l8 10H40z" fill="#FFFFFF" ${line}/>
    <path d="M12 18h22v9H12z" fill="#FFFFFF" ${line}/>
    ${wheel(16, 37)}${wheel(46, 37)}`,
  tricycle: `
    <path d="M4 15h30v17H4z" fill="#147D59" ${line}/>
    <path d="M34 30h11l9 8M45 30l-3-15h8" fill="none" ${line}/>
    ${wheel(11, 38)}${wheel(27, 38)}${wheel(55, 38)}`,
  "donkey-cart": `
    <path d="M2 23h32v10H2z" fill="#E8B84A" ${line}/>
    <path d="M34 28h6" ${line}/>
    <path d="M40 24h11l3-9 2-9 2 8 3 1-1 5h-4l-3 7v14M44 24v16" fill="#9A9087" ${line}/>
    <path d="M55 7l-1-5M58 8l1-5" ${line}/>
    ${wheel(13, 38)}`,
  "horse-cart": `
    <path d="M2 23h30v10H2z" fill="#E8B84A" ${line}/>
    <path d="M32 28h6" ${line}/>
    <path d="M38 23h12l5-11 4-7 2 6 4 3-2 4h-4l-3 7v15M43 23v17" fill="#8B5A3C" ${line}/>
    <path d="M55 12c-3 1-5 4-6 8" fill="none" stroke="#3B2417" stroke-width="3" stroke-linecap="round"/>
    ${wheel(12, 38)}`
};

const wasteBodies: Record<WasteId, string> = {
  household: `
    <path d="M13 17h22l4 25H9z" fill="#28302D" ${line}/>
    <path d="M18 17c0-5 3-9 6-9s6 4 6 9" fill="none" ${line}/>`,
  garden: `
    <path d="M9 40C9 20 22 8 40 8c0 19-12 32-31 32z" fill="#7BBF6A" ${line}/>
    <path d="M9 40 30 19" ${line}/>`,
  bulky: `
    <path d="M9 19h30v13H9z" fill="#C46A43" ${line}/>
    <path d="M4 22h7v14H4zM37 22h7v14h-7z" fill="#A9532F" ${line}/>
    <path d="M8 36v5M40 36v5" ${line}/>`,
  recyclables: `
    <path d="M11 16h12v26H11z" fill="#9FD3BD" ${line}/>
    <path d="M14 8h6v8h-6z" fill="#147D59" ${line}/>
    <path d="M27 20h11v22H27z" fill="#D7DCD9" ${line}/>`,
  business: `
    <path d="M7 20h34v21H7z" fill="#FFFFFF" ${line}/>
    <path d="M5 11h38l-2 9H7z" fill="#E8B84A" ${line}/>
    <path d="M19 41V29h10v12" fill="#147D59" ${line}/>`
};

const reportBodies: Record<ReportTypeId, string> = {
  // A house with the door shut and nobody at it.
  "no-show": `
    <path d="M6 22 24 8l18 14v20H6z" fill="#E8B84A" ${line}/>
    <path d="M19 42V30h10v12" fill="#FFFFFF" ${line}/>
    <circle cx="36" cy="34" r="9" fill="#B42318" ${line}/>
    <path d="m32.5 30.5 7 7m0-7-7 7" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>`,
  late: `
    <circle cx="24" cy="25" r="17" fill="#FDF1D3" ${line}/>
    <path d="M24 14v11l8 5" fill="none" ${line}/>
    <path d="M16 5h16" ${line}/>`,
  "incorrect-listing": `
    <rect x="13" y="5" width="22" height="38" rx="5" fill="#FFFFFF" ${line}/>
    <path d="M19 12h10M19 18h10M19 24h6" stroke="#9AA49E" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="33" cy="34" r="9" fill="#B42318" ${line}/>
    <path d="m29.5 30.5 7 7m0-7-7 7" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>`,
  safety: `
    <path d="M24 5 44 41H4z" fill="#E8B84A" ${line}/>
    <path d="M24 18v11" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="24" cy="35" r="2.2" fill="${INK}"/>`,
  general: `
    <path d="M7 9h34v24H22l-9 8v-8H7z" fill="#E7F2EA" ${line}/>
    <circle cx="16" cy="21" r="2.4" fill="${INK}"/><circle cx="24" cy="21" r="2.4" fill="${INK}"/><circle cx="32" cy="21" r="2.4" fill="${INK}"/>`,
  accessibility: `
    <rect x="12" y="4" width="24" height="40" rx="5" fill="#FFFFFF" ${line}/>
    <circle cx="24" cy="21" r="8" fill="#FDF1D3" ${line}/>
    <path d="M21 18.5a3 3 0 1 1 4 2.8c-.8.3-1 .8-1 1.6M24 26h.01" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
};

export const reportPicture = (id: ReportTypeId): string => svg("0 0 48 48", reportBodies[id], "picture report-picture");

export const vehiclePicture = (id: VehicleId): string => svg("0 0 64 48", vehicleBodies[id], "picture vehicle-picture");
export const wastePicture = (id: WasteId): string => svg("0 0 48 48", wasteBodies[id], "picture waste-picture");

// Line icons for actions, drawn in the current text colour.
const ui = {
  phone: `<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z" fill="currentColor"/>`,
  // A speech bubble with a phone: "message", not any company's logo.
  message: `<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 9.2c0 3.1 2.6 5.7 5.7 5.7l1.1-1.7-2-.9-.8.8a4 4 0 0 1-2.2-2.2l.8-.8-.9-2z" fill="currentColor"/>`,
  pin: `<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="currentColor"/><circle cx="12" cy="10" r="2.6" fill="#FFFFFF"/>`,
  sun: `<circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  all: `<rect x="2.5" y="2.5" width="8.5" height="8.5" rx="2.2" fill="currentColor"/><rect x="13" y="2.5" width="8.5" height="8.5" rx="2.2" fill="currentColor"/><rect x="2.5" y="13" width="8.5" height="8.5" rx="2.2" fill="currentColor"/><rect x="13" y="13" width="8.5" height="8.5" rx="2.2" fill="currentColor"/>`,
  check: `<path d="m4.5 12.5 5 5L19.5 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  noPhone: `<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z" fill="currentColor" opacity=".55"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  chevron: `<path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  pause: `<circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M9.5 7.5v9M14.5 7.5v9" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>`,
  pencil: `<path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="2.2"/>`,
  tick: `<circle cx="12" cy="12" r="11" fill="currentColor"/><path d="m6.5 12.5 3.5 3.5 7.5-8" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  clock: `<circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6v6l4 2.5" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>`,
  warning: `<circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.5v7" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.5" fill="#FFFFFF"/>`,
  send: `<path d="M3 11.5 21 3l-6.5 18-3-7.5z" fill="currentColor"/><path d="m11.5 13.5 4-4" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>`,
  flag: `<path d="M5 22V3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M5 4h13l-3 4.5L18 13H5z" fill="currentColor"/>`,
  question: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.7M12 17h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`
} as const;

export type UiIcon = keyof typeof ui;
export const icon = (name: UiIcon, className = "icon"): string => svg("0 0 24 24", ui[name], className);
