# CobraVoz — IMPLEMENTATION_PLAN.md

**Versión:** 1.0 — plan ejecutable del MVP  
**Fecha:** 15 de noviembre de 2026  
**Estado:** Plan operativo derivado de tres especificaciones aprobadas/congeladas y `DESIGN.md`  
**Objetivo:** obtener una demo real de voz → importe confirmado → QR Pey/CoDi → pago bancario verificado → confirmación visual/sonora → venta registrada.

> **Instrucción para el agente de desarrollo:** implementa el MVP por hitos pequeños y verificables. Antes de cada hito lee `CobraVoz_PRD_v1.0.md`, `CobraVoz_UX_Specification_v1.0.md`, `CobraVoz_Architecture_Specification_v1.0.md` y `DESIGN.md`. No agregues funcionalidades fuera del PRD. No cambies decisiones congeladas silenciosamente. Produce pruebas y evidencia en cada entrega. Nunca uses un QR ficticio como si fuese real ni des por confirmado un pago sin evidencia bancaria.

## 1. Jerarquía y alcance

| Documento | Fuente de verdad de |
|---|---|
| `CobraVoz_PRD_v1.0.md` | Producto, alcance, reglas RN-01–RN-20 y criterios de aceptación |
| `CobraVoz_UX_Specification_v1.0.md` | P01–P04, A01–A03, flujos UF-01–UF-07, estados y acciones |
| `CobraVoz_Architecture_Specification_v1.0.md` | Monolito modular, datos, Pey, voz, seguridad, infraestructura |
| `DESIGN.md` | Tokens, tipografía, layouts y componentes, sin crear pantallas adicionales |
| `IMPLEMENTATION_PLAN.md` | Secuencia de implementación; no redefine las reglas anteriores |

**Incluido:** un comerciante, una cuenta receptora configurada, acceso sin registro público, voz con entrada manual, importe confirmado, QR Pey real, webhook, conciliación, ventas y preferencias de audio. **Excluido:** inventario, catálogo de productos, carrito, NFC, múltiples negocios, pagos manualmente acreditados, POS completo, exportación, panel admin, pagos offline, tiempo real vía sockets, reconocimiento de voz continuo.

## 2. Forma de ejecución

- **Estrategia:** vertical slices. Entregar primero un cobro manual end-to-end con proveedor simulado; luego sustituir por Pey real y, al final, añadir voz como entrada alternativa.
- **Ramas:** una rama por hito o funcionalidad pequeña. PR revisable por hito; migraciones asociadas al PR correspondiente.
- **Calidad:** TypeScript estricto, validación del lado servidor, pruebas unitarias de lógica, integración de DB/adaptador, E2E de recorridos críticos.
- **Fuentes de datos:** mocks separados por entorno. No mezclar eventos simulados con producción.
- **Seguridad:** nunca registrar API keys, audio sin tratar, contraseñas ni cargas completas sensibles.
- **Estado de hito:** `Pendiente → En desarrollo → En revisión → Aprobado`; no iniciar nuevos módulos mayores antes de pasar el gate crítico del anterior.

### Dependencias externas que conviene iniciar cuanto antes

1. Disponer de una cuenta Pey habilitada para CoDi, API key y mecanismo de registro de webhook.
2. Confirmar cuenta bancaria receptora y permisos de prueba con importes pequeños.
3. Confirmar con Pey **si existe idempotencia en creación de QR y cómo recuperar un QR sin ID tras timeout**. Hasta entonces, **prohibido el reintento automático ciego**.
4. Crear proyectos aislados en Supabase/Vercel y configurar las credenciales de OpenAI de forma privada.
5. Verificar condiciones de audio/retención y presupuestos de proveedores antes de pagos de demo reales.

**Bloqueo:** la demo bancaria real no se puede declarar completa hasta confirmar el circuito con Pey; todas las etapas previas se pueden implementar con un adaptador simulado.

---

## 3. Roadmap por hitos (orden recomendado)

### H0 — Bootstrap, reglas de repo y cimientos de UI

**Meta:** proyecto ejecutable localmente y listo para añadir módulos con los contratos congelados.

