# CobraVoz — Product Requirements Document (PRD)

**Versión:** 1.0  
**Estado:** APROBADO Y CONGELADO  
**Producto:** CobraVoz  
**Fecha de consolidación:** 15 de noviembre de 2026  
**Mercado inicial:** México  
**Idioma:** Español de México (`es-MX`)  
**Fuente de verdad:** este PRD, junto con `CobraVoz_UX_Specification_v1.0.md` y `CobraVoz_Architecture_Specification_v1.0.md`.

> **Nota de consolidación:** este archivo organiza en formato ejecutable para un equipo de desarrollo las decisiones funcionales aprobadas. Los identificadores de requisitos se presentan de forma normalizada para facilitar su rastreo. No amplía el alcance.

> **Cambio 2026-11-18.** Al confirmar el importe el comerciante elige «Código QR» o «Notificación». El QR sigue siendo el default. La notificación pide un celular de 10 dígitos, sin lada; CobraVoz no guarda el número completo. Pey envía el aviso, el cliente lo paga en su app y el mismo webhook y la misma conciliación cierran el cobro. El banco sigue moviendo $0.01. El total del día incluye ese pago conciliado y suma el dinero recibido. El anuncio al comerciante con la PWA cerrada sigue fuera de alcance: no es esta notificación.

## 1. Resumen ejecutivo

**CobraVoz** es una aplicación web instalable (PWA) para que pequeños comerciantes de México puedan cobrar por medio de CoDi usando la voz como entrada del importe. El comerciante dicta una cantidad, revisa y confirma lo reconocido, presenta un QR real o envía una notificación al celular del cliente mediante la API de Pey, recibe una confirmación visual y —si la aplicación está activa y el dispositivo lo permite— audible cuando el pago está verificado, y consulta sus ventas diarias e historial.

**Propuesta de valor:** «Cobra fácilmente, sin dejar de atender tu negocio».

CobraVoz **no** procesa tarjetas, no mueve fondos por cuenta propia y no es un punto de venta completo. Es una interfaz de cobro y seguimiento sobre la infraestructura bancaria de Pey/CoDi.

## 2. Problema, oportunidad y usuarios

### Problema

Los comerciantes que atienden simultáneamente pedidos, entregas y cobros tienen poco tiempo para interactuar con una interfaz compleja. Confirmar si un cliente realmente pagó es crítico: una captura de pantalla o una afirmación verbal del comprador no equivale a una acreditación bancaria verificada.

### Público principal

- Comerciante individual que opera personalmente un puesto de comida o negocio pequeño.
- Alta frecuencia de cobros de importes relativamente bajos.
- Uso de un teléfono móvil en un entorno potencialmente ruidoso, con conectividad variable.

### Público secundario

- Vendedores de mercados y tianguis con características operativas similares.

### Necesidades prioritarias

1. Crear cobros con pocos pasos.
2. Poder corregir fácilmente errores de voz.
3. Saber inequívocamente si el pago fue verificado.
4. Consultar lo cobrado hoy y movimientos recientes.
5. Recuperar cobros ante interrupciones sin cobrar dos veces por accidente.

## 3. Objetivo y criterios de éxito del MVP

El objetivo es demostrar **de extremo a extremo con Pey/CoDi real** el recorrido:

1. El comerciante dicta un importe.
2. CobraVoz lo transcribe e interpreta.
3. El comerciante confirma el importe explícitamente.
4. CobraVoz genera y muestra un QR CoDi real, o envía una notificación al celular de 10 dígitos si el comerciante eligió esa forma.
5. El cliente realiza el pago.
6. El backend verifica y registra la confirmación de Pey.
7. La PWA muestra el éxito; anuncia el pago por voz solo si está activa y el navegador lo permite.
8. La transacción aparece en Ventas y se incorpora al total diario cuando corresponde.

### Criterios de aceptación de la demo

- No se crea un QR ni un aviso sin la confirmación del importe.
- El QR o la notificación corresponden al importe confirmado y a la cuenta bancaria configurada.
- Ningún pago pendiente o no verificable aparece como pagado.
- Un mismo evento o pago repetido no duplica las ventas.
- El comerciante puede usar captura manual si falla o no autoriza el micrófono.
- La información persiste si se cierra o recarga la aplicación.
- Se puede consultar el historial y el total del día conforme a pagos verificados.

