# CobraVoz — DESIGN.md

**Versión:** 1.0 — guía de implementación visual para MVP  
**Estado:** DEFAULT DE IMPLEMENTACIÓN (no sustituye las especificaciones congeladas)  
**Fecha:** 15 de noviembre de 2026  
**Stack visual aprobado:** Next.js 16, React, Tailwind CSS 4, shadcn/ui, Lucide icons  
**Idioma:** Español de México (`es-MX`)

> **Instrucción para IA:** implementa este sistema visual tal como está, sin solicitar nuevas decisiones de branding. Cuando haya ambigüedad, prioriza legibilidad, usabilidad en exteriores, accesibilidad WCAG AA y mínimo número de elementos. No cambies el PRD v1.0, la UX Specification v1.0 ni la Architecture Specification v1.0. Esta guía es la propuesta práctica necesaria para iniciar el MVP. La identidad vigente es Brand Assets v1.0 (§11).

## 0. Principio y dirección estética

**Dirección:** «Fintech accesible + comercio mexicano contemporáneo».

CobraVoz debe sentirse **confiable, cercana, rápida y amigable**, como una herramienta para alguien que atiende un puesto de comida o de mercado, **sin clichés folclóricos, neón, glassmorphism, dashboards complejos o estética bancaria fría**.

- **Light-first:** pantallas claras para legibilidad bajo luz de día. No desarrollar dark mode para MVP.
- Superficies cálidas casi blancas, turquesa profundo para CTA, acento terracota moderado para personalidad.
- Espaciado generoso, componentes grandes y jerarquía evidente.
- Un CTA dominante por vista; un estado bancario nunca se expresa solo mediante color.
- Visualizar el QR auténtico y darle espacio; no decorar en exceso esa pantalla.
- Motion mínimo; feedback por estado y texto; voz como diferenciador funcional.

**Propuesta de valor de marca (sin alterar):** «Cobra fácilmente, sin dejar de atender tu negocio».

## 1. Colores — tokens obligatorios

### 1.1 Primitivos

| Token | HEX | Uso |
|---|---|---|
| `--color-teal-700` | `#0E635F` | Hover/active del CTA, encabezados oscuros puntuales |
| `--color-teal-600` | `#107B75` | **CTA principal**, enlaces importantes, micrófono activo |
| `--color-teal-100` | `#E3F1EF` | Superficie suave de acciones primarias |
| `--color-ink-900` | `#172D32` | Texto principal |
| `--color-ink-600` | `#506369` | Texto secundario |
| `--color-ink-400` | `#6C7C80` | Texto terciario; confirmar contraste en cada uso |
| `--color-canvas` | `#F6F8F5` | Fondo base de la aplicación |
| `--color-surface` | `#FFFFFF` | Tarjetas, campos, barra inferior |
| `--color-surface-muted` | `#EDF3EF` | Secciones suaves y skeletons |
| `--color-border` | `#D7E3DE` | Bordes y separadores |
| `--color-terracotta-700` | `#AA4930` | Acento/acciones secundarias de énfasis |
| `--color-terracotta-100` | `#F9EDE2` | Acentos cálidos y pequeños elementos decorativos |
| `--color-focus` | `#0E635F` | Foco visible con anillo exterior claro |

**Combinaciones verificadas para texto:** blanco sobre `#107B75` (~5.1:1), blanco sobre `#0E635F` (~7.1:1), tinta `#172D32` sobre `#F6F8F5` (~13.5:1). Los valores son aproximados; revalidar cualquier combinación si cambian tokens.

### 1.2 Colores semánticos: no usar solo color

| Estado | Texto/ícono | Fondo suave | Etiqueta obligatoria |
|---|---|---|---|
| Éxito/pago confirmado | `#15593E` | `#E8F5EF` | «Pagado» / «Pago recibido» |
| Advertencia/pendiente | `#855716` | `#FCF3DE` | «Esperando pago» / «Pago sin confirmar» |
| Error (operativo) | `#A52C35` | `#FDEBEC` | Mensaje concreto de error |
| Información/verificación | `#0C5A56` | `#E3F1EF` | «Verificando» / «Consultando» |
| Incidencia | `#8D3E22` | `#F9EDE2` | «Incidencia» |
| Expirado/cerrado localmente | `#506369` | `#EDF3EF` | «Expirado» / «Cerrado localmente» |

