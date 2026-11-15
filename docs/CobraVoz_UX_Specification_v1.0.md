# CobraVoz — UX Specification

**Versión:** 1.0  
**Estado:** APROBADO Y CONGELADO  
**Fecha de consolidación:** 15 de noviembre de 2026  
**Idioma:** Español de México (`es-MX`)  
**Documentos vinculantes:** `CobraVoz_PRD_v1.0.md`, `CobraVoz_Architecture_Specification_v1.0.md`.

> Este documento codifica las decisiones de arquitectura de información, flujos, estados e interfaces de baja fidelidad ya aprobadas. No es un nuevo rediseño. `DESIGN.md` define su representación visual sin alterar estructura ni comportamiento.

## 1. Principios UX

1. **Cobrar antes que administrar:** el acceso principal inicia un cobro; lo demás es secundario.
2. **Una acción primaria por vista:** nunca competir con múltiples CTA principales.
3. **Verificar antes de afirmar:** solo presentar «Pagado» cuando el backend lo confirme de forma verificable y persistida.
4. **Voz opcional, no exclusiva:** siempre hay alternativa manual; el audio de confirmación es optativo.
5. **No perder contexto:** un cierre de navegador, reconexión o webhook tardío no borra transacciones.
6. **Pensado para operación con una mano:** objetivos táctiles amplios, importe legible al aire libre y lenguaje breve.
7. **Estados inequívocos:** pendiente, expirado, cerrado localmente, incidente y pagado no son sinónimos.

## 2. Arquitectura de información

### Navegación global

- Navegación inferior: **Inicio** (`P01`) y **Ventas** (`P04`) exclusivamente.
- `P02` Confirmación del importe y `P03` Cobro CoDi son un recorrido concentrado **sin** navegación inferior.
- `A02` Configuración: acceso secundario desde encabezado de Inicio.
- `A03` Detalle: desde movimiento reciente en Inicio, fila de Ventas o resultado de P03.
- `A01` Acceso: cuando la sesión no existe o es inválida; tras autenticación se recupera contexto permitido.
- Apertura/reapertura: mostrar Inicio y recuperar estado del servidor; si existe cobro pendiente, ofrecer **Retomar cobro**.
- La captura manual no es una pantalla adicional; permisos del micrófono se gestionan dentro de Inicio.

### Mapa de pantallas

| ID | Pantalla/vista | Navegación inferior | CTA principal |
|---|---|---|---|
| P01 | Inicio | Sí | Hablar para cobrar |
| P02 | Confirmación del importe | No | Confirmar importe |
| P03 | Cobro CoDi (una pantalla, estados dinámicos) | No | Depende del estado; p. ej., Nuevo cobro en éxito |
| P04 | Ventas | Sí | Consultar movimientos/abrir detalle |
| A01 | Acceso | No | Iniciar sesión |
| A02 | Configuración | No | Preferencia de audio / Cerrar sesión según contexto |
| A03 | Detalle de transacción | No | Volver |

## 3. Flujos de usuario aprobados

### UF-01 — Cobro dictado de inicio a fin

1. En `P01` comerciante activa micrófono y dicta una cantidad.
2. UI muestra escuchando → procesando, con opción de detener y errores visibles.
3. Servicio STT transcribe y parser devuelve importe candidato; si es ambiguo, pasar a `UF-02`.
4. En `P02` se presenta importe MXN prominente y la frase reconocida cuando proviene de voz.
5. Comerciante confirma explícitamente.
6. En `P03`, estado «Generando QR»: no mostrar un código ficticio.
7. Al recibir QR **real** de Pey, mostrar código, importe, referencia y tiempo restante; estado «Esperando pago».
8. Backend verifica evento/consulta bancarios y persiste el pago.
9. `P03` pasa a «Pago recibido»; mensaje visual persistente y anuncio audible una vez si app activa y audio permitido.
10. Acciones: **Nuevo cobro** (principal) o **Ver detalle** (secundaria).

**Invariante:** la interfaz jamás decide por sí sola si el pago ocurrió.

### UF-02 — Fallo o ambigüedad en reconocimiento

- Casos: permiso denegado, audio vacío, transcripción no interpretable, varias cantidades ambiguas, error de proveedor.
- Mostrar mensaje corto: «No pudimos reconocer el importe» o causa concreta cuando corresponda.
- Acciones: **Volver a hablar** y **Ingresar importe manualmente**.
- No reintentar grabación de forma automática, no enviar cantidades supuestas a Pey, no crear una pantalla de error dedicada.
- Si niega permisos, la ruta manual queda siempre disponible.

