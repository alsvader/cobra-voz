import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { QR_QUIET_ZONE_MODULES, qrMatrix, qrSvgPath } from "./qr";

/** Rasteriza la matriz (con zona quieta) como lo vería una cámara y la decodifica. */
function decode(text: string, scale = 6): string | null {
  const matrix = qrMatrix(text);
  const { size } = qrSvgPath(matrix);
  const pixels = size * scale;
  const data = new Uint8ClampedArray(pixels * pixels * 4).fill(255);

  matrix.forEach((cells, row) =>
    cells.forEach((dark, col) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px =
            ((row + QR_QUIET_ZONE_MODULES) * scale + y) * pixels +
            (col + QR_QUIET_ZONE_MODULES) * scale +
            x;
          data.fill(0, px * 4, px * 4 + 3);
        }
      }
    }),
  );
  return jsQR(data, pixels, pixels)?.data ?? null;
}

describe("qrMatrix / qrSvgPath", () => {
  it("el QR dibujado se decodifica al mismo contenido (ASCII)", () => {
    const payload =
      "COBRAVOZ-MOCK|3f2b8c1e-0000-4000-8000-000000000001|15050|1234567";
    expect(decode(payload)).toBe(payload);
  });

  it("conserva caracteres no ASCII (UTF-8)", () => {
    expect(decode("Cobro café ñandú 150.50")).toBe("Cobro café ñandú 150.50");
  });

  it("decodifica contenidos largos como los de un QR bancario", () => {
    const payload = JSON.stringify({
      v: 1,
      mon: "MXN",
      imp: "150.50",
      ref: "1234567",
      cta: "0".repeat(18),
      pad: "x".repeat(120),
    });
    expect(decode(payload)).toBe(payload);
  });

  it("la zona quieta mide al menos 4 módulos por lado", () => {
    const matrix = qrMatrix("hola");
    const { size, path } = qrSvgPath(matrix);

    expect(size).toBe(matrix.length + 2 * QR_QUIET_ZONE_MODULES);
    const starts = [...path.matchAll(/M(\d+) (\d+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(Math.min(...starts.map(([x]) => x))).toBeGreaterThanOrEqual(4);
    expect(Math.min(...starts.map(([, y]) => y))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...starts.map(([x]) => x))).toBeLessThan(size - 4);
    expect(Math.max(...starts.map(([, y]) => y))).toBeLessThan(size - 4);
  });

  it("rechaza contenido vacío o que no cabe en un QR", () => {
    expect(() => qrMatrix("")).toThrow();
    expect(() => qrMatrix("x".repeat(5000))).toThrow();
  });
});