Los contrastes de combinaciones principales de status fueron seleccionados para texto legible sobre su fondo suave. Usar **ícono + texto de estado** y, donde corresponda, explicación adicional; no reutilizar el verde de éxito para cobros pendientes.

### 1.3 Mapeo conceptual a shadcn/ui

| Variable shadcn | Color/valor |
|---|---|
| `background` | `#F6F8F5` |
| `foreground` | `#172D32` |
| `card` / `popover` | `#FFFFFF` |
| `card-foreground` / `popover-foreground` | `#172D32` |
| `primary` | `#107B75` |
| `primary-foreground` | `#FFFFFF` |
| `secondary` | `#E3F1EF` |
| `secondary-foreground` | `#0E635F` |
| `muted` | `#EDF3EF` |
| `muted-foreground` | `#506369` |
| `accent` | `#F9EDE2` |
| `accent-foreground` | `#8D3E22` |
| `destructive` | `#A52C35` |
| `destructive-foreground` | `#FFFFFF` |
| `border` / `input` | `#D7E3DE` |
| `ring` | `#0E635F` |
| `radius` | `14px` base |

No usar valores predeterminados de shadcn que contradigan esta tabla. Con Tailwind 4 mapear tokens a utilidades de tema y CSS variables semánticas, evitando colores hardcodeados en componentes de negocio.

## 2. Tipografía

### 2.1 Familia

- **Principal:** `DM Sans` (variable), desde `next/font/google`, con fallback `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Monoespaciada:** no se requiere para interfaz; referencias técnicas pueden usar fuente monospace del sistema.
- **Números:** activar `font-variant-numeric: tabular-nums` en totales, montos, tiempos y filas para evitar saltos visuales.
- **Pesos:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
- **Uso:** oración normal/sentence case; no títulos enteramente en mayúsculas. Mantener acentos y formato de MXN.

### 2.2 Escala de tipografía

| Token | Tamaño/alto de línea | Peso | Uso |
|---|---|---|---|
| `text-xs` | `12 / 16px` | 400–500 | Metadatos no críticos, solo si contraste correcto |
| `text-sm` | `14 / 20px` | 400–600 | Metadatos, chips, ayudas |
| `text-base` | `16 / 24px` | 400–500 | **Texto de lectura predeterminado** |
| `text-lg` | `18 / 26px` | 600 | Subtítulos y tarjetas relevantes |
| `text-xl` | `20 / 28px` | 600–700 | Encabezado de sección |
| `text-2xl` | `24 / 32px` | 700 | Títulos de pantalla |
| `text-3xl` | `30 / 38px` | 700 | Cifra destacada en resumen |
| `text-amount` | `40 / 48px` | 700 | Importe protagonista P02/P03 |
| `text-amount-sm` | `32 / 40px` | 700 | Ajuste a teléfonos pequeños |

**Regla:** importes monetarios a 2 decimales, separador de miles según `es-MX`, siempre con símbolo `$` y contexto `MXN` cuando pueda haber ambigüedad. No cortar cifras ni reducir debajo de 28px en P02.

## 3. Espaciado y layout

### 3.1 Escala base (4 px)

| Token | Px | Uso |
|---|---:|---|
| `space-1` | 4 | Ícono/etiqueta muy próximos |
| `space-2` | 8 | Gap de badge y microcopy |
| `space-3` | 12 | Filas compactas |
| `space-4` | 16 | Margen lateral de móvil y padding pequeño |
| `space-5` | 20 | Padding estándar de tarjeta |
| `space-6` | 24 | Separación entre grupos |
| `space-8` | 32 | Separación entre secciones |
| `space-10` | 40 | Respiración extra |
| `space-12` | 48 | Bloques hero/estado |

### 3.2 Layout principal

| Regla | Valor |
|---|---|
| Ancho mínimo objetivo | `320px` |
| Vistas de prueba | `320, 360, 375, 390, 430px` |
| Ancho máximo shell | `480px`, centrado en pantallas grandes |
| Padding horizontal | `16px` para 320–359; `20px` para ≥360 cuando quepa |
| Separación vertical por sección | `24–32px` |
| Padding interno de tarjeta | `16–20px` |
| Zona segura iOS | Considerar `env(safe-area-inset-bottom)` |
| Barra inferior P01/P04 | `64px` contenido + zona segura |
| Header | `56–64px` según contenido |
| Altura máxima de contenido | **No imponerla**; scroll normal |

Mobile-first. En desktop mantener la interfaz tipo herramienta móvil centrada; no inventar panel lateral ni dashboard responsivo de columnas.

## 4. Radios, bordes, sombras y densidad

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | `8px` | Chips y pequeños badges |
| `radius-md` | `12px` | Inputs y elementos auxiliares |
| `radius-lg` | `16px` | Tarjetas de contenido |
| `radius-xl` | `24px` | Estado principal de cobro o panel de micrófono |
| `radius-full` | `9999px` | Botón de micrófono redondo, avatars no personales |
| Border estándar | `1px solid #D7E3DE` | Tarjetas/inputs |
| Shadow tarjeta | `0 3px 12px rgba(23,45,50,0.06)` | Elevación sutil |
| Shadow foco | `0 0 0 3px rgba(16,123,117,0.24)` | Foco visible |

