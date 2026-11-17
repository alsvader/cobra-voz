import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

/** CobraVoz · Product Hero Social Card · 1200 × 630 */
export const alt =
  "CobraVoz: Cobra con tu voz. Sigue atendiendo tu negocio. Vista de la experiencia de cobro por voz y un importe reconocido de ejemplo.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANVAS = "#F6F8F5";
const INK = "#172D32";
const BRAND_TEAL = "#078C7B";
const MINT = "#E3F1EF";
const MUTED = "#506369";
const BORDER = "#D7E3DE";

const MIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="25" y="9" width="14" height="30" rx="7" fill="none" stroke="currentColor" stroke-width="4.5"/>
  <path d="M17 29v3a15 15 0 0 0 30 0v-3M32 47v8M23 55h18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="4.5"/>
</svg>`;

// A purely decorative QR *icon*, not a generated/scannable payment code.
const QR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M8 24V8h16M40 8h16v16M8 40v16h16M56 40v16H40"/>
    <rect x="15" y="15" width="10" height="10" rx="1"/>
    <rect x="39" y="15" width="10" height="10" rx="1"/>
    <rect x="15" y="39" width="10" height="10" rx="1"/>
    <path d="M37 37h6v6h-6zM49 39v10h-6M39 53h10"/>
  </g>
</svg>`;

const VOICE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
    <path d="M10 30v4M20 20v24M32 12v40M44 20v24M54 30v4"/>
  </g>
