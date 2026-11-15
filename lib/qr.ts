import qrcode from "qrcode-generator";

/**
 * Zona quieta mínima alrededor del código (DESIGN.md §6.5): 4 módulos.
 * Sin ella muchos lectores bancarios no reconocen el QR.
 */
export const QR_QUIET_ZONE_MODULES = 4;

// Un QR de CoDi puede llevar caracteres fuera de ASCII; por defecto la
// librería trunca cada carácter a 8 bits y el contenido leído no coincidiría con `qrString`.
qrcode.stringToBytes = (text: string) =>
  Array.from(new TextEncoder().encode(text));

/**
 * Matriz de módulos del QR de `text`, tal cual se persistió. Nivel de
 * corrección M. Lanza si el contenido está vacío o no cabe en un QR.
 */
export function qrMatrix(text: string): boolean[][] {
  if (!text) {
    throw new Error("No hay contenido para generar el QR.");
  }
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();

  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
}

/**
 * Trazo SVG (una sola `<path>`) con la zona quieta incluida. Un trazo por cada
 * tramo horizontal de módulos oscuros: pocas instrucciones y bordes nítidos.
 */
export function qrSvgPath(
  matrix: boolean[][],
  quietZone: number = QR_QUIET_ZONE_MODULES,
): { size: number; path: string } {
  const segments: string[] = [];

  matrix.forEach((cells, row) => {
    let col = 0;
    while (col < cells.length) {
      if (!cells[col]) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < cells.length && cells[col]) col += 1;
      segments.push(
        `M${start + quietZone} ${row + quietZone}h${col - start}v1h-${col - start}z`,
      );
    }
  });

  return { size: matrix.length + quietZone * 2, path: segments.join("") };
}
