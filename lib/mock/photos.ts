/**
 * Seed photos. Real intake photos come from the camera; these are inline SVG
 * data URIs so the app has something to lay out without a network request.
 * A backend swaps these for CDN URLs — nothing else changes.
 */

const SWATCHES = [
  ["#3b3a36", "#6f6c64"],
  ["#4a4239", "#7d7466"],
  ["#33383d", "#646c74"],
  ["#3d3630", "#736657"],
  ["#2f3833", "#5e6f66"],
  ["#413338", "#75606a"],
];

export function mockPhotoUrl(label: string, index: number): string {
  const [dark, light] = SWATCHES[index % SWATCHES.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
<rect width="480" height="640" fill="${dark}"/>
<rect x="96" y="72" width="288" height="496" rx="26" fill="${light}" stroke="#0f0f0f" stroke-width="6"/>
<rect x="112" y="104" width="256" height="432" rx="10" fill="#1a1a1a" opacity="0.75"/>
<circle cx="240" cy="88" r="6" fill="#0f0f0f"/>
<text x="240" y="604" font-family="monospace" font-size="22" fill="#e8e4da" text-anchor="middle">${escapeXml(label)}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const PHOTO_CAPTIONS = [
  "Front, powered off",
  "Back panel",
  "Left edge",
  "Right edge",
  "Charging port",
  "Screen damage close-up",
];