</svg>`;

/** Inline SVG icons are rasterized so Satori does not need to interpret SVG markup. */
async function iconDataUri(svg: string, color: string, pixels = 96) {
  const tinted = svg.replaceAll("currentColor", color);
  const png = await sharp(Buffer.from(tinted))
    .resize(pixels, pixels)
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function loadResources() {
  const root = process.cwd();
  const [regular, bold, logoSvg, micInk, micWhite, qrInk, voiceTeal] =
    await Promise.all([
      readFile(join(root, "brand/fonts/DMSans-Regular.woff")),
      readFile(join(root, "brand/fonts/DMSans-Bold.woff")),
      readFile(join(root, "public/brand/logos/cobravoz-logo-primary.svg")),
      iconDataUri(MIC_ICON, INK),
      iconDataUri(MIC_ICON, "#FFFFFF"),
      iconDataUri(QR_ICON, INK),
      iconDataUri(VOICE_ICON, BRAND_TEAL),
    ]);

  // Preserve the approved vector art; only rasterize it for next/og.
  const logoPng = await sharp(logoSvg).resize({ width: 900 }).png().toBuffer();
  const logo = `data:image/png;base64,${logoPng.toString("base64")}`;

  return {
    regular,
    bold,
    logo,
    micInk,
    micWhite,
    qrInk,
    voiceTeal,
  };
}

/** `ImageResponse` pide un ArrayBuffer y un peso literal, no el Buffer de fs. */
function fontData(file: Buffer): ArrayBuffer {
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
}

type OgFont = {
  name: string;
  data: ArrayBuffer;
  style: "normal";
  weight: 400 | 700;
};

export default async function OpenGraphImage() {
  const assets = await loadResources();
  const fonts: OgFont[] = [
    {
      name: "DM Sans",
      data: fontData(assets.regular),
      style: "normal",
      weight: 400,
    },
  ];
  if (assets.bold) {
    fonts.push({
      name: "DM Sans",
      data: fontData(assets.bold),
      style: "normal",
      weight: 700,
    });
  }

  return new ImageResponse(
    <div
      style={{
        width: size.width,
        height: size.height,
        position: "relative",
        display: "flex",
        overflow: "hidden",
        backgroundColor: CANVAS,
        fontFamily: "DM Sans",
        color: INK,
      }}
    >
      {/* Background: one soft organic brand shape. */}
      <div
        style={{
          position: "absolute",
          left: 590,
          top: -100,
          width: 730,
          height: 800,
          borderRadius: "50%",
          backgroundColor: MINT,
          display: "flex",
        }}
      />

      {/* Brand and marketing copy. */}
      <div style={{ position: "absolute", left: 64, top: 55, display: "flex" }}>
        <img src={assets.logo} alt="" width={315} height={93} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          top: 179,
          width: 610,
          display: "flex",
          flexDirection: "column",
          fontSize: 62,
          fontWeight: 700,
          lineHeight: 1.045,
          letterSpacing: -1.9,
          color: INK,
        }}
      >
        <span style={{ fontWeight: 700 }}>Cobra con tu voz.</span>
        <span style={{ fontWeight: 700 }}>Sigue atendiendo</span>
        <span style={{ fontWeight: 700 }}>tu negocio.</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          top: 399,
          width: 605,
          display: "flex",
          flexDirection: "column",
          fontSize: 25,
          lineHeight: 1.22,
          fontWeight: 400,
          color: INK,
        }}
      >
        <span>Dicta el importe, confírmalo y genera</span>
        <span>un QR CoDi desde tu celular.</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          top: 514,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <div
          style={{
            height: 50,
            padding: "0 20px",
            borderRadius: 999,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#D9F1E8",
          }}
        >
          <img src={assets.micInk} alt="" width={25} height={25} />
          <span style={{ marginLeft: 13, fontSize: 21, fontWeight: 700 }}>
            Cobros por voz
          </span>
        </div>
        <div
          style={{
            height: 50,
            marginLeft: 20,
            padding: "0 19px",
            borderRadius: 999,
            border: `2px solid ${BRAND_TEAL}`,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: CANVAS,
          }}
        >
          <img src={assets.qrInk} alt="" width={26} height={26} />
          <span style={{ marginLeft: 12, fontSize: 21, fontWeight: 700 }}>
            QR CoDi
          </span>
        </div>
      </div>

      {/* Voice interface: editorial illustration, not an active microphone. */}
      <div
        style={{
          position: "absolute",
          left: 672,
          top: 87,
          width: 296,
          height: 470,
          borderRadius: 32,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          boxShadow: "0 20px 45px rgba(23,45,50,0.11)",
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 52,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            height: 52,
          }}
        >
          {[13, 31, 47, 31, 13].map((height, index) => (
            <div
              key={index}
              style={{
                width: 9,
                height,
                marginLeft: index === 0 ? 0 : 10,
                borderRadius: 99,
                backgroundColor:
                  index === 0 || index === 4 ? "#BCE8DC" : BRAND_TEAL,
                display: "flex",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            top: 129,
            left: 18,
            right: 18,
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
            fontSize: 25,
            fontWeight: 700,
            color: INK,
            whiteSpace: "nowrap",
          }}
        >
          “Cobra 125 pesos”
        </div>
        <div
          style={{
            position: "absolute",
            top: 226,
            left: 71,
            width: 154,
            height: 154,
            borderRadius: 999,
            backgroundColor: "#DBF4EA",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 127,
              height: 127,
              borderRadius: 999,
              backgroundColor: BRAND_TEAL,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img src={assets.micWhite} alt="" width={60} height={60} />
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 402,
            left: 45,
            width: 206,
            height: 45,
            borderRadius: 999,
            backgroundColor: "#EDF5F1",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img src={assets.voiceTeal} alt="" width={24} height={24} />
          <span style={{ marginLeft: 11, fontSize: 18, color: MUTED }}>
            Escuchando...
          </span>
        </div>
      </div>

      {/* Recognized amount is illustrative; no payment has been confirmed. */}
      <div
        style={{
          position: "absolute",
          left: 920,
          top: 253,
          width: 249,
          height: 219,
          borderRadius: 28,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          boxShadow: "0 15px 32px rgba(23,45,50,0.10)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 42,
              height: 42,
              borderRadius: 999,
              backgroundColor: MINT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img src={assets.voiceTeal} alt="" width={26} height={26} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 13,
              fontWeight: 700,
              fontSize: 18,
              lineHeight: 1.06,
            }}
          >
            <span style={{ fontWeight: 700 }}>Importe</span>
            <span style={{ fontWeight: 700 }}>reconocido</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: MINT,
            borderRadius: 13,
            height: 57,
            width: 211,
            marginTop: 16,
            fontSize: 26,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          $125.00 MXN
        </div>
        <div
          style={{
            display: "flex",
            width: 210,
            height: 1,
            marginTop: 12,
            backgroundColor: BORDER,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginTop: 13,
            paddingLeft: 5,
          }}
        >
          <img src={assets.qrInk} alt="" width={25} height={25} />
          <span style={{ marginLeft: 11, fontSize: 17, fontWeight: 700 }}>
            Generar QR CoDi
          </span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts,
    },
  );
}