Evitar sombras dramáticas, gradientes fuertes, blur/transparencias tipo glassmorphism o decoraciones pesadas.

## 5. Botones y objetivos táctiles

### 5.1 Variantes

| Variante | Fondo | Texto | Uso |
|---|---|---|---|
| Primary | `#107B75` | Blanco | Confirmar importe, nuevo cobro, iniciar sesión |
| Primary hover/pressed | `#0E635F` | Blanco | Interacción primaria |
| Secondary | `#E3F1EF` | `#0E635F` | Consultar nuevamente y corrección |
| Outline | Blanco + borde | `#172D32` | Volver a hablar, Ver detalle |
| Ghost | Transparente | `#0E635F` | Acciones discretas / navegación |
| Destructive | `#A52C35` o outline rojo | Blanco / texto rojo | Acciones irreversibles reales; **cerrar cobro local no se presenta como cancelación bancaria** |

### 5.2 Medidas

- Botón principal: **altura 56 px**, ancho completo del contenedor (`w-full`), texto 16 px semibold, radio 14 px.
- Botón secundario: **48 px** de alto, texto 15–16 px.
- Objetivo mínimo de cualquier ícono interactivo: **44 × 44 px**.
- Íconos dentro de botones: 18–20 px; margen 8 px respecto al texto.
- Separación entre controles apilados: 12 px.
- En proceso crítico: deshabilitar botón visualmente y prevenir duplicados en backend; no confiar únicamente en UI.
- Focus-visible claro; hover no debe ser la única indicación de interactividad.

## 6. Componentes visuales del MVP

### 6.1 `AppShell`

- Fondo canvas `#F6F8F5`; ancho máximo 480px; encabezado superior.
- Barra inferior **solo** en P01 y P04, con dos destinos Inicio/Ventas, texto e ícono; estado activo fuerte y accesible.
- P02/P03 sin barra inferior.

### 6.2 `VoiceCaptureButton`

- Control circular, **112px × 112px** preferente en P01 (mínimo 96px si el viewport obliga); ícono micrófono 40px.
- Fondo `primary` en inactivo, con icono blanco; título de apoyo «Hablar para cobrar».
- Escuchando: label «Escuchando…», borde/anillo visible y animación suave opcional; nunca presentar animación como evidencia de grabación exitosa.
- Procesando: spinner + texto «Reconociendo importe…»; no permitir segunda grabación simultánea.
- Error/permiso denegado: aviso accesible con alternativas «Volver a hablar» / «Ingresar importe manualmente».
- Evitar efectos que puedan ser confundidos con estado bancario.

### 6.3 `AmountDisplay`

- Importe central destacado con `text-amount` y `tabular-nums`; layout sensible a cantidades grandes.
- Siempre incluir moneda cuando sea útil; en P02 aclarar «Importe a cobrar».
- Texto reconocido debajo en tamaño 14–16px y tono secundario cuando provenga de STT.
- `AmountInput` manual: teclado numérico (`inputMode=decimal`), etiqueta visible, validación de centavos exactos, error bajo el campo; no usar `type=number` como única estrategia de parsing de dinero.

### 6.4 `PaymentStatusCard`

- Estados: generando QR, esperando pago, verificación no disponible, pagado, expirado, cerrado localmente, incidencia. Con notificación, el pendiente dice «Enviando aviso…» y la espera no muestra esta card de código: muestra los últimos 4 dígitos. Con enlace, el pendiente dice «Creando enlace…» y la espera muestra la URL y «Copiar enlace», sin abrir el pago en este celular.
- Card con ícono 24–32px + encabezado de estado legible + contexto corto; usa tokens de estado semánticos.
- Éxito: check-circle, encabezado «¡Pago recibido!», importe/fecha y referencia.
- Pendiente: clock o loader, encabezado «Esperando pago»/«Pago sin confirmar», no check verde.
- Incidencia: alert-triangle, explicación breve sin atribuir resultado bancario definitivo.