### UF-03 — Confirmación de pago exitoso

- Backend notifica estado persistido «Pagado» derivado de prueba bancaria verificable.
- `P03` mantiene estado de éxito hasta intervención del comerciante (no se autocierra).
- Indicar importe, referencia e identidad visual accesible (texto + ícono, nunca color solo).
- Anunciar «¡Pago recibido! Ciento cincuenta pesos» —importe variable— **una sola vez**, si la PWA está activa, audio habilitado y navegador lo permite.
- Webhook duplicado, actualización repetida o reapertura de PWA **no** repiten el sonido.
- Acciones: **Nuevo cobro** y **Ver detalle**.

### UF-04 — Comprador declara haber pagado, sin confirmación

- La interfaz permanece «Pago sin confirmar», no «Rechazado».
- Acciones: **Consultar nuevamente** y **Cerrar cobro** (cierre **local** con advertencia de que no equivale a cancelar el pago bancario).
- No aceptar capturas, declaraciones ni un botón «Marcar pagado».
- Problemas temporales de verificación no son evidencia de rechazo.
- Permitir que eventos tardíos sigan conciliándose después de cierre/expiración.

### UF-05 — Corrección del importe

- En `P02` permitir **Corregir importe** usando campo numérico integrado, **Volver a hablar**, **Cancelar**.
- Reglas: MXN, importe > 0, máximo dos decimales; evitar valores incompletos o inválidos.
- Cada cantidad editada debe pasar por la misma acción explícita **Confirmar importe**.
- Después de generar QR no se permite modificar su cantidad; una cantidad nueva requiere una nueva intención de cobro.

### UF-06 — Totales e historial

- `P01` muestra **Total cobrado hoy** y **Número de pagos confirmados**, además de movimientos recientes.
- `P04` muestra resumen diario + lista de movimientos ordenados de más reciente a más antiguo.
- Cada fila: importe, hora/fecha, estado en texto e ícono; selección abre `A03`.
- Incluir pendientes e incidencias en historial, pero **solo pagos verificados y conciliados** suman al total.
- Día comercial según zona horaria configurada del negocio; pagos tardíos pertenecen a la **fecha efectiva del pago** (`paid_at`).
- Lista progresiva con «Cargar movimientos anteriores».
- Sin gráficas, filtros avanzados, búsqueda, exportación ni reportes complejos.

### UF-07 — Interrupción y recuperación

- Al volver a abrir, entrar a `P01`, validar sesión y sincronizar con servidor.
- Cobro pendiente recuperable → aviso **Cobro pendiente** + **Retomar cobro**.
- Si llegó pago durante ausencia → mostrar registro confirmado, **sin mensaje hablado retroactivo**.
- Si conexión/proveedor no están disponibles → explicar incertidumbre, conservar referencia y no crear cobros repetidos.
- Reiniciar app no modifica una transacción bancaria ni la «marca» como rechazada.

## 4. Wireframes estructurales — contrato de implementación

> Los bloques siguientes describen contenido y prioridad; no fijan colores/estética. Es obligatorio mantener la jerarquía y navegación aprobadas.

### P01 — Inicio (aprobado v1.0)

**Orden visual:**
1. Encabezado con nombre del negocio y acceso a Configuración.
2. Acción dominante **Hablar para cobrar** con un control de micrófono grande; estados inactivo/escuchando/procesando.
3. Entrada alternativa **Ingresar importe manualmente**.
4. Aviso condicional de **cobro pendiente** con **Retomar cobro** (solo cuando hay uno).
5. Resumen de hoy: total cobrado y número de pagos verificados.
6. Movimientos recientes (abribles hacia A03).
7. Navegación inferior Inicio/Ventas.

**Estados:** permisos denegados, servicio de voz indisponible, sin conexión, cargando, sin movimientos, cobro pendiente recuperado.

**No hacer:** ocultar captura manual, presentar ventas no confirmadas como pagadas, iniciar un segundo QR desde aviso pendiente sin resolver intención.

### P02 — Confirmación del importe (aprobado v1.0)

**Orden visual:**
1. Encabezado contextual/Volver.
2. Importe MXN central y destacado.
3. Transcripción original **si proviene de voz**; omitirla si origen manual.
4. Acción principal **Confirmar importe**.
5. Opciones secundarias **Corregir importe**, **Volver a hablar**, **Cancelar**.

La corrección manual usa campo dentro de P02; validación visible y CTA deshabilitado durante petición en curso. Sin barra inferior.

### P03 — Cobro CoDi (aprobado v1.0)