**No son criterios de aceptación:** funcionar sin internet para crear QR, garantizar audio con la PWA cerrada, gestionar inventario o reemplazar los comprobantes oficiales de la institución financiera.

## 4. Alcance funcional

| Módulo | ID | En el MVP |
|---|---|---|
| Acceso y comercio | M01 | Registro con correo y contraseña sin verificación de correo, login, sesión, consulta de negocio y cuenta receptora compartida; preferencias de audio |
| Cobro por voz | M02 | Pulsar para hablar, transcribir, interpretar, revisar, corregir o capturar importe manualmente |
| QR y pagos CoDi | M03 | Crear un QR real o una notificación CoDi mediante Pey, recibir webhook, consultar, conciliar y persistir pagos |
| Confirmación y notificaciones | M04 | Feedback de estados, confirmación visual y audio de pagos nuevos verificados cuando aplique |
| Ventas | M05 | Total cobrado hoy, número de pagos conciliados, movimientos recientes e historial |

### Restricciones de alcance

- Varios comercios pueden registrarse. Todos usan la misma cuenta receptora Pey, configurada en el servidor.
- Una solicitud de cobro **visible y activa** por sesión del comerciante; no se abre otra por duplicación de pulsaciones.
- Idioma de interfaz y voz: español de México.
- PWA mobile-first; no aplicación nativa en el MVP.
- No existen roles administrativos públicos ni gestión multiusuario en la interfaz.

## 5. Fuera de alcance

No implementar en el MVP:

- Inventario, catálogo, menú, pedidos, comandas o tickets fiscales.
- Integración con tarjetas, terminales o pasarelas diferentes de Pey/CoDi.
- Múltiples negocios, múltiples cuentas receptoras o cambios de cuenta por el comerciante.
- Marcar manualmente un cobro como pagado.
- Reembolsos, devoluciones, cancelación bancaria o contracargos administrados desde la app.
- Facturación electrónica, exportación contable, filtros avanzados, gráficas o reportes complejos.
- Verificación de correo, recuperación de contraseña, panel administrativo y equipos con múltiples permisos.
- Reconocimiento continuo, activación por palabra clave o asistente conversacional.
- Anuncios de pagos cuando la PWA está cerrada. La notificación CoDi al celular del cliente sí está en alcance.
- QR de demostración falso presentado como cobro real.

## 6. Casos de uso

### CU-01 — Dictar importe y cobrar

**Actor:** comerciante autenticado.  
**Precondición:** hay conexión y no existe un cobro activo incompatible.  
**Secuencia:** Inicio → grabación breve → STT → parser → P02 → elegir QR o notificación → confirmar → Pey crea el instrumento → P03 espera → confirmación bancaria → éxito.  
**Resultado:** el pago verificado queda persistido y aparece en el historial.

### CU-02 — Corregir reconocimiento erróneo

**Evento:** lo transcrito no corresponde al importe deseado o no se entiende.  
**Resultado:** puede volver a hablar o introducir la cantidad manualmente; no se crea un QR ni un aviso con una interpretación incierta.

### CU-03 — Confirmar pago exitoso

**Evento:** webhook válido o conciliación verificable confirma un pago.  
**Resultado:** feedback visual persistente, anuncio audible **una sola vez** solo para pago nuevo en sesión activa y, tras la acción del usuario, nuevo cobro o detalle.

### CU-04 — Cliente afirma haber pagado, sin verificación

**Evento:** el comprador dice que ya pagó pero CobraVoz no dispone de confirmación.  
**Resultado:** mostrar «Pago sin confirmar», ofrecer «Consultar nuevamente» y «Cerrar cobro» (cierre únicamente local), sin acreditar venta.

### CU-05 — Cambiar importe antes de cobrar

**Evento:** el comerciante detecta error en P02.  
**Resultado:** corregir número válido (máximo dos decimales), volver a hablar, cambiar la forma de cobro o cancelar. Una vez generado el QR o enviado el aviso, el importe de esa solicitud no se modifica.

### CU-06 — Consultar ventas del día e historial

**Evento:** consulta Inicio o Ventas.  
**Resultado:** total y número de pagos realmente confirmados, movimientos ordenados por fecha reciente y detalle de cada transacción.

### CU-07 — Retomar sesión interrumpida

**Evento:** el usuario pierde conexión, cierra o recarga la aplicación.  
**Resultado:** sincronización con el backend; si queda un cobro pendiente, ofrecer «Retomar cobro»; si fue pagado, mostrarlo al reabrir **sin reproducir audio retroactivo**.

