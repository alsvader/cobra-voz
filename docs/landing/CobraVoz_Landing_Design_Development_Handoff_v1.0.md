# CobraVoz — Landing Page Design → Development Handoff

**Versión:** 1.0  
**Fecha:** 15 de noviembre de 2026  
**Estado:** Especificación de implementación consolidada; línea base visual Desktop + Mobile cerrada  
**Ámbito:** Landing page pública de presentación del MVP, no la PWA privada de cobros  
**Idioma:** Español de México (`es-MX`)  
**Diseños de referencia:** 8 secciones Desktop + 8 secciones Mobile, todas como imágenes independientes  
**Stack objetivo:** Next.js 16, React, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide React  
**Entrega:** Markdown + paquete de 16 imágenes originales sin editar

> **Instrucción operativa para implementadores y agentes de IA:** reproducir la experiencia aprobada mediante HTML semántico y componentes reales, no usando imágenes de secciones completas como interfaz. No alterar los documentos funcionales congelados ni regenerar las referencias visuales. Los mockups de pagos son ilustrativos. Ante una contradicción funcional, aplicar la fuente de mayor precedencia; registrar la diferencia antes de proponer una decisión de diseño nueva.

## Índice

1. [Información general y alcance](#1-información-general-y-alcance)
2. [Fuentes de verdad y reglas de implementación](#2-fuentes-de-verdad-y-reglas-de-implementación)
3. [Arquitectura de la landing page](#3-arquitectura-de-la-landing-page)
4. [Design System y tokens visuales](#4-design-system-y-tokens-visuales)
5. [Layouts y sistema responsive](#5-layouts-y-sistema-responsive)
6. [Especificación de las ocho secciones](#6-especificación-de-las-ocho-secciones)
7. [Arquitectura de componentes React](#7-arquitectura-de-componentes-react)
8. [Interacciones, navegación y estados](#8-interacciones-navegación-y-estados)
9. [Accesibilidad y calidad responsive](#9-accesibilidad-y-calidad-responsive)
10. [Recursos visuales y gestión de assets](#10-recursos-visuales-y-gestión-de-assets)
11. [Diferencias detectadas y decisiones de implementación](#11-diferencias-detectadas-y-decisiones-de-implementación)
12. [Checklist de implementación y criterios de aceptación](#12-checklist-de-implementación-y-criterios-de-aceptación)

**Anexos:** [A. Inventario visual](#anexo-a--inventario-de-las-16-referencias-visuales) · [B. Inventario de copy](#anexo-b--inventario-canónico-de-copy) · [C. Trazabilidad](#anexo-c--matriz-de-trazabilidad)

---

## 1. Información general y alcance

### 1.1 Objetivo de la landing

Explicar en español claro la propuesta de valor de CobraVoz a pequeños comerciantes mexicanos, demostrar visualmente cómo se dicta y confirma un importe antes de cobrar mediante CoDi, diferenciar pagos pendientes de verificados y ofrecer un canal para conocer el piloto. La experiencia debe sentirse **confiable, cercana, rápida y amigable**, con un lenguaje «fintech accesible + comercio mexicano contemporáneo».

**Propuesta de valor oficial:** «Cobra fácilmente, sin dejar de atender tu negocio».

**Recorrido comercial:** valor principal → tres pasos → beneficios → confianza bancaria → contextos de uso → preguntas frecuentes → invitación al piloto → navegación legal.

### 1.2 Audiencia

- Principal: persona que atiende un puesto de comida o comercio pequeño y cobra desde su teléfono, incluso en un entorno ruidoso o con conectividad variable.
- Secundaria: comerciantes de mercados y tianguis con necesidades similares.
- Diseño orientado a lectura rápida, grandes objetivos táctiles, explicación sin jerga técnica ni afirmaciones bancarias no verificables.

### 1.3 Incluido en la entrega frontend

- Página pública responsive con **Header, siete secciones comerciales y Footer** (ocho secciones numeradas; Header es parte del marco de la landing, no una novena sección).
- Navegación por anclas, menú móvil, botones de CTA, FAQ accesible, visualizaciones estáticas de P01/P02 y estados de pagos ilustrativos.
- Metadatos SEO básicos y experiencia accesible; carga optimizada de recursos.
- Layouts Desktop/Mobile definidos en este documento; tratamiento adaptativo razonable de anchos intermedios.

### 1.4 Fuera de alcance de esta landing

No se implementarán en la página pública: login, registro de comercios, captura real de voz, creación de QR CoDi real, consultas bancarias, pagos simulados como reales, generación de movimientos de ventas, formularios de onboarding no aprobados, multi-tenant, dashboard, facturación, tarifas, comisiones, compatibilidad universal de bancos ni claims de operación sin internet.

La PWA operativa sí posee módulos de autenticación, voz, QR real con Pey y ventas, pero esos módulos pertenecen al producto privado y están descritos en PRD/UX/Architecture, **no** se implementan dentro del marketing site. Las representaciones de su interfaz en la landing son **previews sin funcionalidad transaccional**.

### 1.5 Supuestos pendientes de definición, sin bloqueo para la maqueta

| ID | Pendiente | Tratamiento en implementación |
|---|---|---|
| PEND-01 | Destino real de «Contactar al equipo» | Componente parametrizable; no inventar URL, correo, WhatsApp ni formulario. No publicar CTA inerte. |
| PEND-02 | Política/URL de privacidad | Preparar enlace accesible; no publicar como enlace roto. Requiere texto legal real. |
| PEND-03 | Confirmación pública de piloto y acceso | Mantener «Conoce el piloto» como invitación informativa, no «Registrarse» ni «Comenzar gratis». |
| PEND-04 | Disponibilidad de UX Specification y Architecture Specification completas | Se mencionan como precedentes congelados, pero no fueron adjuntadas en esta conversación; antes de conectar con la PWA, revisar sus versiones auténticas. |
| PEND-05 | Logo definitivo | Solo wordmark textual temporal en DM Sans; no inventar isotipo final. |

---

## 2. Fuentes de verdad y reglas de implementación

### 2.1 Jerarquía de fuentes

| Precedencia | Fuente | Materia gobernada | Disponibilidad en este handoff |
|---|---|---|---|
| 1 | `CobraVoz_PRD_v1.0.md` | Producto, casos de uso, restricciones, estados y reglas financieras | Archivo adjunto leído directamente: `CobraVoz_PRD_v1.0(1).md` |
| 2 | `CobraVoz_UX_Specification_v1.0.md` | Pantallas, navegación privada, flujo de cobro, estados UX | Referenciada por PRD y DESIGN.md; contenido íntegro no disponible aquí |
| 3 | `CobraVoz_Architecture_Specification_v1.0.md` | Backend, proveedor Pey/CoDi, arquitectura y seguridad | Referenciada por PRD y DESIGN.md; contenido íntegro no disponible aquí |
| 4 | `DESIGN.md` | Tokens base, estética y accesibilidad de la PWA | Archivo adjunto leído directamente: `DESIGN(1).md` |
| 5 | Aprobaciones de landing Desktop/Mobile en esta conversación | Composición, jerarquía comercial, copy y adaptación responsive | Consolidadas aquí por sección |
| 6 | Imágenes high-fidelity de la landing (16) | Tratamiento visual, proporciones e intención estética | Archivadas sin edición en paquete `assets/` |
| 7 | Propuestas técnicas de este handoff | Organización React, breakpoints intermedios y QA | Recomendaciones para implementación, no nuevas decisiones funcionales |

**Nota de alcance:** el orden anterior es por autoridad funcional. Para los detalles específicos de marketing que no están en PRD/UX/Architecture (distribución de las tarjetas, copy comercial aprobado, etc.), las especificaciones de landing congeladas son la fuente directa; `DESIGN.md` aporta los tokens de base.

### 2.2 Reglas de no regresión

1. No modificar ni regenerar ninguna de las 16 imágenes originales.
2. No reescribir títulos, descripciones ni preguntas frecuentes para «simplificar» sin un cambio aprobado.
3. No confundir una visualización ilustrativa con un componente bancario productivo.
4. No declarar un pago «Pagado» antes de disponer de verificación bancaria válida. Para previews, indicar que son **ejemplos** cuando puedan parecer datos reales.
5. No representar «Cerrar cobro» como cancelación bancaria ni pendientes como rechazo.
6. No crear QR de demostración que aparente ser escaneable o útil para transferir dinero.
7. No inventar enlaces externos, logotipos de bancos, certificaciones, métricas de adopción, precios, comisiones ni testimonios.
8. No sustituir la UI responsive por un PNG grande con hotspots invisibles.
9. Mantener variantes Desktop y Mobile visualmente compatibles, no idénticas píxel a píxel.
10. Registrar cualquier conflicto detectado en una tabla de decisiones; no corregir en silencio un diseño congelado.

### 2.3 Excepción cromática aceptada por el usuario

El Hero Desktop generado presenta ligeras variaciones renderizadas de los HEX de `DESIGN.md`; el usuario aprobó expresamente su apariencia y pidió **no corregir la imagen**. Por tanto:

- La **imagen permanece intacta**, igual que el resto de la serie.
- Los **tokens semánticos documentados** siguen partiendo de `DESIGN.md`, porque son la referencia reproducible para CSS.
- No inferir nuevos HEX de píxeles de imágenes generadas como si fueran tokens oficiales.
- Si se necesita una excepción específica para que el sitio preserve una apariencia aprobada, documentarla como decisión de landing, limitarla a su componente y requerir aprobación antes de alterar el sistema global.

### 2.4 Política de cambios

`v1.0` identifica la línea base aprobada para el handoff. Cualquier cambio posterior debe registrar: ID, fecha, sección, motivo, alcance Desktop/Mobile, impacto en copy/función, decisión y versión nueva. La detección de una diferencia en una imagen no implica autorización para generar una imagen reemplazo.

---

## 3. Arquitectura de la landing page

### 3.1 Mapa de secciones y anclas

| Orden | Sección | Componente propuesto | ID de sección / destino |
|---|---|---|---|
| 01 | Hero | `HeroSection` | `inicio` |
| 02 | Cómo funciona | `HowItWorksSection` | `como-funciona` |
| 03 | Beneficios | `BenefitsSection` | `beneficios` |
| 04 | Confianza y verificación | `TrustSection` | `confianza` |
| 05 | Pensado para pequeños negocios | `UseCasesSection` | `para-quien-es` |
| 06 | Preguntas frecuentes | `FAQSection` | `preguntas-frecuentes` |
| 07 | CTA Final | `FinalCTASection` | `contacto` |
| 08 | Footer | `Footer` | `footer` (opcional como referencia interna) |

El **Header**, que aparece sobre el Hero, se considera marco de navegación. No debe repetirse dentro de las demás secciones. Las secciones son componentes de la misma página, no rutas distintas.

### 3.2 Navegación comercial

- **Wordmark CobraVoz:** vuelve al inicio (`#inicio`).
- **Header Desktop:** «Cómo funciona» → `#como-funciona`, «Beneficios» → `#beneficios`, «Contacto» → `#contacto`.
- **Header Mobile:** mismo conjunto dentro de un menú de navegación compacto.
- **Hero CTA principal:** «Conoce el piloto» → `#contacto`, lugar donde se ofrece el canal de contacto. No equivale al acceso a la PWA privada.
- **Hero CTA secundario:** «Cómo funciona» → `#como-funciona`.
- **Footer / Explora:** «Cómo funciona» → `#como-funciona`; «Beneficios» → `#beneficios`; «Para quién es» → `#para-quien-es`.
- **Footer / Ayuda:** «Preguntas frecuentes» → `#preguntas-frecuentes`; «Contacto» → `#contacto`.
- **Footer / Privacidad:** URL legal real, pendiente PEND-02.
- **CTA Final:** «Contactar al equipo» → canal real pendiente PEND-01.

La navegación interna debe respetar el foco del usuario y evitar que un encabezado fijo o sticky oculte el título de una sección.

### 3.3 Metadatos públicos recomendados (no copy aprobado del contenido)

- Título de página SEO propuesto: `CobraVoz | Cobra con tu voz y sigue atendiendo tu negocio`.
- Descripción meta propuesta: una frase basada en el Hero aprobado, evitando promesas de instantaneidad, bancos universales o alta pública.
- Idioma HTML `es-MX`, un solo H1 y títulos H2 por sección.
- Open Graph y favicon solo con recursos autorizados disponibles; no fabricar logotipo definitivo.

La redacción de metadatos SEO es una sugerencia técnica y no cambia el copy de la landing.

---

## 4. Design System y tokens visuales

### 4.1 Dirección estética

«Fintech accesible + comercio mexicano contemporáneo». Light-first, superficies cálidas casi blancas, turquesa como acento de acción, texto de alta legibilidad, bordes suaves y elevación discreta. Evitar estética bancaria fría, clichés folclóricos, neón, glassmorphism, dashboards complejos, mascotas y fotografía genérica. Las curvas orgánicas muy sutiles de las referencias high-fidelity de la landing están permitidas como decoración específica del marketing site, sin alterar la sobriedad de la PWA.

### 4.2 Tokens primitivos oficiales (`DESIGN.md`)

| Token | Valor | Rol |
|---|---|---|
| `--color-teal-700` | `#0E635F` | Hover/active, texto de énfasis |
| `--color-teal-600` | `#107B75` | CTA principal, navegación destacada, micrófono |
| `--color-teal-100` | `#E3F1EF` | Superficies suaves |
| `--color-ink-900` | `#172D32` | Títulos y texto principal |
| `--color-ink-600` | `#506369` | Cuerpo y texto secundario |
| `--color-ink-400` | `#6C7C80` | Texto terciario, sujeto a contraste |
| `--color-canvas` | `#F6F8F5` | Fondo general |
| `--color-surface` | `#FFFFFF` | Tarjetas, superficies elevadas |
| `--color-surface-muted` | `#EDF3EF` | Paneles y fondos de contenido |
| `--color-border` | `#D7E3DE` | Bordes y divisores |
| `--color-terracotta-700` | `#AA4930` | Acentos cálidos secundarios |
| `--color-terracotta-100` | `#F9EDE2` | Acentos cálidos suaves |
| `--color-focus` | `#0E635F` | Anillo de foco |

### 4.3 Colores semánticos para previews de pagos

| Estado | Texto / ícono | Fondo | Leyenda obligatoria |
|---|---|---|---|
| Verificado | `#15593E` | `#E8F5EF` | «Pago recibido», «Pagado» |
| Pendiente | `#855716` | `#FCF3DE` | «Esperando pago» o «Pago sin confirmar» |
| Operación con error | `#A52C35` | `#FDEBEC` | Mensaje concreto |
| Consultando/verificando | `#0C5A56` | `#E3F1EF` | «Verificando» o «Consultando» |
| Incidencia | `#8D3E22` | `#F9EDE2` | «Incidencia» |
| Expirado / cerrado local | `#506369` | `#EDF3EF` | Estado explícito |

La landing muestra ejemplos de «Esperando pago» y «Pago recibido»; su uso **no debe implicar información financiera en tiempo real**. No usar exclusivamente color para comunicar el resultado, y nunca reutilizar el check de éxito en un pago pendiente.

### 4.4 Mapeo semántico a shadcn/ui

| Semántica | Valor oficial |
|---|---|
| `background` / `foreground` | `#F6F8F5` / `#172D32` |
| `card` / `card-foreground` | `#FFFFFF` / `#172D32` |
| `primary` / `primary-foreground` | `#107B75` / `#FFFFFF` |
| `secondary` / `secondary-foreground` | `#E3F1EF` / `#0E635F` |
| `muted` / `muted-foreground` | `#EDF3EF` / `#506369` |
| `accent` / `accent-foreground` | `#F9EDE2` / `#8D3E22` |
| `destructive` / `destructive-foreground` | `#A52C35` / `#FFFFFF` |
| `border`, `input`, `ring` | `#D7E3DE`, `#D7E3DE`, `#0E635F` |
| Radio base | `14px` |

**Regla:** no aplicar los estilos shadcn predeterminados cuando contradigan estos valores. Utilizar alias semánticos en el sitio. No copiar todos los HEX dentro de cada componente.

### 4.5 Tipografía

- **Familia:** DM Sans variable; respaldo `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Pesos:** 400, 500, 600 y 700.
- **Convención:** sentence case, excepto etiquetas eyebrow aprobadas en mayúsculas; puntuación y acentos de `es-MX`.
- **Montos:** números tabulares, símbolo `$`, dos decimales y aclaración «MXN» cuando el contexto no sea inequívoco.

| Estilo de landing | Desktop propuesto | Mobile propuesto | Uso |
|---|---|---|---|
| Hero H1 | 56 px / ~1.1 / 700 | 36 px a 375–390; 32 px a 320; hasta 40 px a 430 | Solo Hero |
| H2 de sección (común) | 44 px / ~1.1–1.2 / 700 | 30–34 px / ~1.15 / 700 | Secciones 02, 03, 05, 06 |
| H2 Confianza | 44 px / 700 | 34–36 px / 700 | Sección 04 |
| H2 CTA Final | 52 px / ~1.1 / 700 | 34–36 px / 700 | Sección 07 |
| Eyebrow | 14 px / 600–700 | 13–14 px / 600–700 | Etiquetas superiores |
| Subtítulo de sección | 18 px / 400 | 16 px / 400 | Resumen debajo del H2 |
| Título tarjeta común | 22–26 px / 600–700 | 20–24 px / 600–700 | Pasos/beneficios/casos |
| Cuerpo | 16–18 px / 400 | 15–16 px / 400 | Texto editorial |
| Pregunta FAQ | 18 px / 600 | 16–17 px / 600 | Título interactivo |
| Respuesta FAQ | 16 px / 400 | 15–16 px / 400 | Texto expandido |
| Total ilustrativo | 32–36 px / 700 | 32–36 px / 700 | Previews de pagos/ventas |
| Wordmark de Footer | 28 px / 700 | 28 px / 700 | Identidad temporal |

La escala **comercial** es una extensión de la escala de la PWA, no debe modificar los tamaños definidos para P01–P04 en `DESIGN.md`.

### 4.6 Espaciado y tamaños

**Escala base:** 4, 8, 12, 16, 20, 24, 32, 40, 48 px, siguiendo `DESIGN.md`. Para bloques amplios de marketing se permiten múltiplos derivados de la misma escala (56, 64, 72, 80, 88, 96, 112 px).

| Componente visual | Medida |
|---|---|
| Contenedor central Desktop | 1200 px máximo |
| Padding lateral en Desktop amplio | 48 px |
| Padding lateral 360–430 px | 20 px |
| Padding lateral 320–359 px | 16 px |
| Botón principal | Altura 56 px; 16 px/600; radio 14 px |
| Botón secundario | 48–56 px; en Hero Mobile 52–56 px |
| Objetivo táctil mínimo | 44 × 44 px |
| Separación botones apilados | 12 px |
| Radio `sm / md / lg / xl / full` del sistema | 8 / 12 / 16 / 24 / 9999 px |
| Radio tarjetas marketing | 16–24 px según sección aprobada |
| Radio contenedor CTA | 32 px Desktop; 28 px Mobile |
| Borde estándar | 1 px sólido `#D7E3DE` |
| Sombra tarjeta base | `0 3px 12px rgba(23,45,50,0.06)` |
| Sombra de foco base | `0 0 0 3px rgba(16,123,117,0.24)` |

### 4.7 Íconos y motion

- Íconos Lucide con stroke aproximado 2: `mic`, `house`, `receipt-text`, `settings`, `clock-3`, `check-circle-2`, `shield-check`, `utensils-crossed`, `store`, `shopping-bag`, `smartphone`, `plus`, `minus`, `menu`, `arrow-up-right`, según sección.
- Transiciones de hover/foco 150–200 ms, `ease-out`, como máximo 250 ms para motion no crítico.
- Respetar `prefers-reduced-motion: reduce`; no introducir pulsos bancarios, falsas transiciones de estado ni reproducción de audio en la landing.
- La sección 07 utiliza formas curvas de variación tonal **sutiles** ya visibles en la referencia. No traducirlas en gradientes fuertes o vidrio difuminado.

---

## 5. Layouts y sistema responsive

### 5.1 Estrategia

Mobile-first. Las imágenes Mobile corresponden a una intención de viewport de **390 px**, aunque el archivo raster renderizado tenga más píxeles; sus dimensiones de imagen no son medidas CSS. El contenido debe ajustarse al viewport real y permitir crecimiento vertical sin `height` fijo ni cortes.

| Anchura | Objetivo de validación | Regla |
|---|---|---|
| 320 px | Teléfono estrecho | 16 px de margen; no overflow; tipografía compacta |
| 360 px | Teléfono compacto | 20 px cuando quepa |
| 375 px | Teléfono común | Escala H1 36 px aprox. |
| 390 px | Referencia high-fidelity | 20 px lateral, layout mobile aprobado |
| 430 px | Teléfono amplio | Mantener una columna; H1 hasta 40 px si cabe |
| 768 px | Tablet/intermedio | Reflujo progresivo; evitar dejar columnas comprimidas |
| 1024 px | Desktop compacto | Evaluar transición a composiciones de varias columnas |
| 1200 px+ | Desktop ancho | Contenedor máximo 1200 px, márgenes exteriores automáticos |

Los 768 y 1024 px son **puntos de prueba y recomendaciones** para el espacio intermedio; no son capturas aprobadas ni obligan a cambiar de layout exactamente en esos valores. Cambiar a varias columnas solo cuando el contenido conserve tamaños, legibilidad y separación adecuados.

### 5.2 Matriz de distribución

| Sección | Desktop | Mobile | Reglas clave |
|---|---|---|---|
| 01 Hero | 54% texto / 46% mockup | Header, badge, H1, descripción, 2 CTA apilados y mockup centrado | CTA antes del mockup en Mobile |
| 02 Cómo funciona | 3 tarjetas del mismo ancho | 3 tarjetas apiladas; texto arriba, interfaz debajo | **No** reproducir layout interior horizontal del PNG Mobile |
| 03 Beneficios | Bento 1 tarjeta grande izquierda + 2 apiladas derecha | Stacked Bento: 1 tarjeta protagonista + 2 compactas | **Sin** gráfico de barras |
| 04 Confianza | Split 42% copy / 58% estados | Copy → confianza bancaria → 2 estados apilados | Alineación izquierda, estados separados |
| 05 Casos de uso | Editorial Split 44% copy / 56% tres filas | Copy + cápsula + tres tarjetas apiladas | Ícono y título en fila, descripción debajo |
| 06 FAQ | Acordeón centrado de máximo 860 px | Una columna de ancho disponible | Primera respuesta abierta inicialmente |
| 07 CTA Final | Panel turquesa grande centrado | Panel turquesa vertical con botón blanco ancho completo | Sin Footer, sin otro CTA |
| 08 Footer | Marca 50%, Explora 25%, Ayuda 25% | Marca arriba y 2 columnas de navegación | Padding superior real: 48 px |

### 5.3 Alineación y alturas

- Encabezados centrados: **02, 03, 06, 07**. Encabezados a la izquierda: **01, 04, 05**.
- Sección 01 Desktop: Hero aproximado de 680–720 px; en Mobile la altura es **automática**.
- Secciones 02–06: altura `auto` tanto en Mobile como en Desktop; los tamaños del diseño son objetivos visuales, no límites de contenido.
- Sección 07: panel ~440–480 px Desktop como referencia; altura automática en Mobile.
- Sección 08: Footer ~300–340 px Desktop como intención; **sin reproducir el gran vacío superior** de la imagen Mobile.
- Los bordes y sombras no deben provocar desbordamiento horizontal; los importes de preview no pueden cortarse.

### 5.4 Espacios verticales por sección

| Sección | Desktop | Mobile |
|---|---|---|
| 01 | ~64 px después de Header y 80 px abajo | Header 64 px; 40 px hasta eyebrow; 64 px final |
| 02 | 112 px arriba/abajo; 56 px encabezado→tarjetas | 80 px arriba, 88 px abajo; 40 px encabezado→tarjetas |
| 03 | 112 px arriba/abajo | 80 px arriba, 88 px abajo; 40 px encabezado→tarjetas |
| 04 | 96–112 px afuera; panel con 64 px internos | 80 px arriba; panel interno 20 px; separaciones 24–32 px |
| 05 | Bloque de 560–620 px aprox. | 80 px arriba; 40 px cápsula→tarjetas |
| 06 | 112 px arriba/abajo | 80 px arriba y 88 px abajo; 40 px encabezado→FAQ |
| 07 | Panel con 80 px internos | Margen exterior vertical 64 px; padding interior 56–64 px |
| 08 | 72 px superior, 32 px inferior | 48 px superior, 32 px inferior |

---

## 6. Especificación de las ocho secciones

### 6.1 SECTION-01 — Hero

**Objetivo:** explicar de inmediato que CobraVoz permite crear cobros por voz y QR CoDi desde el celular, con confirmación explícita del importe y pago verificado.

**Copy aprobado:**

- Eyebrow: **«Cobros por voz + CoDi»**.
- H1: **«Cobra con tu voz. Sigue atendiendo tu negocio.»**
- Descripción: **«Di el importe, confirma la cantidad y muestra un QR CoDi para recibir el pago. CobraVoz te avisa cuando el pago está verificado.»**
- CTA principal: **«Conoce el piloto»**.
- CTA secundario: **«Cómo funciona»**.

**Desktop v1.0:** Header superior (wordmark izquierda; links «Cómo funciona», «Beneficios», «Contacto» derecha); contenedor 1200 px; distribución 54/46; columna de texto verticalmente centrada; H1 ~56 px y ancho de lectura ~540 px; subtítulo ~18 px; botones horizontales de 56 px con separación 12 px. A la derecha, teléfono frontal en marco oscuro con fondo turquesa claro orgánico. El mockup refleja **P01 Inicio**: `CobraVoz`, nombre del comercio, configuración, «Nuevo cobro», micrófono, «Hablar para cobrar», «Ingresar importe manualmente», «Total cobrado hoy», importe y navegación Inicio/Ventas. No simular un QR en esta pantalla.

**Mobile v1.0:** Header de 64 px (wordmark izquierda y botón menú ≥44 px derecha). Columna única, 20 px laterales a 390 px. Orden exacto: eyebrow, H1, subtítulo, CTA principal, CTA secundario, teléfono P01 centrado y sin recorte esencial. H1 ~36 px; subtítulo 16 px. Botones de ancho completo, principal 56 px de alto, secundario 52–56 px y separación 12 px. Separación CTA→mockup 48 px. El dispositivo conserva la interfaz y tratamiento frontal aprobados, aunque su tamaño visual se reduzca a ~290–310 px de ancho en el layout real.

**Interacciones:** Header por anclas; «Conoce el piloto» a `#contacto`; «Cómo funciona» a `#como-funciona`; menú móvil accesible. **El micrófono dentro del mockup es ilustrativo**, no inicia reconocimiento real desde el marketing site.

**Invariantes/aceptación:** un solo H1; copy idéntico; no prometer cobros hands-free sin confirmación; no CTA de registro público; mockup legible y centrado; hero responsive sin `100vh` obligatorio; Desktop congelado intacto.

### 6.2 SECTION-02 — Cómo funciona

**Objetivo:** explicar el proceso aprobado en tres acciones consecutivas, sin eliminar la confirmación del importe.

**Copy de sección:** Eyebrow **«CÓMO FUNCIONA»**; H2 **«Tres pasos para cobrar con CobraVoz.»**; subtítulo **«Desde dictar el importe hasta verificar el pago.»**.

| Paso | Título canónico | Descripción canónica | Preview requerido |
|---|---|---|---|
| 01 | **Di cuánto quieres cobrar** | «Presiona el micrófono y di la cantidad. También puedes ingresar el importe manualmente.» | «Nuevo cobro», micrófono turquesa, «Hablar para cobrar», opción manual. |
| 02 | **Confirma y genera tu QR** | «Revisa que la cantidad sea correcta y confírmala. CobraVoz genera un QR CoDi para que tu cliente pueda pagar.» | «Importe a cobrar», `$85.00`, «MXN · Ejemplo ilustrativo», botón «Confirmar importe». |
| 03 | **Verifica el pago** | «Tu cliente paga con CoDi. CobraVoz muestra la confirmación cuando el pago se ha verificado.» | Ícono check de éxito, «¡Pago recibido!», `$85.00`, «Pago verificado · Ejemplo». |

**Desktop v1.0:** encabezado centrado, H2 ~44 px, tres tarjetas de anchura equivalente en una fila, gap 24 px, padding interno ~28 px, radio ~20 px, alto visual ~380–420 px como referencia. Cada tarjeta muestra su número, título, descripción y fragmento de UI inferior. Superficies blancas y bordes pálidos.

**Mobile v1.0:** encabezado centrado y tres tarjetas **apiladas verticalmente** a todo el ancho disponible, gap 20 px, padding ~20 px. **Estructura interna obligatoria: número → título → descripción → preview UI debajo**, con alturas automáticas. El PNG generado accidentalmente distribuye texto e interfaz en dos columnas dentro de cada tarjeta: **no reproducir ese detalle** (OBS-01). H2 30–32 px, títulos de tarjeta ~22 px, cuerpo 15–16 px, montos 32–36 px. Ningún texto se trunca.

**Interacciones:** tarjetas meramente informativas; los botones que aparecen **dentro de los fragmentos de UI son ilustrativos**, no acciones de pago. No requiere botón comercial propio ni QR real/falso.

**Invariantes/aceptación:** tres pasos exactamente; confirmación siempre antes de QR; éxito solo como ejemplo bancario verificado; layout Mobile realmente vertical; mismo texto que la especificación congelada.

### 6.3 SECTION-03 — Beneficios

**Objetivo:** explicar los tres beneficios del MVP sin convertir la landing en dashboard.

**Copy de sección:** Eyebrow **«BENEFICIOS»**; H2 **«Menos pasos para cobrar. Más claridad en cada venta.»**; subtítulo **«Una herramienta sencilla para el ritmo de tu negocio.»**.

| Beneficio | Título canónico | Descripción canónica | Preview |
|---|---|---|---|
| Principal | **Menos pasos para cobrar** | «Dicta el importe, revísalo y confirma. También puedes escribir la cantidad cuando lo necesites.» | Fragmento P01 con micrófono y pantalla «Nuevo cobro». |
| Secundario A | **Pagos claros y verificables** | «Distingue fácilmente cuándo un pago sigue pendiente y cuándo ha sido verificado.» | Badges independientes «Esperando pago» y «Pago recibido». |
| Secundario B | **Tus ventas a la vista** | «Consulta cuánto has cobrado hoy y revisa tus movimientos recientes desde tu celular.» | «Total cobrado hoy», `$850.00`, «7 pagos confirmados» como **ejemplo ilustrativo**. |

**Desktop v1.0:** Bento Grid de dos columnas: bloque grande izquierda (voz) y dos bloques apilados derecha. Tarjetas blancas con radios ~20–24 px; micrófono y teléfono protagonistas en la primera; badges comparativos en la segunda; resumen compacto en la tercera. H2 ~44 px.

**Mobile v1.0:** **Mobile Stacked Bento**: primero tarjeta grande con ícono/título/copy y teléfono parcialmente recortado por su propio panel inferior (recorte decorativo del mockup aprobado, no de controles esenciales), después tarjeta de estados con badges apilados, por último resumen de ventas. Tres tarjetas a 350 px aprox. de ancho útil en viewport 390. Padding interior 20 px, gap 20 px, H2 30–32 px y montos ~32–36 px.

**Interacciones:** estático, sin botones transaccionales ni gráficos.

**Invariantes/aceptación:** **no implementar el pequeño gráfico de barras introducido por la imagen Mobile** (OBS-02), porque PRD y DESIGN.md excluyen gráficas del MVP. Mostrar montos y conteos solo como datos de muestra etiquetados. No agregar porcentajes, ventas inventadas ni filtros.

### 6.4 SECTION-04 — Confianza y verificación de pagos

**Objetivo:** dejar inequívoco que una afirmación verbal o captura no es confirmación bancaria; separar visualmente pendiente de pagado.

**Copy canónico:**

- Eyebrow: **«PAGOS CON CLARIDAD»**.
- H2: **«El pago se confirma, no se supone.»**
- Descripción: **«CobraVoz te muestra cuándo un pago sigue pendiente y cuándo ha sido verificado. Sin depender de capturas de pantalla ni de confirmaciones verbales.»**
- Subbloque: **«Confirmación bancaria verificable»**.
- Explicación subbloque: **«CobraVoz utiliza la integración Pey/CoDi para consultar y verificar el estado del cobro.»**
- Estado A: **«Esperando pago»**; `$85.00`; **«Aún no se ha confirmado el pago.»**
- Estado B: **«Pago recibido»**; `$85.00`; **«Pago verificado correctamente.»**; **«Referencia ilustrativa: CV-0085»**.

**Desktop v1.0:** Split Layout 42/58 dentro de un gran panel turquesa pálido de radio ~28 px. Izquierda: eyebrow, H2, descripción, aviso suave con ícono escudo. Derecha: dos tarjetas blancas de estados bancarios apiladas (pendiente ámbar y verificado verde), importes grandes, texto legible. Panel interno ~64 px; separación de columnas ~64 px; sin CTA comercial adicional.

**Mobile v1.0:** panel de una columna. Orden exacto: eyebrow → H2 alineado izquierda → descripción → tarjeta de verificación con escudo → tarjeta «Esperando pago» → tarjeta «Pago recibido». Padding exterior 16–20 px, panel interior ~20 px, gap 24–32 px, radio ~28 px, tarjetas de radio ~20 px. H2 ~34–36 px, importe ~36 px, sin alturas rígidas. Las dos tarjetas son **ejemplos independientes**, no una animación de progresión bancaria real.

**Interacciones:** ninguno en los previews; no simular polling ni confirmar una operación por temporizador. No se permite comprobar el banco desde la landing.

**Invariantes/aceptación:** color + texto + ícono distintos; no «pagado» cuando sea «pendiente»; no afirmar garantías ni pago instantáneo; preservar `Pey/CoDi` y distinción entre verificación y afirmación del comprador.

### 6.5 SECTION-05 — Pensado para pequeños negocios

**Objetivo:** que comerciante individual reconozca casos cotidianos de uso de CobraVoz sin introducir funciones de punto de venta o inventario.

**Copy de sección:** Eyebrow **«PENSADO PARA TU NEGOCIO»**; H2 **«Hecho para quienes atienden y cobran al mismo tiempo.»**; descripción **«Desde un puesto de comida hasta un local de mercado, CobraVoz está pensado para comerciantes que necesitan cobrar de forma sencilla desde su celular.»**; cápsula **«Desde tu celular»**.

**Casos de uso y copy:**

1. **Puestos de comida** — «Entre preparar pedidos, entregar productos y atender clientes, cada paso cuenta. Dicta el importe, revísalo y genera tu cobro desde el celular.»
2. **Mercados y tianguis** — «Cuando atiendes a varios clientes durante el día, necesitas saber qué cobros ya fueron confirmados. CobraVoz te permite consultar el estado de cada operación.»
3. **Pequeños comercios** — «Para negocios que necesitan cobrar y continuar atendiendo. Revisa el total cobrado hoy y consulta tus movimientos recientes desde un mismo lugar.»

> Los textos de las imágenes generadas se condensaron en algunos casos. Las redacciones anteriores proceden del **desglose aprobado antes de generar Desktop**; se conservan como contenido canónico completo. Si se requiere acortar por consideraciones reales de layout, documentar un cambio de copy en lugar de adoptarlo silenciosamente de la imagen.

**Desktop v1.0:** Editorial Split 44/56. Izquierda: eyebrow, H2, descripción y cápsula «Desde tu celular». Derecha: tres tarjetas editoriales horizontales apiladas; iconos `utensils-crossed`, `store`, `shopping-bag`. Contenedor máximo 1200 px; separación entre columnas ~80 px; tarjetas de alto de referencia 136–152 px, padding ~24 px, radio 20 px y gap ~20 px.

**Mobile v1.0:** encabezado alineado izquierda; descripción completa; cápsula; tres tarjetas apiladas. Dentro de cada tarjeta, **ícono y título en primera fila; descripción debajo**; padding 20–24 px, radio 20 px, gap 16 px, altura automática. Viewport 390 px con márgenes 20 px. Evitar una segunda columna estrecha a nivel de sección.

**Interacciones:** tarjetas informativas no clicables. No reproducir posibles flechas decorativas de wireframes que den falsa apariencia de enlace.

**Invariantes/aceptación:** tres casos de uso y no otros; mismos íconos y copy canónico; no fotografías ni folclorismo decorativo; sin CTA adicional.

### 6.6 SECTION-06 — Preguntas frecuentes

**Objetivo:** responder dudas operativas de un potencial usuario del piloto sin tecnicismos y sin introducir nuevas funcionalidades.

**Copy de encabezado:** Eyebrow **«PREGUNTAS FRECUENTES»**; H2 **«¿Tienes dudas? Aquí te ayudamos.»**; subtítulo **«Todo lo que necesitas saber sobre cómo funciona CobraVoz.»**.

**Preguntas y respuestas canónicas:** ver [Anexo B](#anexo-b--inventario-canónico-de-copy), donde se incluyen las seis respuestas completas. Se listan aquí los títulos y su orden obligatorio:

1. «¿Necesito descargar una aplicación?»
2. «¿Qué pasa si no funciona el micrófono?»
3. «¿Cómo sé si realmente recibí el pago?»
4. «¿Qué sucede si el pago sigue pendiente?»
5. «¿Funciona sin conexión a internet?»
6. «¿Puedo registrar mi negocio?»

**Desktop v1.0:** encabezado centrado y acordeón de una columna, ancho máximo 860 px; sección 1200 px máximo; separación de ítems 12 px; padding tarjetas ~24 px; radio 16 px, fondo blanco; primera pregunta expandida y cinco contraídas; título sección ~44 px.

**Mobile v1.0:** una columna con margen lateral 20 px a 390; encabezado centrado; FAQ ancho disponible; padding de tarjeta ~20 px; radio 16–20 px; preguntas 16–17 px; respuestas 15–16 px. Primer elemento expandido con divisor y texto completo; los otros cinco contraídos.

**Interacciones:** una sola pregunta abierta a la vez, o ninguna al cerrar la actual; `aria-expanded`, asociación a su panel, operación por teclado y foco claro. Ícono `minus` abierta, `plus` cerrada. Cualquier parte del encabezado funciona como botón, no solo el ícono. Transición 150–200 ms o instantánea con reducción de movimiento.

**Invariantes/aceptación:** las seis preguntas exactas, primera expandida inicialmente; sin respuestas inventadas sobre precios o bancos compatibles; enlaces y botón de registro no presentes; el contenido abierto no se corta por altura fija.

### 6.7 SECTION-07 — CTA Final

**Objetivo:** cerrar el recorrido con una sola invitación a conocer el piloto y contactar al equipo, sin prometer alta pública.

**Copy canónico:**

- Eyebrow: **«CONOCE COBRAVOZ»**.
- H2: **«Haz que cobrar sea más sencillo.»**
- Descripción: **«Descubre una forma de cobrar con tu voz y seguir atendiendo lo que más importa: tu negocio.»**
- Botón único: **«Contactar al equipo»**.

**Desktop v1.0:** gran panel turquesa ~1200 px máximo, altura visual ~440–480 px, radio 32 px, padding interior ~80 px. Todo centrado. H2 blanco ~52 px, descripción blanca ~18 px, botón blanco con texto turquesa oscuro, altura 56 px, radio 14 px. Curvas/variaciones tonales sutiles ya presentes en la imagen aprobada.

**Mobile v1.0:** mismo contenido y orden, panel turquesa vertical con radio 28 px; 20 px de margen exterior en viewport 390, 24 px padding interior horizontal y 56–64 px vertical. Eyebrow ~13 px, H2 ~34–36 px, descripción 16 px centrada y botón único blanco **a todo el ancho útil**, 56 px de alto. No imponer altura fija ni requerir que el título tenga exactamente dos líneas.

**Interacción:** CTA requiere destino real PEND-01. Puede abrir correo, canal o formulario **solo cuando se apruebe** el mecanismo específico. No dejar enlace vacío ni suponer un WhatsApp/correo.

**Invariantes/aceptación:** no incluir Footer dentro de la sección 07; un solo botón; no agregar teléfonos, formularios, precios ni links promocionales nuevos.

### 6.8 SECTION-08 — Footer

**Objetivo:** cierre discreto con identidad, navegación secundaria y privacidad; sin competir con el CTA turquesa anterior.

**Copy y navegación:**

- Wordmark temporal: **«CobraVoz»**.
- Slogan: **«Cobra fácilmente, sin dejar de atender tu negocio.»**
- Columna **Explora**: «Cómo funciona», «Beneficios», «Para quién es».
- Columna **Ayuda**: «Preguntas frecuentes», «Contacto».
- Barra legal: **«© 2026 CobraVoz»** y **«Privacidad»**.

**Desktop v1.0:** fondo `#F6F8F5`; línea fina superior; tres columnas de proporciones 50/25/25 (marca, Explora, Ayuda), contenedor 1200 px, padding superior 72 px, inferior 32 px, separación columnas ~64 px. Wordmark DM Sans Bold 28 px, slogan 16 px; links 15 px. Divisor y franja legal inferior con copyright a la izquierda y privacidad a la derecha. La imagen final no incluye el CTA anterior.

**Mobile v1.0:** **marca y slogan arriba**; debajo, **Explora/Ayuda en dos columnas**; un divisor y franja legal con copyright/privacidad en lados opuestos cuando haya ancho. Márgenes laterales 20 px a 390; padding superior **48 px** y final 32 px; espacio marca→navegación ~40 px; gap columnas ~24 px; navegación→divisor ~48 px; separación entre enlaces 16–20 px. Si un nombre largo envuelve a dos líneas, mantener la legibilidad. **No reproducir el vacío excesivo de la imagen Mobile** (OBS-03).

**Interacciones:** enlaces de ancla y privacidad real; wordmark al inicio. No redes sociales ficticias, enlaces legales sin destino o CTA adicional. En Mobile, cada enlace debe ofrecer blanco táctil suficiente sin tratarlo como tarjeta.

**Invariantes/aceptación:** textos exactos; copyright aprobado «© 2026 CobraVoz» (revisar el año en un proceso formal si se publica en otro año, no cambiar silenciosamente el arte aprobado); no incluir CTA Final dentro del Footer.

---

## 7. Arquitectura de componentes React

### 7.1 Propuesta de módulos (sin código de implementación)

| Grupo | Componente | Responsabilidad |
|---|---|---|
| Layout | `LandingPage` | Orquestar orden de secciones y encabezado |
| Layout | `SiteHeader` | Wordmark y navegación Desktop |
| Layout | `MobileNavigation` | Menú compacto accesible con destinos equivalentes |
| Layout | `SectionContainer` | Max-width, gutters y espaciado común |
| Layout | `SiteFooter` | Marca, navegación secundaria y legal |
| Secciones | `HeroSection` | Copy, CTAs y preview P01 |
| Secciones | `HowItWorksSection` | Tres pasos y previews de interfaz |
| Secciones | `BenefitsSection` | Bento Desktop / Bento apilado Mobile |
| Secciones | `TrustSection` | Mensaje de confianza y estados ilustrativos |
| Secciones | `UseCasesSection` | Editorial + tres casos |
| Secciones | `FAQSection` | Lista accesible de seis preguntas |
| Secciones | `FinalCTASection` | Panel turquesa y botón de contacto |
| Compartidos | `SectionHeading` | Eyebrow, título y descripción con variantes alineación |
| Compartidos | `MarketingCTA` | CTA principal, secundario y variante inversa |
| Compartidos | `ContentCard` | Superficies reutilizables, borde y sombra |
| Compartidos | `PaymentStatePreview` | Badges y tarjeta **estática** de pendiente/recibido |
| Compartidos | `AppScreenPreview` | Recreación no transaccional de P01/P02 |
| Compartidos | `DailySummaryPreview` | Resumen ficticio de ventas sin gráficas |
| Compartidos | `UseCaseCard` | Ícono, título y cuerpo |
| Compartidos | `FAQItem` | Pregunta/expansión accesible |

### 7.2 Reglas de reutilización

- Las componentes `PaymentStatePreview`, `AppScreenPreview` y `DailySummaryPreview` son **presentacionales** y no deben importar SDK bancario, credenciales, session store privado ni dependencias de cobro.
- `SectionHeading` admite centrado o alineado a izquierda, sin permitir estilos arbitrarios que rompan el design system.
- Los datos repetidos de tarjetas y FAQs pueden definirse como contenido estático estructurado, pero el orden y el copy canónico no deben cambiar.
- Los botones con comportamiento de navegación deben ser enlaces semánticos; no usar un `div` clicable.
- Las previsualizaciones de UI deben distinguir claramente acciones simuladas de los controles reales de la landing. No colocar botones interactivos que den la impresión de cobrar dinero.
- `MobileNavigation` debe compartir destinos con Desktop, evitando mantener dos listas contradictorias.

### 7.3 Separación de responsabilidades

El sitio comercial no comparte lógica de cobro con P01/P02/P03 de la app privada. Puede compartir tipografía, tokens y representaciones de pantalla, pero **no** el ciclo de vida financiero. El estado abierto/cerrado de FAQ o menú es único estado local público previsto; no requiere backend. La navegación a contacto no debe depender de autenticación.

### 7.4 Organización sugerida de archivos, solo conceptual

- `landing/layout/`: Header, menú, contenedor, Footer.
- `landing/sections/`: ocho secciones.
- `landing/ui/`: heading, botones, tarjetas, previews y acordeón.
- `landing/content/`: copys y elementos repetidos en español.
- `landing/styles/`: alias de tokens de marketing si son necesarios y están aprobados.

Este apartado describe **responsabilidades**, no ordena una reestructuración de la aplicación existente y no incluye código de implementación.

---

## 8. Interacciones, navegación y estados

### 8.1 Matriz funcional

| ID | Superficie | Acción | Resultado esperado |
|---|---|---|---|
| INT-01 | Wordmark en Header | Seleccionar | Navegar al inicio |
| INT-02 | Links Header Desktop | Seleccionar | Scroll/ancla a sección correcta |
| INT-03 | Menú Header Mobile | Abrir/cerrar | Mostrar/ocultar navegación accesible |
| INT-04 | Link del menú móvil | Seleccionar | Navegar a destino y cerrar menú |
| INT-05 | Hero «Conoce el piloto» | Seleccionar | Navegar a `#contacto` |
| INT-06 | Hero «Cómo funciona» | Seleccionar | Navegar a `#como-funciona` |
| INT-07 | FAQ cerrada | Seleccionar | Abrir respuesta y cerrar la previamente abierta |
| INT-08 | FAQ abierta | Seleccionar | Cerrar su respuesta |
| INT-09 | CTA «Contactar al equipo» | Seleccionar | Abrir destino real aprobado, pendiente PEND-01 |
| INT-10 | Footer anclas | Seleccionar | Navegar a sección destino |
| INT-11 | Footer privacidad | Seleccionar | Abrir política real, pendiente PEND-02 |

### 8.2 Menú móvil

- Activador visible de al menos 44 × 44 px con nombre accesible «Abrir menú»/«Cerrar menú».
- Debe poder operarse con teclado, `Escape` y lector de pantalla.
- Si se implementa como diálogo/modal, aplicar gestión de foco y devolución al activador al cerrar; si es panel desplegable no modal, mantener orden de tabulación y semántica correctos. Una sola solución consistente, no varias.
- Cerrar al elegir enlace; no bloquear el scroll de la página permanentemente.
- No introducir enlaces no existentes en Desktop.

### 8.3 FAQ

- Estado inicial: índice 01 abierto; otros cinco cerrados.
- Exclusividad: máximo un panel visible, pero se permite cero.
- Pregunta expresada como control botón; panel asociado mediante identificadores consistentes.
- La respuesta completa permanece en el flujo normal; no cortarla con altura fija.
- Transición ligera y reversible; sin motion si el usuario lo reduce.

### 8.4 Estados financieros *solo ilustrativos*

- La landing muestra texto y badges de «Esperando pago» / «Pago recibido» como materiales de explicación, no estado live.
- Los importes `$85.00` y `$850.00`, así como «7 pagos confirmados» y `CV-0085`, son datos de ejemplo aprobados para previews, **no promesas ni datos reales**.
- El preview del botón «Confirmar importe» no ejecuta una solicitud de cobro; tampoco el micrófono. No capturar audio real ni emitir una confirmación hablada en la landing.
- No agregar spinner, contador o transición de estado que sugiera una verificación bancaria efectiva.

### 8.5 Transiciones

- Hover/focus/cambios leves: 150–200 ms `ease-out`; máximo 250 ms para motion no crítico.
- Scroll por anclas suave solo si la preferencia de movimiento lo permite; navegación debe seguir funcionando sin animación.
- Los elementos sin acción (casos de uso, tarjetas de pasos y beneficios) **no** deben parecer clicables por hover innecesario.

---

## 9. Accesibilidad y calidad responsive

### 9.1 Semántica y lectura

- Un único H1 en Hero; H2 en secciones 02–07; encabezados internos H3 cuando corresponda.
- Header dentro de navegación con etiqueta comprensible; sección principal en `main`; Footer en elemento semántico.
- El idioma del documento es `es-MX` y se preservan signos de apertura `¿`, `¡` y tildes.
- Las imágenes meramente decorativas no sustituyen texto; mockups descriptivos pueden recibir una alternativa textual que indique que son demostraciones.
- No duplicar para lector de pantalla todo el texto visible mediante alt redundante de un screenshot completo.

### 9.2 Interacción accesible

- Contraste WCAG AA: al menos 4.5:1 texto normal y 3:1 texto grande o elementos no textuales relevantes.
- Estados de foco visibles y suficientemente separados de la superficie.
- Objetivos táctiles de al menos 44 × 44 px; CTA primario de 56 px.
- Menú y FAQ usables por teclado y lector; `aria-expanded` correcto; controles con nombres claros.
- No depender solo de color o de audio para comunicar estados bancarios en previews.
- Evitar enlaces falsos y botones no funcionales. Si faltan destinos reales, bloquear publicación y marcar pendiente, no inventarlos.

### 9.3 Responsive y robustez

Validar en **320, 360, 375, 390, 430, 768, 1024 y al menos 1200 px**. Para cada ancho:

- No scroll horizontal causado por tarjetas, sombras, textos o teléfonos.
- H1, H2, montos, palabras largas y etiquetas completas sin truncar ni sobreponerse.
- FAQ visible/expandible; botones con suficiente espacio.
- Imágenes decorativas sin interferir con CTA o lectura.
- Probar zoom al 200% y escalado de texto en móvil.
- No ocultar contenido por notch o barras del navegador; el sitio público no necesita la barra inferior PWA.
- Evitar que los mockups parezcan ventanas de app con contenido ilegible en 320 px: ajustar escala con límites mínimos y permitir crecimiento vertical.

### 9.4 Rendimiento y publicación

- Minimizar imágenes grandes innecesarias; preferir elementos HTML/CSS y assets optimizados para cada fragmento que realmente lo requiera.
- Cargar tipografía con estrategia adecuada y fallback estable; minimizar saltos de layout.
- Dimensionar imágenes usadas como activos con ratio previsto; no bloquear la legibilidad mientras cargan.
- Evitar video pesado, audio automático y animaciones continuas.
- Verificar enlaces legales y de contacto antes de publicar.

### 9.5 Pruebas de aceptación

1. Recorrido teclado completo en Desktop y Mobile.
2. FAQ abre/cierra seis elementos sin perder contenido.
3. Menú funciona con `Escape`, selección de ancla y gestión del foco.
4. Botones CTA llevan a destinos correctos o se identifican como pendientes de publicar.
5. Los pagos y ventas de preview indican que son ejemplos cuando existe riesgo de confusión.
6. Sin presentación de un QR falso ni gráfica extra del MVP.
7. Regresión visual contra las 16 referencias, aplicando las tres excepciones documentadas.

---

## 10. Recursos visuales y gestión de assets

### 10.1 Política de conservación

Se conservan **exactamente los 16 PNG originales** generados en la conversación. El paquete de entrega incluye copias byte a byte idénticas, con los nombres originales, dentro de `assets/`. No se han editado, redimensionado, recoloreado ni regenerado. Los hashes SHA-256 del anexo facilitan verificar integridad.

Las imágenes son **referencias high-fidelity**, no exportables como sitios funcionales. La versión Mobile se diseñó para la lógica de viewport 390 px, aunque el lienzo PNG tenga dimensiones raster mayores.

### 10.2 Uso correcto de referencias

- Abrir la imagen correspondiente para evaluar layout, curva orgánica, densidad, radios, sombras y equilibrio.
- Construir títulos, párrafos, botones, cards, FAQ y navegación como DOM real.
- Los detalles de la pantalla P01/P02 ilustrados pueden reconstruirse con componentes de preview; nunca incrustar QR bancario funcional inventado.
- No usar un PNG completo como fondo final ni aplicar mapas de clics invisibles a las imágenes.
- No inferir fuentes tipográficas exactas por reconocimiento óptico: la fuente oficial es DM Sans según `DESIGN.md`.
- No usar los textos de las imágenes como nueva fuente de verdad si difieren del copy aprobado.

### 10.3 Organización de entrega

Paquete sugerido: `CobraVoz_Landing_Handoff_v1.0.zip` con este `.md` en raíz y los 16 PNG originales en la carpeta `assets/`, sin renombrarlos. En caso de integrar a repositorio, se recomienda un directorio de **referencias de diseño** separado de `/public` para evitar que todo el peso de los originales se publique accidentalmente.

Véase [Anexo A](#anexo-a--inventario-de-las-16-referencias-visuales) para nombre, medidas raster y hashes.

---

## 11. Diferencias detectadas y decisiones de implementación

| ID | Archivo/área | Diferencia entre imagen y especificación | Fuente que prevalece | Acción de implementación | ¿Cambiar PNG? |
|---|---|---|---|---|---|
| OBS-01 | Sección 02 Mobile | Imagen pone copy y mini UI lado a lado dentro de cada card | Layout Mobile aprobado de tres tarjetas verticales con texto arriba y UI debajo | Usar estructura interna vertical | **No** |
| OBS-02 | Sección 03 Mobile | PNG agrega gráfico de barras al resumen «Tus ventas a la vista» | PRD fuera de alcance + `DESIGN.md` + especificación Bento | No renderizar gráfica; conservar total y conteo | **No** |
| OBS-03 | Footer Mobile | Gran vacío sobre contenido | Padding superior Mobile aprobado de 48 px | Usar 48 px de espacio superior real | **No** |
| OBS-04 | Hero Desktop y estética derivada | Tonos renderizados se apartan ligeramente de HEX oficiales | Decisión expresa del usuario de conservar apariencia + tokens de `DESIGN.md` para CSS | Conservar PNG; usar base semántica en CSS; registrar excepciones solo si se aprueban | **No** |
| OBS-05 | Caso de uso / algunas tarjetas | El PNG condensa el copy respecto a textos previos de especificación | Copy aprobado en la especificación, preservado en §6 y Anexo B | Usar copy canónico; no copiar automáticamente texto raster | **No** |
| OBS-06 | FAQ/links públicos | Privacidad y contacto no tienen URL aportada | No inventar destinos | Definir antes de publicar | **No** |

**Criterio de cierre de observaciones:** una diferencia se considera resuelta cuando el componente real cumple la fuente prevalente y hay evidencia visual/funcional de prueba. No hace falta editar la referencia PNG para cerrar el hallazgo.

### 11.1 Aspectos que no deben sobreinterpretarse

- Las figuras orgánicas de marketing son tratamientos estéticos, no nuevos tokens de marca global.
- El marco de teléfono es una visualización promocional de P01 y no una promesa sobre un modelo de dispositivo particular.
- Los números de ventas reflejan ejemplos aprobados para comunicar la interfaz y no datos del negocio piloto.
- El contenido de la PWA no debe ser redefinido desde un diseño comercial ni confundirse con módulos productivos.

---

## 12. Checklist de implementación y criterios de aceptación

### 12.1 Contenido y arquitectura

- [ ] Header único y secciones 01–08 en el orden aprobado.
- [ ] Anclas `inicio`, `como-funciona`, `beneficios`, `confianza`, `para-quien-es`, `preguntas-frecuentes`, `contacto` coherentes.
- [ ] Copy literal de §6 y Anexo B, con ortografía `es-MX`.
- [ ] Un H1 y jerarquía H2/H3 semánticamente correcta.
- [ ] Sin enlaces externos inventados, registro público ni claims no aprobados.

### 12.2 Fidelidad visual

- [ ] Desktop: Hero 54/46, tres pasos en fila, Bento, Confianza 42/58, Editorial 44/56, FAQ central, CTA centrado, Footer 50/25/25.
- [ ] Mobile: ocho bloques adaptados según matriz de §5.2.
- [ ] Variaciones de aspecto permitidas solo por responsive; preservar identidad visual aceptada.
- [ ] Wordmark temporal DM Sans, colores semánticos base, radios/bordes/sombras consistentes.
- [ ] Ninguna imagen original regenerada o alterada.
- [ ] OBS-01/02/03 documentadas y corregidas en UI, no en PNG.

### 12.3 UX y accesibilidad

- [ ] Todos los enlaces de ancla funcionan y consideran desplazamiento/foco.
- [ ] Menú Mobile operable con teclado, pantalla táctil y lector de pantalla.
- [ ] FAQ abre primero la pregunta 01, otras cerradas, y permite una abierta o ninguna.
- [ ] CTA con blanco táctil ≥44 px y alto primario de 56 px.
- [ ] Contrastes WCAG AA verificados en render real.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Sin scroll horizontal a 320/360/375/390/430/768/1024/1200 px.
- [ ] Textos y montos completos con zoom de texto.

### 12.4 Restricciones financieras

- [ ] Previews de cobros son estáticos y claramente ilustrativos.
- [ ] No QR ficticio presentado como cobro real.
- [ ] Estado pendiente nunca se pinta/etiqueta como pagado.
- [ ] No audio automático, notificaciones push ni confirmaciones ficticias.
- [ ] No gráficas, reportes ni dashboards complejos.
- [ ] No dependencias de Pey, OpenAI STT ni secretos bancarios dentro de la landing.

### 12.5 Preparación para publicación

- [ ] PEND-01: destino real de contacto aprobado y probado.
- [ ] PEND-02: política de privacidad real disponible y enlazada.
- [ ] Revisión final de textos legales/marketing y metadatos.
- [ ] Prueba en navegadores/dispositivos representativos.
- [ ] Auditoría de peso de imágenes y saltos visuales.
- [ ] Evidencia de revisión de los ocho bloques Desktop y Mobile.

### 12.6 Definición de terminado (landing)

La landing se considera **visualmente implementada** al cumplir la estructura y matriz responsive, copies, diseño y pruebas básicas. Se considera **lista para publicar** solo después de resolver contacto, privacidad, pruebas de accesibilidad y enlaces. Ninguno de estos criterios valida por sí mismo el circuito real Pey/CoDi: su DoD está definido en el PRD de la PWA.

---

## Anexo A — Inventario de las 16 referencias visuales

Los siguientes nombres corresponden a las **imágenes originales entregadas en la conversación**. En el paquete ZIP están en `assets/`, sin cambios de contenido. La información `raster` corresponde al archivo físico, no a dimensiones CSS del viewport objetivo.

| ID | Sección | Variante | Raster (px) | Imagen original | SHA-256 |
|---|---|---|---:|---|---|
| 01 | Hero | Desktop | 1672 × 941 | [`cobravoz_cobra_con_tu_voz.png`](assets/cobravoz_cobra_con_tu_voz.png) | `0d82a4f84482e9009e876d5874ca98f14135b12d6ad80f53bc0ed982a2fe1dac` |
| 01 | Hero | Mobile | 1024 × 1536 | [`a_clean_modern_mobile_landing_page_vertical_smar.png`](assets/a_clean_modern_mobile_landing_page_vertical_smar.png) | `9e01a8672e0f12a8d3a20f796fc3a570f27f4b67eb2de4a6078c7116f8484609` |
| 02 | Cómo funciona | Desktop | 1672 × 941 | [`tres_pasos_para_cobrar_con_cobravoz.png`](assets/tres_pasos_para_cobrar_con_cobravoz.png) | `7980c011025b08bd04ea784784d107fdb94cdf04e0c0ec09a32d67ccba503803` |
| 02 | Cómo funciona | Mobile | 1024 × 1536 | [`a_clean_modern_mobile_ui_landing_section_in_spani.png`](assets/a_clean_modern_mobile_ui_landing_section_in_spani.png) | `083a99c9e647faf0f833989565aee3c9ffe00138b9006b454bd3f32211150109` |
| 03 | Beneficios | Desktop | 1536 × 1024 | [`a_clean_modern_high_fidelity_web_ui_section_des.png`](assets/a_clean_modern_high_fidelity_web_ui_section_des.png) | `0562d91a1203d20b921b713a858663bbb2ecfd691efd2ea081674eaadbcf625a` |
| 03 | Beneficios | Mobile | 1024 × 1536 | [`a_clean_modern_mobile_landing_style_infographic.png`](assets/a_clean_modern_mobile_landing_style_infographic.png) | `46ce55d919a23f206f4759277d0ec12577181aa1fccbff201bb026bdfa88ae55` |
| 04 | Confianza | Desktop | 1752 × 897 | [`a_clean_modern_flat_ui_marketing_illustration_s.png`](assets/a_clean_modern_flat_ui_marketing_illustration_s.png) | `bfda8adc902d44d285bce17e5a32434ec9504c6e6eadf9ab0c79cf4b3a214ae3` |
| 04 | Confianza | Mobile | 941 × 1672 | [`confianza_y_verificación_de_pagos.png`](assets/confianza_y_verificación_de_pagos.png) | `0dafc94491ea97be3646afe8bc08f90654c1d88d70def161bbfa0e197ec24a2d` |
| 05 | Casos de uso | Desktop | 1752 × 897 | [`a_clean_modern_flat_ui_infographic_landing_secti.png`](assets/a_clean_modern_flat_ui_infographic_landing_secti.png) | `751a3b90f0041342838fa7d420c6c9fce78b8931195cfbc8d0e7d9e2887f0f56` |
| 05 | Casos de uso | Mobile | 941 × 1672 | [`pensado_para_tu_negocio.png`](assets/pensado_para_tu_negocio.png) | `32a0668278af96977cdcae291b61259849ea88c10ea7cc8a41bed6cb47170781` |
| 06 | Preguntas frecuentes | Desktop | 1536 × 1024 | [`a_clean_modern_sans_serif_ui_preguntas_frecuente.png`](assets/a_clean_modern_sans_serif_ui_preguntas_frecuente.png) | `602f09dbf73e165fb67315a29cc8fd8d9b03d30dfe524e4bc1800b65e7278096` |
| 06 | Preguntas frecuentes | Mobile | 1024 × 1536 | [`a_clean_modern_mobile_app_web_ui_screenshot_in_sp.png`](assets/a_clean_modern_mobile_app_web_ui_screenshot_in_sp.png) | `ae47dde4a42082769ce3e3b7ae3394f77dd9c4bd6e411724ecfa28abea9af894` |
| 07 | CTA Final | Desktop | 1672 × 941 | [`cta_cobravoz_cobra_más_sencillo.png`](assets/cta_cobravoz_cobra_más_sencillo.png) | `d657c3ad758c0473164368b9508d36bdc3df39704b912974ad3382c7ca5da4da` |
| 07 | CTA Final | Mobile | 1199 × 1312 | [`a_clean_modern_mobile_style_graphic_single_panel.png`](assets/a_clean_modern_mobile_style_graphic_single_panel.png) | `7b0b832b087d6051e361028c3c99ffe2e74e4bbfe1d681edb6b54331acd892b7` |
| 08 | Footer | Desktop | 1672 × 941 | [`cobravoz_minimal_fintech_footer.png`](assets/cobravoz_minimal_fintech_footer.png) | `05130b93a9dd3e8cdd9c1d6d7a9ce7e5358e621c3407919184af52c15878ea04` |
| 08 | Footer | Mobile | 941 × 1672 | [`cobravoz_footer_minimalista_móvil.png`](assets/cobravoz_footer_minimalista_móvil.png) | `ba14c173cf0f527932bd883d1a39cf027e2fc8a5df15d47f93fe1d76019b4722` |

**Observaciones:** las ocho imágenes Desktop tienen proporciones diversas; las ocho Mobile son imágenes verticales de alta resolución, no screenshots nativos de 390 px de ancho. No deducir distancias CSS del raster sin contrastar la especificación.

---

## Anexo B — Inventario canónico de copy

Este anexo es una réplica agrupada del contenido aprobado para facilitar QA y evitar reescrituras. En caso de conflicto con texto generado dentro de un PNG, prevalecen las especificaciones del cuerpo de este documento.

### B.1 Header y Hero

| Ubicación | Copy |
|---|---|
| Marca | CobraVoz |
| Header menú 1 | Cómo funciona |
| Header menú 2 | Beneficios |
| Header menú 3 | Contacto |
| Hero eyebrow | Cobros por voz + CoDi |
| Hero H1 | Cobra con tu voz. Sigue atendiendo tu negocio. |
| Hero descripción | Di el importe, confirma la cantidad y muestra un QR CoDi para recibir el pago. CobraVoz te avisa cuando el pago está verificado. |
| Hero CTA principal | Conoce el piloto |
| Hero CTA secundario | Cómo funciona |

### B.2 Cómo funciona

- Eyebrow: **CÓMO FUNCIONA**
- H2: **Tres pasos para cobrar con CobraVoz.**
- Subtítulo: **Desde dictar el importe hasta verificar el pago.**
- 01: **Di cuánto quieres cobrar** — Presiona el micrófono y di la cantidad. También puedes ingresar el importe manualmente.
- 02: **Confirma y genera tu QR** — Revisa que la cantidad sea correcta y confírmala. CobraVoz genera un QR CoDi para que tu cliente pueda pagar.
- 03: **Verifica el pago** — Tu cliente paga con CoDi. CobraVoz muestra la confirmación cuando el pago se ha verificado.
- Previews: «Nuevo cobro», «Hablar para cobrar», «Ingresar importe manualmente», «Importe a cobrar», `$85.00`, «MXN · Ejemplo ilustrativo», «Confirmar importe», «¡Pago recibido!», «Pago verificado · Ejemplo».

### B.3 Beneficios

- Eyebrow: **BENEFICIOS**
- H2: **Menos pasos para cobrar. Más claridad en cada venta.**
- Subtítulo: **Una herramienta sencilla para el ritmo de tu negocio.**
- **Menos pasos para cobrar** — Dicta el importe, revísalo y confirma. También puedes escribir la cantidad cuando lo necesites.
- **Pagos claros y verificables** — Distingue fácilmente cuándo un pago sigue pendiente y cuándo ha sido verificado.
- **Tus ventas a la vista** — Consulta cuánto has cobrado hoy y revisa tus movimientos recientes desde tu celular.
- Previews: «Nuevo cobro», «Hablar para cobrar», «Esperando pago», «Pago recibido», «Total cobrado hoy», `$850.00`, «7 pagos confirmados», contexto ilustrativo.

### B.4 Confianza

- Eyebrow: **PAGOS CON CLARIDAD**
- H2: **El pago se confirma, no se supone.**
- Descripción: CobraVoz te muestra cuándo un pago sigue pendiente y cuándo ha sido verificado. Sin depender de capturas de pantalla ni de confirmaciones verbales.
- Aviso: **Confirmación bancaria verificable** — CobraVoz utiliza la integración Pey/CoDi para consultar y verificar el estado del cobro.
- Pendiente: **Esperando pago** — `$85.00` — Aún no se ha confirmado el pago.
- Verificado: **Pago recibido** — `$85.00` — Pago verificado correctamente. — Referencia ilustrativa: CV-0085.

### B.5 Para quién es

- Eyebrow: **PENSADO PARA TU NEGOCIO**
- H2: **Hecho para quienes atienden y cobran al mismo tiempo.**
- Descripción: Desde un puesto de comida hasta un local de mercado, CobraVoz está pensado para comerciantes que necesitan cobrar de forma sencilla desde su celular.
- Cápsula: **Desde tu celular**.
- **Puestos de comida** — Entre preparar pedidos, entregar productos y atender clientes, cada paso cuenta. Dicta el importe, revísalo y genera tu cobro desde el celular.
- **Mercados y tianguis** — Cuando atiendes a varios clientes durante el día, necesitas saber qué cobros ya fueron confirmados. CobraVoz te permite consultar el estado de cada operación.
- **Pequeños comercios** — Para negocios que necesitan cobrar y continuar atendiendo. Revisa el total cobrado hoy y consulta tus movimientos recientes desde un mismo lugar.

### B.6 Preguntas frecuentes — texto completo

**Eyebrow:** PREGUNTAS FRECUENTES  
**H2:** ¿Tienes dudas? Aquí te ayudamos.  
**Subtítulo:** Todo lo que necesitas saber sobre cómo funciona CobraVoz.

**FAQ-01 — ¿Necesito descargar una aplicación?**  
CobraVoz es una aplicación web instalable (PWA). Puedes utilizarla desde un navegador compatible y agregarla a tu dispositivo cuando esté disponible esa opción.

**FAQ-02 — ¿Qué pasa si no funciona el micrófono?**  
Puedes ingresar el importe manualmente. Siempre tendrás la oportunidad de revisar y confirmar la cantidad antes de generar el QR.

**FAQ-03 — ¿Cómo sé si realmente recibí el pago?**  
CobraVoz muestra «Pago recibido» únicamente cuando la operación ha sido verificada. Si todavía no existe confirmación, el cobro permanece pendiente.

**FAQ-04 — ¿Qué sucede si el pago sigue pendiente?**  
Puedes consultar nuevamente su estado. La app no marcará el cobro como pagado sin una confirmación bancaria verificable.

**FAQ-05 — ¿Funciona sin conexión a internet?**  
Necesitas conexión para generar nuevos códigos QR. Si se interrumpe tu sesión, CobraVoz puede recuperar el estado de los cobros registrados cuando vuelvas a conectarte.

**FAQ-06 — ¿Puedo registrar mi negocio?**  
El MVP inicia como un piloto con un comercio y una cuenta receptora configurada. Todavía no cuenta con registro público para nuevos negocios.

### B.7 CTA Final

- Eyebrow: **CONOCE COBRAVOZ**
- H2: **Haz que cobrar sea más sencillo.**
- Descripción: Descubre una forma de cobrar con tu voz y seguir atendiendo lo que más importa: tu negocio.
- CTA: **Contactar al equipo**.

### B.8 Footer

- Marca: **CobraVoz**.
- Slogan: **Cobra fácilmente, sin dejar de atender tu negocio.**
- Grupo: **Explora** → Cómo funciona · Beneficios · Para quién es.
- Grupo: **Ayuda** → Preguntas frecuentes · Contacto.
- Franja legal: **© 2026 CobraVoz** · **Privacidad**.

---

## Anexo C — Matriz de trazabilidad

| ID | Requisito / decisión | Sección(es) | Fuente | Prueba de aceptación |
|---|---|---|---|---|
| TR-01 | Propuesta de valor y posicionamiento para pequeño comercio | 01, 05, 07, 08 | PRD §1–2, DESIGN.md §0, copy aprobado | Mensaje visible y consistente |
| TR-02 | Voz como entrada, siempre con alternativa manual | 01, 02, 03, FAQ | PRD RN-03/RN-04, DESIGN.md §6.2 | Preview y FAQs no prometen operación sin confirmación |
| TR-03 | Confirmación antes de QR | 01, 02, FAQ | PRD RN-03/RN-05 | Paso 02 expresamente visible |
| TR-04 | QR CoDi auténtico solo dentro de PWA | 02, 04 | PRD RN-09, DESIGN.md §6.5 | Ningún QR falso en marketing |
| TR-05 | Diferenciar pendiente de pagado | 02, 03, 04, FAQ | PRD RN-10/RN-13/RN-15 | Badges con texto, color e ícono correctos |
| TR-06 | Ventas incluyen solo pagos confirmados | 01, 03 | PRD RN-16, DESIGN.md §6.6 | Preview explicativo sin gráficas de producto |
| TR-07 | PWA instalable y sin offline QR | FAQ | PRD §3, RN-19 | Respuestas FAQ-01 y FAQ-05 correctas |
| TR-08 | Piloto sin alta pública | 01, 07, FAQ | PRD §4–5 | Sin registrar/alta gratuita; CTA de contacto |
| TR-09 | Layout responsive 8 secciones | 01–08 | Especificaciones de landing aprobadas | Matriz §5.2 validada en anchos objetivo |
| TR-10 | DM Sans, color, bordes y CTA | 01–08 | DESIGN.md §1–5 | Auditoría visual y contraste |
| TR-11 | FAQ 6 preguntas y primera abierta | 06 | Sección 06 Desktop/Mobile aprobada | Prueba de acordeón, foco y `aria-expanded` |
| TR-12 | Footer sin redes inventadas | 08 | Sección 08 aprobada | Solo grupos y legal establecidos |
| TR-13 | PEND-01 contacto real | 01, 07, 08 | Decisión funcional pendiente | Enlace aprobado y probado antes del lanzamiento |
| TR-14 | PEND-02 privacidad real | 08 | Requisito legal pendiente | Documento y URL operativos antes del lanzamiento |
| TR-15 | No alterar imágenes y corregir divergencias en código | 02, 03, 08 Mobile | Revisión Responsive + OBS-01/02/03 | UI se ajusta a specs sin editar PNG |
| TR-16 | Visual de Hero aceptado pese a variación HEX | 01–08 | Aprobación expresa del usuario | Referencia original intacta; tokens no reinventados |

### Condición final de handoff

El desarrollo puede comenzar con estas especificaciones sin pedir nuevas decisiones de branding. Las únicas decisiones funcionales abiertas para **publicación** son contacto, privacidad y cualquier dependencia externa no cubierta por los documentos fuente disponibles. Para conectar con pagos reales, deben consultarse las fuentes UX y Architecture completas, fuera del alcance de este handoff de landing.

---

**Fin — CobraVoz Landing Design → Development Handoff v1.0**