### 6.5 `CoDiQrCard`

- QR real generado localmente **desde `qrString` persistido en backend**; jamás inventar payload.
- Base blanca pura, sin gradientes ni gráficos encima; zona quieta alrededor del código: **mínimo 4 módulos QR** según generador.
- Tamaño de render recomendado 248–280 px en teléfonos típicos; ajustar a 232–248px en 320px; mantener sin recorte y alta nitidez.
- Importe, estado y tiempo restante visibles **fuera** del código; cronómetro visual no cambia por sí mismo el estado bancario.
- CTA «Consultar nuevamente» y acción secundaria «Cerrar cobro» separadas visualmente.
- Validar escaneabilidad real en al menos 2 dispositivos distintos y distintas condiciones de brillo.

### 6.6 `DailySummary`

- Una tarjeta principal con **Total cobrado hoy** muy legible y subtítulo **N pagos confirmados**.
- P01 versión compacta; P04 versión completa. No crear gráficas.
- Contar exclusivamente pagos confirmados y conciliados, según `paid_at` y zona horaria del negocio.

### 6.7 `TransactionRow`

- Altura mínima 64px; importe 18px semibold con tabular nums; estado en chip con texto e ícono.
- Subtexto hora/fecha y referencia truncable accesiblemente; flecha/chevron indica apertura de A03.
- Separadores sutiles; área completa accionable 44px+.
- Pendiente, incidencia y expirado pueden listarse, pero **no** suman al total.

### 6.8 `StatusBadge`, `EmptyState`, `Notice`, `Skeleton`, `ConfirmDialog`

- StatusBadge: label obligatorio, altura mínima 24–28px, radio completo.
- EmptyState: ícono simple + texto accionable («Aún no tienes movimientos»).
- Notice: una sola idea y una acción relevante; evitar banners duplicados.
- Skeleton: bloques discretos sin animación intensa; `prefers-reduced-motion`.
- ConfirmDialog para «Cerrar cobro» **debe indicar:** «Se cerrará en CobraVoz, pero esto no cancela un pago en el banco»; acción explícita.

## 7. Iconografía

- Biblioteca: **Lucide React** (consistente con shadcn/ui); stroke 2, tamaño estándar 20px; iconos destacados 24–32px.
- Inicio `house`; Ventas `receipt-text`; micrófono `mic`; Configuración `settings`; éxito `check-circle-2`; pendiente `clock-3`; incidencia `alert-triangle`; sin conexión `wifi-off`; volver `arrow-left`.
- Nunca utilizar un ícono de check en cobros aún no verificados.
- No emplear emoji como iconografía primaria de producto.

## 8. Motion, feedback y sonido

- Duración predeterminada: `150–200ms` para hover/foco/cambio de estado ligero; máximo `250ms` para transiciones visuales no críticas.
- Curva: `ease-out`. Respetar `prefers-reduced-motion: reduce` anulando animaciones no necesarias.
- Loader solo para operaciones reales pendientes; no simular un éxito antes de persistirlo.
- Voz TTS solo para pago **nuevo**, confirmado, mientras app activa y audio habilitado; otras situaciones tienen texto, nunca anuncio hablado automático.
- Evitar emitir audio durante grabación. Si SpeechSynthesis está bloqueado, la UI sigue operativa.

## 9. Accesibilidad y contenidos

1. Objetivos táctiles al menos 44 × 44px; preferir botones de 48–56px.
2. Estados anunciables por lector (`role=status`, `aria-live=polite`; errores críticos cuando corresponda), evitando repetición de anuncios.
3. Foco visible en navegación, inputs, filas y CTA.
4. Contraste mínimo **WCAG AA** (4.5:1 texto normal; 3:1 texto grande/componentes no textuales), verificar en UI real.
5. No depender de color ni sonido para estados de pagos.
6. Mensajes directos, no técnicos: «No pudimos confirmar el pago», no «HTTP 503».
7. Importe y nombre de botón nunca truncados en móvil; permitir zoom de texto.
8. Campos con label real, error descriptivo, ayuda no basada en placeholder.
9. No ocultar controles esenciales por debajo de barra inferior o notch; safe area.
10. Mantener acceso manual al importe en todo momento que la voz no esté disponible.

## 10. Mapeo por pantalla: guía directa para la IA