**Una sola vista dinámica con estados:**

| Estado | Contenido indispensable | Acciones |
|---|---|---|
| Generando QR | Importe, indicador de carga, aviso «Generando código» | Evitar doble envío; cancelación segura si aplica |
| Esperando pago | QR **real**, importe, referencia y tiempo restante | Consultar nuevamente / Cerrar cobro |
| Verificación no disponible | QR/contexto cuando existe, mensaje explícito de incertidumbre | Consultar nuevamente / Cerrar cobro según estado |
| Pagado | Éxito persistente, importe, referencia | **Nuevo cobro** / Ver detalle |
| Expirado | Importe, estado, referencia, aclaración de posible pago tardío | Nuevo cobro con intención nueva / Ver detalle |
| Cerrado localmente | Indicar que no es cancelación bancaria | Regresar; detalle disponible |
| Incidencia | Explicación breve, referencia y situación no resuelta | Ver detalle / volver a Inicio |

- No incluir navegación inferior.
- P03 no es una secuencia de nuevas páginas para cada estado.
- No anunciar «Pago recibido» hasta que el backend confirme y persista evidencia.
- Advertir antes de **Cerrar cobro** que el cierre es local.
- Vencimiento de 600 segundos: valor inicial del contrato; no convertir automáticamente en «pago rechazado».

### P04 — Ventas (aprobado v1.0)

**Orden visual:**
1. Título «Ventas».
2. Resumen **Total cobrado hoy** y **Pagos confirmados hoy**.
3. Lista de movimientos descendente por fecha/hora con importe, estado e información temporal.
4. Acción **Cargar movimientos anteriores** (paginación incremental).
5. Navegación inferior Inicio/Ventas.

**Estados:** sin movimientos, cargando, offline, incidente temporal, actualización manual; no introducir gráficos, búsqueda ni filtros avanzados.

### A01 — Acceso (aprobado v1.0)

- Identidad CobraVoz, propuesta de valor breve.
- Correo electrónico y contraseña, botón **Iniciar sesión**.
- Mensajes claros de credenciales incorrectas, sesión expirada y problema de conexión.
- Una cuenta preconfigurada para el piloto; **sin** registro público ni administración de usuarios.

### A02 — Configuración (aprobado v1.0)

- Volver a Inicio.
- Nombre del negocio y cuenta receptora configurada en **solo lectura**, mostrando solo información no sensible.
- Interruptor **Anunciar pagos** (habilitado por defecto; preferencia persistida).
- Acción **Cerrar sesión**.
- El comercio **no** puede reemplazar la cuenta receptora desde esta pantalla.

### A03 — Detalle de transacción (aprobado v1.0)

- Volver a origen; importe, estado legible e iconografía.
- Importe solicitado, importe recibido si existe, fecha efectiva/fecha de registro cuando corresponda, hora, referencia y método CoDi.
- Estados pagado/pendiente/expirado/cerrado localmente/incidencia y explicación contextual.
- Datos **solo lectura**; nunca permitir edición o marcado manual como pagado.

## 5. Modelo de estados de UI

### Voz

`inactivo → escuchando → procesando → importe reconocido`  
Salidas alternativas: `no comprendido`, `permiso denegado`, `error de transcripción`, `sin conexión`.

- La grabación requiere acción explícita de inicio y detención.
- Evitar grabaciones simultáneas; sin escucha permanente.
- Ante error: reintentar manualmente o escribir importe.

### Cobros

`creado → generando QR → esperando pago → pagado` como camino ideal.  
Ramas: `QR incierto`, `expirado`, `cerrado localmente`, `incidencia` y `verificación no disponible` (este último como estado de comunicación, no necesariamente del pago).

- La única evidencia final de pago procede del backend.
- Un cobro expirado/cerrado puede asociarse a pago posterior; sincronizar sin perder rastro.

### Sincronización

- Cargar datos existentes desde backend al entrar o recuperar conectividad.
- En P03 pendiente: consultas periódicas controladas, sin WebSockets para MVP.
- En la apertura de P01: cargar resumen, pendientes y recientes.
- Sin internet: deshabilitar generación QR y mostrar situación; no falsear pago.

## 6. Jerarquía de acciones y microcopy