**Tareas**
- [ ] Crear Next.js 16 App Router + React + TypeScript estricto; configurar alias y estructura del monolito.
- [ ] Configurar Tailwind CSS 4, shadcn/ui, Lucide, fuentes y tokens de `DESIGN.md`.
- [ ] Definir carpetas por dominio: `identity`, `merchant`, `voice`, `charges`, `payments`, `sales`, `preferences`; adaptadores externos separados.
- [ ] Configurar lint, typecheck, test runner, E2E y CI básicos.
- [ ] Documentar `.env.example` **sin** secretos e interfaces públicas de configuración.
- [ ] Implementar shell PWA, manifest mínimo, HTTPS en Preview/Production y fallback offline informativo (sin crear cobros offline).
- [ ] Preparar estados base y componentes genéricos de UI, sin agregar pantallas nuevas.

**Gate:** `lint`, `typecheck`, tests de ejemplo y build pasan; tokens de `DESIGN.md` están integrados; PWA abre en un teléfono de pruebas.

### H1 — Persistencia, autenticación y seguridad mínima

**Meta:** un comerciante autenticado con datos y permisos consistentes.

**Tareas**
- [ ] Crear esquema Drizzle/migraciones para `merchants`, `merchant_users`, `merchant_preferences`, `charges`, `codi_qrs`, `payments`, `payment_events`, `payment_incidents` conforme a la arquitectura congelada.
- [ ] Definir claves primarias UUID, FKs, índices, restricciones de unicidad y centavos enteros; documentar el mapeo de estados.
- [ ] Configurar Supabase Auth SSR y usuario/negocio preconfigurados sin registro público.
- [ ] Proteger endpoints con verificación de identidad y pertenencia al `merchant_id`.
- [ ] Crear A01 Acceso, A02 Configuración y cierre de sesión con las pantallas UX aprobadas.
- [ ] Configurar conexión pooled en runtime y conexión apropiada para migraciones.
- [ ] Agregar pruebas de acceso a negocio ajeno, sesión expirada y secretos ausentes.

**Gate:** migración limpia y repetible; usuario autorizado inicia sesión; otra sesión no puede consultar ni alterar recursos de otro comerciante; claves privadas no llegan al cliente.

### H2 — Cobro manual end-to-end con adaptador Pey simulado

**Meta:** completar la ruta financiera principal sin depender todavía de la disponibilidad bancaria.

**Tareas**
- [ ] Construir P01 Inicio y entrada manual → P02 Confirmación de importe.
- [ ] Validar monto positivo, máximo dos decimales, conversión exacta a centavos y confirmación explícita.
- [ ] Crear servicio `Charges` y `POST /api/charges` con clave de idempotencia por intención y persistencia previa a proveedor.
- [ ] Desarrollar interfaz de adaptador para QR/Pey y su implementación simulada **exclusiva de entornos no productivos**.
- [ ] Implementar P03, variantes `generando`, `esperando`, `pagado`, `expirado`, `cerrado localmente`, `incidencia`, `verificación no disponible`.
- [ ] Implementar temporizador/expiración visibles y cierre local sin borrar pagos ni impedir conciliación tardía.
- [ ] Implementar manejo conservador de respuesta incierta: no repetir automáticamente `POST /codi/qr`.
- [ ] Asegurar que toda confirmación visual provenga de estado persistido en backend y no de una acción manual de UI.

**Gate:** recorrido manual simulado sin dobles cobros al repetir clics/peticiones; estados distinguidos por texto; fallas y respuestas inciertas tratadas sin falso éxito; QR simulado rotulado solo como prueba en desarrollo.

### H3 — Webhooks, pagos y conciliación con datos simulados

**Meta:** demostrar robustez de registro financiero antes de activar Pey real.

**Tareas**
- [ ] Crear `POST /api/webhooks/pey`: cuerpo original, verificación de firma y deduplicación de entrega.
- [ ] Persistir eventos, pagos y actualización de cobro en una transacción DB atómica.
- [ ] Verificar QR, cuenta, importe, referencia y transacción; generar `payment_incidents` ante inconsistencias.
- [ ] Implementar consultas a pagos, conciliación manual y worker/job de conciliación idempotente.
- [ ] Separar la validación del webhook de la validación del comerciante; endpoint público **solo** con autenticación criptográfica del emisor.
- [ ] Implementar polling controlado en P03, recuperación de estado desde P01 y consulta de pagos al reabrir.
- [ ] Cubrir duplicados de `webhook-id`, misma transacción con diferentes entregas, pago posterior al vencimiento/cierre, DB temporalmente fallida y orden no determinista.