| Vista | Orden visual y componentes | Prioridad |
|---|---|---|
| P01 Inicio | Header comercio + Settings; VoiceCaptureButton; acción manual; aviso pendiente condicional; DailySummary; movimientos recientes; BottomNav | Voz protagonista |
| P02 Confirmación | Volver; AmountDisplay; transcripción; forma de cobro (QR marcado, notificación con celular, o enlace sin celular); Primary «Confirmar importe»; Corregir/Volver a hablar/Cancelar | Importe legible y acción explícita. Con notificación, confirmar sigue deshabilitado hasta los 10 dígitos |
| P03 CoDi | Estado actual; importe; QR real si existe, últimos 4 si es notificación, o URL copiable si es enlace; referencia/expiración; acciones por estado | Claridad bancaria, nada de QR falso |
| P04 Ventas | Header; DailySummary; movimientos en TransactionRow; cargar más; BottomNav | Consulta simple sin gráficos |
| A01 Acceso | Logo horizontal CobraVoz; slogan corto; correo/contraseña; CTA Iniciar sesión | Simpleza |
| A02 Configuración | Volver; negocio/cuenta en solo lectura; switch anuncio de voz; Cerrar sesión | Sin cambiar banco |
| A03 Detalle | Volver; PaymentStatusCard; importe solicitado/recibido, fechas, método, referencias, explicaciones | Solo lectura |

## 11. Identidad de marca

Fuente: Brand Assets v1.0, Ruta A, archivada en `brand/`. Lo que sirve la app está en `public/favicon.ico`, `app/icon.svg`, `app/apple-icon.png`, `public/icons/` y `public/brand/logos/cobravoz-logo-primary.svg`. El ICO vive en `public/` porque Next.js no decodifica este archivo desde `app/favicon.ico` (los PNG internos no están en RGBA).

- Logo horizontal principal en el header y el menú móvil de la landing (56 px). En el footer, Acceso y Registro, 64 px. El nombre accesible sigue siendo «CobraVoz».
- Verde de logo `#078C7B`. Es distinto del teal de interfaz `#107B75`. `theme_color` sigue en `#107B75`.
- Ink del wordmark dentro del logo: `#172D32`. Isotipo en íconos: blanco `#FFFFFF` sobre fondo opaco `#078C7B`.
- La inversa blanca y el monocromo oscuro están en `brand/logos/` para fondos oscuros. Esta interfaz usa solo la variante principal.
- Favicon, Apple Touch e íconos PWA (`any` y `maskable`, 192 y 512) salen de ese paquete. No hay script que los regenere.
- Inicio, Ventas y Configuración muestran el nombre del comercio en el encabezado.
- No generar ilustraciones, mascotas, fondos elaborados ni fotografías para el MVP.

## 12. Checklist de entrega visual (DoD)

- [ ] Todos los componentes usan tokens definidos, no HEX directos arbitrarios.
- [ ] Navegación P01/P04 y ausencia en P02/P03 coinciden con UX.
- [ ] Pruebas visuales a 320, 360, 390 y 430px sin overflow horizontal.
- [ ] Botones y campos cumplen tamaños mínimos; estados de foco accesibles.
- [ ] P02 no confirma automáticamente el importe ni cambia el monto tras generar QR.
- [ ] QR se puede escanear de manera real, permanece nítido y tiene zona quieta.
- [ ] Estados pagado, pendiente, expirado, cerrado e incidencia son distinguibles por texto e ícono.
- [ ] Audio es opcional; toda confirmación existe visualmente.
- [ ] Hay alternativas manuales para micrófono bloqueado o servicio STT fallido.
- [ ] No aparecen pantallas, filtros, módulos ni dashboards fuera de alcance.

## 13. Orden de precedencia para agentes de IA

1. `CobraVoz_PRD_v1.0.md` — **reglas de producto**.
2. `CobraVoz_UX_Specification_v1.0.md` — **navegación, estructura y estados**.
3. `CobraVoz_Architecture_Specification_v1.0.md` — **arquitectura, datos y pagos**.
4. `DESIGN.md` — **decisiones visuales por defecto para ejecutar sin bloqueo**.
5. `IMPLEMENTATION_PLAN.md` — **orden de trabajo y tareas**.

**Regla de conflictos:** si un token o ejemplo visual parece contradecir flujo/pantalla congelados, prevalece el PRD/UX/Architecture. No corregir especificaciones congeladas silenciosamente: señalar el conflicto y aplicar el comportamiento existente.
