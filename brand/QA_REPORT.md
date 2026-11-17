# CobraVoz — Informe QA de recursos de marca

**Versión:** Paso 2 · Bloque 2.3  
**Fecha:** 16 de noviembre de 2026  
**Resultado:** pruebas técnicas aprobadas; pendiente la revisión visual final del usuario.

## Pruebas realizadas

| Comprobación | Resultado |
|---|---|
| 5 variantes SVG presentes y válidas | Cumple |
| Curvas de los 12 trazados del Logo Master conservadas | Cumple: comparación exacta de atributos `d` |
| SVG principal idéntico byte a byte al master congelado | Cumple |
| SVG sin dependencia de fuentes | Cumple: formas vectoriales `path` |
| Isotipo del favicon: mismos 4 trazados del master | Cumple |
| Favicon PNG de 16, 24, 32 y 48 px | Cumple: tamaños exactos |
| ICO multirresolución (16, 24, 32 y 48 px) | Cumple; cada fotograma coincide píxel a píxel con su PNG |
| PWA estándar de 192 y 512 px | Cumple: tamaños exactos |
| PWA maskable de 192 y 512 px | Cumple: tamaños exactos |
| Apple Touch de 180 px | Cumple: tamaño exacto |
| Fondo de íconos | Cumple: opaco, `#078C7B` en las esquinas |
| Fondo de SVG de logotipo | Transparente |
| Wordmark y Logo Master | No alterados |

## Zona segura maskable

Se inspeccionó la máscara de píxeles claros del isotipo. El valor indicado es la distancia máxima de dichos píxeles al centro, dividida por el tamaño del lienzo. La zona segura admite hasta 0.4000 (40 % del tamaño). Esta prueba cubre el contenido claro del símbolo; el color teal continúa llenando toda la imagen.

| Archivo | Radio máximo medido | Límite | Resultado |
|---|---:|---:|---|
| `pwa-maskable-192.png` | 0.3404 | ≤ 0.4000 | Cumple |
| `pwa-maskable-512.png` | 0.3442 | ≤ 0.4000 | Cumple |

## Corrección de QA aplicada a recursos derivados

Al revisar los primeros íconos se detectó que su exportación había omitido la transformación interna de posicionamiento del grupo SVG `cobravoz-isotype`. Eso desplazaba el símbolo ligeramente hacia la izquierda dentro de los cuadrados. Se regeneraron **únicamente los íconos derivados**, recuperando esa transformación y manteniendo intactos los atributos `d` de los cuatro trazados y sus escalas globales previamente especificadas (estándar/Apple 0.74; maskable 0.62). Se regeneraron los fotogramas del ICO desde cada PNG exacto.

## Pendientes no bloqueantes de producto

- Confirmar visualmente las muestras a tamaños reales, especialmente favicon de 16 px.
- Integrar los archivos y la configuración del manifiesto cuando comience el desarrollo; esta entrega no modifica la aplicación.
- Verificar las vistas en navegadores y dispositivos reales durante QA de desarrollo.

## Archivos visuales de revisión

- `review/favicon-reduction-QA.png`
- `review/pwa-apple-maskable-QA.png`
- `review/logo-variants-reference.png`