| Contexto | CTA principal | Acción secundaria / mensaje |
|---|---|---|
| Inicio normal | Hablar para cobrar | Ingresar importe manualmente |
| Inicio con cobro pendiente | Hablar para cobrar con resolución clara del pendiente | Retomar cobro (visibilidad reforzada) |
| Confirmación | Confirmar importe | Corregir importe / Volver a hablar / Cancelar |
| QR esperando | QR y estado visibles como objetivo principal | Consultar nuevamente / Cerrar cobro |
| Pago confirmado | Nuevo cobro | Ver detalle |
| Pago sin confirmar | Consultar nuevamente | Cerrar cobro (advertencia) |
| Sin permiso de micrófono | Ingresar importe manualmente | Cómo habilitar el micrófono |
| Ventas sin movimientos | — | «Aún no tienes movimientos» |
| Sin internet | — | «Sin conexión. No podemos generar un cobro nuevo.» |
| Error de transcripción | Volver a hablar | Ingresar importe manualmente |

**Copys de estado obligatorios:**

- «Generando QR» **no** implica que exista un código válido.
- «Esperando pago» cuando QR real ya está registrado.
- «Pago sin confirmar» cuando falta prueba bancaria.
- «¡Pago recibido!» exclusivamente cuando `Payments` confirma el evento y la persistencia.
- «Cobro expirado» no significa «Pago rechazado».
- «Cobro cerrado» debe aclarar «Solo se cierra en CobraVoz; no cancela el pago bancario».

## 7. Audio y feedback

- Anuncio predeterminado de pago nuevo verificado: **«¡Pago recibido! [importe en palabras]»** (`es-MX`).
- Audio habilitado por defecto, modificable desde A02; confirmación visual siempre presente.
- No reproducir automáticamente en reapertura, por polling repetido ni por webhook duplicado.
- Si se está grabando, nunca superponer síntesis y micrófono.
- Respetar bloqueo de audio del navegador, preferencias de reducción de movimiento y estado de app activa.
- Animaciones cortas y funcionales; ningún éxito debe depender de sonido o color.

## 8. Accesibilidad y responsive

- Diseño primario: teléfonos de **320 px** en adelante; comprobar especialmente 360, 375, 390, 430 px.
- Objetivos táctiles **mínimo 44 × 44 px**, preferiblemente 48 × 48 px para CTA.
- Texto funcional generalmente ≥14 px; cuerpo 16 px; importes mucho más destacados.
- Contraste WCAG AA para texto y controles; no comunicar éxito/alerta solo con color.
- Labels asociados a entradas, foco visible, lectura de estados con `aria-live` cuando aplique.
- Botones deshabilitados mientras se procesa una acción sensible; proteger también en backend.
- QR suficientemente grande, nítido y sin recortes; texto de importe siempre visible junto al código.
- Respetar `prefers-reduced-motion`; evitar animaciones llamativas que distraigan de cobranza.
- Mobile-first, sin requerir gestos ocultos o pantallas horizontales.

Los tokens y estilo concreto se detallan en `DESIGN.md` (guía nueva de implementación; no altera UX congelada).

## 9. Matriz de aceptación UX

| ID | Escenario a revisar | Condición de aprobación |
|---|---|---|
| UX-01 | Primer acceso | Login conduce a Inicio sin registro público |
| UX-02 | Dictar importe | Mostrar estado de escucha/procesamiento y P02 |
| UX-03 | Corregir importe | Misma P02; confirmación explícita obligatoria |
| UX-04 | Voz fallida | Alternativa manual visible, sin QR creado |
| UX-05 | Generar QR | Sin QR ficticio; QR real y mismo importe |
| UX-06 | Pago no verificado | Nunca mostrar éxito, permitir consulta |
| UX-07 | Webhook confirmado | Éxito persistente y una sola venta |
| UX-08 | Reapertura tras pago | Mostrar estado confirmado sin audio retroactivo |
| UX-09 | Pago tardío | Historial reconciliado y fecha efectiva correcta |
| UX-10 | Ventas | Solo pagos confirmados en totales, historial incluye estados |
| UX-11 | Audio desactivado | Confirmación visual intacta |
| UX-12 | Accesibilidad | Navegable por teclado/lector, contraste y tamaños táctiles |

## 10. Exclusiones, cambios y handoff

No añadir por iniciativa propia: onboarding largo, cuentas multiusuario, dashboards analíticos, filtros o gráficos, otras pasarelas, navegación adicional, asistente conversacional o notificaciones push. Mantener **P01–P04 y A01–A03**, **UF-01–UF-07**.

**Control de cambios:** esta UX Specification v1.0 está congelada. Cualquier cambio estructural debe proponerse por escrito y recibir aprobación explícita antes de implementarse.

**Handoff:** el equipo/IA debe leer primero el PRD, después esta UX Specification, la Architecture Specification y finalmente `DESIGN.md` y `IMPLEMENTATION_PLAN.md`.
