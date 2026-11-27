// Makes the pilot's A4 poster with a QR code that opens SetSetal:
//   npm run poster                      → https://setsetal.netlify.app/
//   npm run poster -- https://example/  → another address
// Writes docs/pilot/poster.svg. Open it in a browser and print at A4.
// A printed QR code can't be changed, so print only once the address is final.
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const url = process.argv[2] ?? "https://setsetal.netlify.app/";
if (!/^https:\/\/[^\s]+$/.test(url)) {
  console.error("The address must start with https://");
  process.exit(1);
}

// High error correction: posters get creased, rained on and torn.
const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
const size = qr.modules.size;
let squares = "";
for (let row = 0; row < size; row++) {
  for (let col = 0; col < size; col++) {
    if (qr.modules.get(row, col)) squares += `M${col} ${row}h1v1h-1z`;
  }
}

const escapeXML = (value) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const shown = escapeXML(url.replace(/^https:\/\//, "").replace(/\/$/, ""));
const QR_MM = 92;
const scale = QR_MM / size;

const step = (n, x, title, body) => `
    <g transform="translate(${x} 216)">
      <rect width="56" height="38" rx="5" fill="#FFFFFF" stroke="#E4EBE5" stroke-width=".4"/>
      <text x="6" y="11" font-size="6" font-weight="800" fill="#147D59">${n}</text>
      <text x="6" y="20" font-size="4.7" font-weight="800" fill="#28302D">${title}</text>
      <text x="6" y="27" font-size="3.9" fill="#5F6B64">${body[0]}</text>
      <text x="6" y="32.2" font-size="3.9" fill="#5F6B64">${body[1] ?? ""}</text>
    </g>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"
     font-family="Inter, Roboto, 'Noto Sans', 'Segoe UI', Arial, sans-serif">
  <title>SetSetal poster</title>
  <rect width="210" height="297" fill="#FAF8F1"/>
  <rect width="210" height="74" fill="#147D59"/>

  <g transform="translate(16 14)">
    <rect width="20" height="20" rx="6" fill="#FFFFFF"/>
    <g transform="translate(3 3) scale(.35)" fill="#147D59">
      <path d="M20 5 26 8 23 14 17 14 14 9Z"/><path d="M29 15 34 24 28 28 24 22 26 17Z"/>
      <path d="M22 31 12 31 12 24 19 23 23 27Z"/><path d="M11 21 6 12 12 9 16 16 14 21Z"/>
      <circle cx="20" cy="20" r="4" fill="#FFFFFF"/>
    </g>
    <text x="26" y="15.5" font-size="13" font-weight="800" fill="#FFFFFF" letter-spacing="-.4">SetSetal</text>
  </g>
  <text x="16" y="52" font-size="12.5" font-weight="800" fill="#FFFFFF" letter-spacing="-.3">Need your waste collected?</text>
  <text x="16" y="64" font-size="6.6" fill="#E7F2EA">Find a collector in Brikama: truck, van, tricycle or cart.</text>

  <rect x="${(210 - QR_MM) / 2 - 8}" y="86" width="${QR_MM + 16}" height="${QR_MM + 16}" rx="6" fill="#FFFFFF" stroke="#E4EBE5" stroke-width=".4"/>
  <path transform="translate(${(210 - QR_MM) / 2} 94) scale(${scale})" d="${squares}" fill="#174B3A"/>

  <text x="105" y="199" text-anchor="middle" font-size="5" fill="#5F6B64">Point your phone's camera at the square, or type</text>
  <text x="105" y="208" text-anchor="middle" font-size="7.4" font-weight="800" fill="#174B3A">${shown}</text>
${step("1", 15, "Choose your area", ["Pick it from the list.", "No sign-up needed."])}
${step("2", 77, "Compare collectors", ["See who serves your", "area and what they take."])}
${step("3", 139, "Call or WhatsApp", ["Agree the time and price", "directly with them."])}

  <rect x="15" y="260" width="180" height="22" rx="5" fill="#E7F2EA"/>
  <text x="21" y="269.5" font-size="5.4" font-weight="800" fill="#174B3A">Do you collect waste?</text>
  <text x="21" y="276.5" font-size="4.3" fill="#28302D">Add your service: open SetSetal, tap Join and sign in with your phone number.</text>

  <text x="105" y="291" text-anchor="middle" font-size="3.4" fill="#5F6B64">SetSetal lists local collectors. You arrange and pay the collector yourself. No address or sign-up is needed to search.</text>
</svg>
`;

await writeFile(new URL("../docs/pilot/poster.svg", import.meta.url), svg);
console.log(`docs/pilot/poster.svg now opens ${url}`);