## 7. Reglas de negocio (RN-01 a RN-20)

> Redacción normalizada a partir de los acuerdos funcionales congelados; prevalece el comportamiento especificado en las tres fuentes de verdad.

| ID | Regla |
|---|---|
| RN-01 | El registro crea un comercio con correo y contraseña. Todos los comercios usan la misma cuenta receptora Pey configurada en el servidor. El comerciante no la cambia desde la app. |
| RN-02 | Todo importe debe ser mayor que cero, estar expresado en MXN y tener como máximo dos decimales. |
| RN-03 | El comerciante debe revisar y confirmar explícitamente el importe antes de solicitar un QR o una notificación. |
| RN-04 | Si la voz falla o es ambigua, se debe permitir reintento o captura manual; nunca asumir un importe. |
| RN-05 | El importe de una solicitud no se modifica después de generar el QR o de enviar el aviso. Una nueva cantidad, otra forma de cobro u otro celular requieren una nueva intención. |
| RN-06 | Solo puede existir un cobro visible activo por sesión; la app evita acciones simultáneas incompatibles. |
| RN-07 | Cada intención de cobro posee un identificador interno único y protección contra peticiones duplicadas. |
| RN-08 | La vigencia inicial del QR y de la notificación es de 600 segundos. |
| RN-09 | Se muestra únicamente un QR real recibido de Pey; nunca un QR supuesto durante la generación. Una notificación no muestra un código: muestra los últimos 4 dígitos del celular. |
| RN-10 | Un pago solo es «Pagado» si la evidencia bancaria es verificable y cumple las validaciones de conciliación. |
| RN-11 | Los webhooks de Pey deben validar su firma y corresponder al QR o a la notificación, al importe y a la cuenta previstos. |
| RN-12 | Eventos y transacciones duplicadas se procesan idempotentemente y no duplican ventas. |
| RN-13 | «Pendiente» y «Verificación no disponible» no equivalen a pago rechazado. |
| RN-14 | Pagos tardíos, importes inconsistentes o referencias extrañas se preservan y gestionan como incidencias cuando aplique. |
| RN-15 | No existe opción para marcar manualmente un pago como pagado ni aceptar capturas como confirmación. |
| RN-16 | Los totales y el conteo de ventas incluyen solo pagos confirmados y correctamente conciliados. |
| RN-17 | Cobros, QR, notificaciones, pagos y eventos deben persistir y conservar trazabilidad; la app no depende de su sesión abierta para registrar pagos. El celular completo no se guarda. |
| RN-18 | Al reabrir la PWA se recupera el estado desde el servidor sin duplicar cobros ni repetir anuncios de voz. |
| RN-19 | Sin conexión no puede crearse un QR ni un aviso nuevos; se debe informar y conservar el contexto del usuario. |
| RN-20 | Las credenciales de Pey, OpenAI y acceso privilegiado a datos se almacenan únicamente en el servidor. |

### Aclaraciones de conciliación

- «Cerrar cobro» termina su presentación local, **no cancela irrevocablemente la orden bancaria**.
- Si llega un pago después del vencimiento o del cierre local, el servidor lo registra y reconcilia; se muestra el estado correcto al regresar.
- El total del día utiliza la fecha efectiva de pago (`paid_at`) en la zona horaria configurada para el comercio; no la fecha en que llegó el webhook.
- Los cobros expirados, pendientes, cerrados localmente o con incidencia **no cuentan** como ventas hasta que exista pago verificable y conciliado.
- Una respuesta incierta al crear el QR o el aviso no se reintenta automáticamente mientras no se resuelva si Pey pudo generarlo.

## 8. Estados funcionales

### Cobro

- **Creado:** intención persistida antes de solicitar el QR o el aviso.
- **Generando QR:** estado transitorio de interfaz y operación técnica en curso. Con notificación, el texto de espera es «Enviando aviso…».
- **Esperando pago:** QR real disponible, o aviso enviado, aún sin confirmación.
- **Pagado:** pago verificado y persistido.
- **Expirado:** la vigencia anunciada del QR ha concluido; no equivale a afirmar que jamás podrá recibirse un pago tardío.
- **Cerrado localmente:** el comerciante dejó de atender ese cobro, sin cancelación bancaria confirmada.
- **Incidencia:** se detectó una anomalía que necesita conciliación.

### Verificación / conectividad