**Gate:** cada transacción bancaria simulada se registra **una sola vez**; firma inválida no acredita; incidentes no se cuentan como venta confirmada; reabrir la app preserva el estado real.

### H4 — Ventas, detalle y cierre de flujos UX

**Meta:** cerrar los siete flujos de UX con persistencia real en la aplicación.

**Tareas**
- [ ] Construir P04 Ventas con total y número de pagos del día y listado newest-first paginado.
- [ ] Construir A03 Detalle de transacción, solo lectura, con referencias, importe solicitado/recibido, fechas y estado.
- [ ] Mostrar resumen y movimientos recientes en P01; aviso condicional para retomar cobro.
- [ ] Aplicar zona horaria configurada del comercio y fecha **efectiva** del pago (`paid_at`) para totales diarios.
- [ ] No sumar cobros pendientes, expirados o incidentes hasta que exista pago verificado correctamente conciliado.
- [ ] Añadir estados sin datos, carga, offline, errores de consulta y actualización.
- [ ] Revisar UF-01–UF-07 con datos simulados de punta a punta.

**Gate:** los totales concuerdan con pagos conciliados; P01/P04/A03 muestran una sola versión consistente de la transacción; sesiones interrumpidas pueden recuperarse.

### H5 — Integración Pey real y validación bancaria

**Meta:** sustituir el adaptador simulado en producción con la API real y probar un pago real de $0.01.

**Regla del hackathon:** el QR que se envía a Pey es siempre $0.01 (1 centavo), tanto si el importe se capturó a mano como por voz. El importe confirmado en la app se guarda en el cobro y se muestra como la venta de ejemplo. El banco solo mueve $0.01; ese es el importe recibido. Un pago bancario de exactamente 1 centavo concilia el cobro y no se trata como diferencia de importe.

**Tareas**
- [ ] Configurar API key Pey privada, cuenta receptora preconfigurada y webhook HTTPS estable.
- [x] Integrar `POST /codi/qr` (`amount` fijo `0.01`, `numRef` numérico ≤7 caracteres, `expiration` inicial 600 s, `metadata` con referencia interna, `generateImage=false`). El importe capturado no se sustituye en `charges.amount_cents`.
- [x] Persistir `pey_qr_id`, `qrString`, metadatos y vencimiento; generar QR escaneable real con zona quieta.
- [x] Implementar `GET /transaction/codi/qr/:id` con paginación y, cuando exista ID, `GET /transaction/:id`.
- [x] Confrontar payloads reales de Pey contra contratos antes de inferir nombres, estados o campos opcionales.
- [ ] Probar webhook firmado real y consulta de respaldo; conservar procesamiento igual de idempotente que en H3.
- [x] Documentar comportamiento bajo timeout sin `pey_qr_id`; **bloquear reintento ciego** mientras Pey no confirme recuperación/idempotencia.
- [ ] Hacer un cobro real controlado: el QR es de $0.01 y el cobro guardado conserva el importe capturado en la app.

**Gate:** al menos un pago CoDi de $0.01 llega, se verifica una sola vez, el movimiento muestra el importe capturado y el detalle muestra $0.01 recibido; se recupera tras cerrar/reabrir la PWA. El total del día suma el dinero recibido, no el importe de ejemplo.

### H6 — Voz (STT + parser + anuncio audible)

**Meta:** completar la diferenciación del producto sin comprometer el flujo manual que ya funciona.

**Tareas**
- [ ] Capturar por pulsación usando `getUserMedia` + `MediaRecorder`, hasta 15 s inicialmente.
- [ ] Detectar formato MIME soportado y validar grabaciones en cliente y servidor.
- [ ] Crear `POST /api/voice/transcribe` autenticado con límites de frecuencia/tamaño.
- [ ] Integrar `gpt-transcribe`, sin conservar audio permanentemente; verificar condiciones del proveedor.
- [ ] Crear parser determinista de importes mexicanos (palabras, cifras, centavos) y rechazar ambigüedad, monto 0, negativos o múltiples cantidades.
- [ ] Mostrar texto e importe en P02; habilitar corregir, volver a hablar o captura manual.
- [ ] Anunciar **solo** nuevos pagos verificados con SpeechSynthesis en es-MX cuando sea permitido; no anunciar retroactivamente ni duplicar ante polling/reopen.
- [ ] Probar micrófono denegado, red lenta, audio incompatible y dispositivo sin voz española disponible.

