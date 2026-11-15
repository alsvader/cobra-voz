/**
 * Genera los iconos temporales de la PWA (DESIGN.md §11): ícono `mic` de Lucide
 * en blanco sobre círculo turquesa (#107B75). No es identidad de marca final.
 *
 * Uso: npm run icons
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEAL = "#107B75";

/** Trazos del ícono `mic` de Lucide (viewBox 24×24). */
const micPaths = `
  <path d="M12 19v3" />
  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  <rect x="9" y="2" width="6" height="13" rx="3" />
`;

/**
 * @param {{ maskable: boolean }} options
 * `maskable`: fondo a sangre completa y micrófono dentro de la zona segura (60 %).
 * Normal: círculo sobre fondo transparente.
 */
function iconSvg({ maskable }) {
  const size = 512;
  const micScale = maskable ? 0.6 : 0.56;
  const micSize = size * micScale;
  const offset = (size - micSize) / 2;
  const background = maskable
    ? `<rect width="${size}" height="${size}" fill="${TEAL}" />`
    : `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${TEAL}" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background}
    <g transform="translate(${offset} ${offset}) scale(${micSize / 24})"
       fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${micPaths}
    </g>
  </svg>`;
}

async function render(svg, size, file) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log(`✓ ${path.relative(root, file)} (${size}×${size})`);
}

const any = iconSvg({ maskable: false });
const maskable = iconSvg({ maskable: true });

await render(any, 192, path.join(root, "public/icons/icon-192.png"));
await render(any, 512, path.join(root, "public/icons/icon-512.png"));
await render(
  maskable,
  512,
  path.join(root, "public/icons/icon-maskable-512.png"),
);
// Convenciones de archivo de Next.js: <link rel="icon"> y apple-touch-icon.
await render(any, 512, path.join(root, "app/icon.png"));
await render(maskable, 180, path.join(root, "app/apple-icon.png"));
