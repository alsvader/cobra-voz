# CobraVoz — Brand Assets v1.0

**Estado:** compilación verificada — pendiente de aprobación visual final del paquete.  
**Fecha:** 16 de noviembre de 2026  
**Fuente de verdad:** Logo Master v1.0, Ruta A — VoicePay Symbol, composición horizontal A Equilibrada.

## Carpetas

- `source-master/`: copia byte por byte del Logo Master SVG congelado.
- `logos/`: cinco variantes SVG derivadas, con curvas originales y sin fuentes externas.
- `icons/`: favicon SVG, PNG 16/24/32/48, ICO multirresolución, PWA 192/512, maskable 192/512 y Apple Touch 180.
- `review/`: láminas de referencia y validación técnica.
- `QA_REPORT.md`: controles realizados y aspectos pendientes de aprobación visual.
- `QA_MANIFEST.json`: inventario de archivos y hashes SHA-256.
- `FILES_SHA256.txt`: hashes para comprobación de integridad.

## Colores

- Verde exclusivo de logotipo y fondo de los íconos: `#078C7B`.
- Ink de «Cobra» y variante monocromática oscura: `#172D32`.
- Blanco del isotipo en íconos e inversa: `#FFFFFF`.

El color del logotipo `#078C7B` es intencionalmente distinto del token teal principal de la interfaz `#107B75`. No sustituir uno por el otro sin una nueva decisión de branding.

## Uso sugerido

- Logotipo principal: Header, Footer y materiales de marketing en fondos claros.
- Inverso blanco: fondos teal oscuro u otra superficie oscura con contraste suficiente; el SVG no contiene fondo.
- Isotipo independiente: avatar o gráfico de UI.
- `favicon.svg` / `favicon.ico`: favicon del navegador.
- `pwa-icon-192.png`, `pwa-icon-512.png`: PWA con propósito `any`.
- `pwa-maskable-192.png`, `pwa-maskable-512.png`: PWA con propósito `maskable`.
- `apple-touch-icon-180.png`: ícono para la pantalla de inicio en dispositivos Apple.

Los archivos PNG de iconos usan fondo teal opaco. Los SVG de logo tienen fondo transparente.

## Integridad

Ningún trazado del Logo Master se modificó. En los íconos derivados se respetan los cuatro trazados y la transformación interna del isotipo; únicamente se adaptan color, escala global y composición sobre fondo teal. El master original se mantuvo intacto.

## Estado

QA técnico completo; aprobación visual final pendiente. No incluye código de implementación ni un manifiesto operativo de aplicación.