**Gate:** comandos reales de importe común se convierten correctamente o permiten corrección; un pago confirmado reproduce **como máximo un anuncio** durante sesión activa; los fallos de voz nunca generan QR automáticamente.

### H7 — Hardening, infraestructura y demo

**Meta:** producto estable para la demostración de CobraVoz.

**Tareas**
- [ ] Configurar Vercel Production, Preview aislado, Supabase productivo y rotación/gestión de secretos.
- [ ] Programar Supabase Cron (`pg_cron` + `pg_net`) cada 5 min contra `GET /api/internal/reconcile`, con la URL y `CRON_SECRET` en Vault. Vercel Hobby no admite ese intervalo; el SQL está en `scripts/db/schedule-reconcile-cron.sql`.
- [ ] Revisar rate limiting, CSRF/Origin, cookies, CORS, no-cache de respuestas privadas, permisos mínimos y redacción de logs.
- [ ] Verificar respaldos Supabase Pro y documentar restauración/conciliación posterior.
- [ ] Añadir observabilidad de QR incierto, firma inválida, caída de DB, evento duplicado y tareas fallidas.
- [ ] Validar diseño en 320/360/390/430 px; foco, labels, contraste, tamaños táctiles y `prefers-reduced-motion`.
- [ ] Pruebas funcionales en Chrome Android y Safari iOS (permiso mic, grabación, QR, audio y PWA).
- [ ] Realizar demo completa, documentar evidencia, limitaciones conocidas y procedimiento de recuperación.

**Gate final:** cumple los 10 criterios de definición de terminado del PRD, sin funciones externas al MVP; demo real controlada y registro trazable de pago.

---

## 4. Orden de PR recomendado para trabajar con una IA

Mantener PR pequeños y verificables. Cada PR debe incluir descripción, evidencias, pruebas y riesgos restantes.

| PR | Resultado verificable | Dependencia |
|---|---|---|
| PR-01 | Bootstrap, tokens, testing y PWA mínima | Ninguna |
| PR-02 | Drizzle, migraciones y seeds controladas | PR-01 |
| PR-03 | Supabase Auth SSR, protección por comercio, A01/A02 | PR-02 |
| PR-04 | Componentes P01/P02 y captura manual | PR-03 |
| PR-05 | Charges, idempotencia y adaptador Pey mock | PR-04 |
| PR-06 | P03 QR/estados/expiración/cierre | PR-05 |
| PR-07 | Webhook, transacciones atómicas, eventos e incidentes | PR-05/06 |
| PR-08 | Reconciliación y recuperación de cobros | PR-07 |
| PR-09 | P04, A03, resumen diario y recientes | PR-07/08 |
| PR-10 | Integración Pey real y pago controlado | PR-08/09 + credenciales |
| PR-11 | Captura de voz, transcripción y parser | PR-04; integrar tras camino financiero |
| PR-12 | Síntesis de voz y compatibilidad móvil | PR-10/11 |
| PR-13 | Cron, observabilidad, seguridad y E2E final | PR-10/12 |

**Ruta crítica para una demo temprana:** PR-01 → PR-02 → PR-03 → PR-04 → PR-05 → PR-06 → PR-07 → PR-08 → PR-09 → PR-10 → PR-11 → PR-12 → PR-13. El trabajo de voz puede desarrollarse en paralelo a partir de PR-04, sin bloquear la validación del flujo bancario.

## 5. Pruebas obligatorias por categoría

### Unitarias
- Parser: `150`, «ciento cincuenta», «setenta y cinco con cincuenta», `0`, negativos, ambigüedad y decimales no admitidos.
- Dinero: conversión centavos ↔ pesos exacta, sin punto flotante en cálculos internos.
- Máquina de estados: transición permitida/no permitida; vencido/cerrado puede recibir evidencia de pago tardío.
- Fechas: total diario por zona horaria del comercio y `paid_at`, no `recorded_at`.