- **Consultando**, **sin conexión**, **verificación temporalmente no disponible**, **recuperando sesión**.
- Son estados de comunicación, no conclusiones sobre el resultado bancario.

### Voz

- **Inactivo**, **escuchando**, **procesando**, **importe reconocido**, **no comprendido**, **permiso denegado**.

## 9. Pantallas dentro del alcance

| ID | Pantalla | Propósito |
|---|---|---|
| P01 | Inicio | Iniciar cobro por voz/manual; ver resumen de hoy, recientes y cobro pendiente |
| P02 | Confirmación del importe | Revisar/corregir el monto y elegir QR o notificación antes de cobrar |
| P03 | Cobro CoDi | Generación, espera con QR o con aviso, resultado, expiración e incidencias en una pantalla dinámica |
| P04 | Ventas | Resumen diario e historial |
| A01 | Acceso | Inicio de sesión |
| A02 | Configuración | Datos del comercio, audio y salida |
| A03 | Detalle de transacción | Registro de solo lectura con estado y referencia |

La navegación principal contiene **Inicio** y **Ventas**. P02 y P03 se muestran sin navegación inferior para concentrar la atención en el cobro. La especificación detallada se encuentra en `CobraVoz_UX_Specification_v1.0.md`.

## 10. Requisitos no funcionales y calidad

### Fiabilidad financiera

- Persistencia en PostgreSQL; restricciones de unicidad y escrituras atómicas.
- Webhooks firmados y mecanismo adicional de consulta/conciliación.
- Nunca usar estado local del navegador como fuente de verdad financiera.
- Registro verificable de incidentes, reintentos y eventos duplicados.

### Usabilidad y accesibilidad

- Mobile-first, acciones táctiles grandes, contraste suficiente y estados perceptibles sin depender únicamente del color.
- Un CTA principal por pantalla, microcopy en español sencillo.
- Alternativa manual a comandos de voz y audio opcional.
- Visualización persistente del éxito hasta que el comerciante actúe.

### Privacidad

- No almacenar grabaciones permanentemente en CobraVoz.
- Informar el envío temporal del audio al proveedor de transcripción.
- Reducir datos sensibles en logs y respuestas públicas.

### Rendimiento

- Mostrar feedback inmediato cuando inicia o termina una acción.
- Medir la latencia desde el final del comando hasta el importe interpretable (objetivo inicial p95 ≤ 3 s, **por validar**).
- No hacer afirmaciones de disponibilidad en tiempo real no confirmadas por el backend.

## 11. Supuestos y dependencias

- Acceso autorizado a Pey, credenciales y cuenta CoDi receptora operativa.
- Disponibilidad de pagos reales de prueba con importes pequeños cuando corresponda.
- Permisos de micrófono y compatibilidad de captura de audio en los dispositivos objetivo.
- Costos y condiciones de OpenAI, Vercel y Supabase sujetos a validación.
- La recuperación de QR cuya creación dio timeout y no devolvió identificador debe confirmarse con Pey; **no se autoriza un reintento ciego**.

## 12. Definición de terminado del MVP

El MVP puede declararse listo para demo solo cuando:

1. A01 autentica al comerciante y protege rutas privadas.
2. P01 permite voz y captura manual.
3. P02 exige importe válido y confirmación expresa.
4. P03 obtiene un QR real de Pey, o confirma el envío del aviso, sin duplicar por doble clic.
5. Webhook válido registra el pago exactamente una vez; firma inválida no se acredita.
6. Se puede recuperar un pago mediante consulta/conciliación si falla la notificación.
7. El éxito se muestra visualmente y el audio funciona donde el navegador lo permita, sin repetirse.
8. P04 muestra total diario, pagos confirmados e historial; A03 expone detalle.
9. Las operaciones no verificadas permanecen pendientes o en incidencia, nunca marcadas como pagadas por suposición.
10. Una prueba de pago real de bajo importe confirma el circuito completo y queda documentada.

## 13. Control de cambios

**Este PRD v1.0 está congelado.** Cambios a alcance, reglas de negocio, pantallas o flujo bancario requieren una decisión explícita y registro de versión. `DESIGN.md` y `IMPLEMENTATION_PLAN.md` son especificaciones operativas derivadas y no pueden contradecirlo.

El cambio del 2026-11-18 agrega la notificación CoDi como forma de cobro alternativa al QR. No abre el anuncio al comerciante con la PWA cerrada.