### Integración
- Doble `POST /api/charges` con igual idempotency key → misma intención, no duplicación.
- Doble evento con igual `webhook-id` → una aplicación de negocio.
- Dos eventos de una misma `transactionId` → un pago.
- Webhook con firma inválida → no acreditar.
- Webhook con QR desconocido/importe diferente → incidente, no falso «Pagado».
- DB falla antes del commit → no reconocer procesamiento como exitoso.
- Pago posterior al cierre local → registro y conciliación.
- Timeout al crear QR sin ID → sin reintento automático.

### E2E y dispositivos
- Login → P01 → P02 manual → P03 → pago → P04 → A03.
- Voz → transcripción → corregir → confirmar → QR.
- Denegar micrófono → entrada manual disponible.
- App cerrada durante pago → reabrir y consultar estado sin anuncio retroactivo.
- Android Chrome / iOS Safari, 320–430 px; PWA instalada cuando sea viable.

## 6. Operación y guardrails para el agente IA

1. **Antes de escribir código**, identifica archivos del repositorio que se modificarán y criterios de aceptación del PR actual.
2. Implementa **solo** el PR solicitado; evita refactors de módulos no relacionados y dependencias adicionales sin justificación.
3. Sigue `DESIGN.md` y la UX v1.0; no inventes pantallas, workflows, filtros o dashboard.
4. Nunca combines dinero y floats para operaciones financieras; centavos enteros en dominio.
5. Nunca crees QR ni confirmes pago automáticamente a partir de la transcripción.
6. Nunca uses screenshot, botón «Ya pagó», reloj expirado o estado de cliente como prueba de pago.
7. Nunca metas API key Pey ni OpenAI en código del cliente ni en `NEXT_PUBLIC_*`.
8. Simuladores solo en Local/Preview; producción debe conectarse a Pey real o quedar claramente bloqueada.
9. Si descubres una contradicción entre documentos congelados o un límite externo no documentado: detén esa parte, registra el bloqueo y propón un cambio formal. Continúa tareas independientes.
10. Al concluir cada PR entrega: archivos cambiados, comandos de verificación, resultados, riesgos abiertos y siguiente PR.

## 7. Checklist de lanzamiento MVP

- [ ] PRD, UX y arquitectura congelados respetados.
- [ ] Login, P01–P04 y A01–A03 funcionales.
- [ ] Flujo manual real (fallback) funciona sin voz.
- [ ] QR real de Pey generado por backend, escaneable, con referencia guardada.
- [ ] Webhook de pago real verificado y transacción persistida exactamente una vez.
- [ ] Conciliación manual y cron probados para IDs conocidos.
- [ ] Ningún pago pendiente se muestra como «Pagado».
- [ ] Voz reconoce importe o solicita corrección; sin auto-cobro.
- [ ] Audio opcional anuncia pago nuevo verificado una sola vez cuando navegador lo permite.
- [ ] Historial y total diario corresponden al registro bancario conciliado.
- [ ] Los secretos no se exponen; logs no incluyen contenido sensible.
- [ ] Pruebas básicas de Android e iOS y recuperación de sesión pasan.
- [ ] Incertidumbre de QR sin respuesta queda contenida/documentada y sin reintentos ciegos.
- [ ] Demo documentada con un pago real pequeño.

## 8. Primer encargo sugerido a Claude Code u otro agente

> Lee en este orden `CobraVoz_PRD_v1.0.md`, `CobraVoz_UX_Specification_v1.0.md`, `CobraVoz_Architecture_Specification_v1.0.md`, `DESIGN.md` y `IMPLEMENTATION_PLAN.md`. Estas decisiones están congeladas y `DESIGN.md` proporciona los defaults visuales para comenzar sin branding adicional. Ejecuta **solo PR-01 (bootstrap, tokens, testing y PWA mínima)**. Primero entrega un plan breve de archivos y criterios de aceptación; luego implementa, corre typecheck/lint/tests/build y presenta resultados. No integres Pey real, no agregues funcionalidades ni generes un QR ficticio presentado como real. Cuando termines PR-01, detente y solicita revisión del PR.

---

**Control de cambios:** el orden de implementación puede adaptarse sin alterar las decisiones congeladas. Todo cambio de producto, arquitectura bancaria o seguridad requiere aprobación explícita.
