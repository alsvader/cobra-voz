# adapters/pey

Adaptador Pey / CoDi. Los servicios de dominio (`modules/charges`) solo conocen
la interfaz `PeyAdapter` (`types.ts`):

```ts
createCodiQr(request): Promise<{ status: "created", peyQrId, qrString, expiresAt }
                              | { status: "uncertain", reason }>
createCodiPush(request): Promise<{ status: "created", transactionId, codiId, expiresAt }
                                 | { status: "uncertain", reason }>
createPaymentLink(request): Promise<{ status: "created", peyPaymentLinkId, url, expiresAt }
                                    | { status: "rejected", errorType }
                                    | { status: "uncertain", reason }>
```

- **Una sola llamada por intención.** No hay reintentos internos ni automáticos:
  Pey no documenta idempotencia de creación ni cómo recuperar un QR, un aviso
  o un enlace sin id tras un timeout (Arquitectura §7 y §14). Un 400 al crear
  el enlace es `rejected`: no existe. Todo lo demás que no sea un instrumento
  real y completo es `uncertain`.
- **El adaptador nunca lanza** por resultados de negocio; si lo hiciera, el
  servicio lo trata como `uncertain`.

## Simulador (`mock.ts`) — solo Local/Preview

- `getPeyAdapter()` solo lo entrega si `NEXT_PUBLIC_APP_ENV` es **explícitamente**
  `local` o `preview` y `VERCEL_ENV` no es `production`. Un valor ausente o
  desconocido **falla cerrado** (`PeyNotConfiguredError` → API 503), nunca cae al
  simulador.
- Su `qrString` empieza con `COBRAVOZ-MOCK|` y **no es un payload CoDi válido**;
  `isSimulatedQr()` permite rotularlo siempre como «QR de prueba».
- Importes mágicos, iguales para QR, notificación y enlace: **$13.01**
  (`MOCK_UNCERTAIN_AMOUNT_CENTS`) simula un timeout al crear. **$13.02**
  responde pagado al consultar. **$13.03** simula que la consulta no responde.
  Cualquier otro importe se queda en espera.
- El aviso de prueba usa `transactionId` con prefijo `mock-pn-` y un `codiId`
  de 20 dígitos. Vive en memoria: si el proceso se reinicia entre crear y
  consultar, la consulta dice que este proceso no envió esa notificación.

## Cliente real (`real.ts`) — producción

`getPeyAdapter()` lo entrega solo cuando el simulador no está permitido y hay
`PEY_API_KEY`. En Local y Preview la clave se ignora y sigue el simulador.

Contrato cotejado con el OpenAPI de Pey del 2026-10-20 (`https://api.pey.mx`):

- `POST /codi/qr`. El `amount` del cuerpo es siempre `0.01`, escrito como
  token decimal, aunque el cobro guarde otro importe. `numRef` va como texto
  de hasta 7 dígitos (la documentación lo pide string, no número).
  `generateImage` es `false`. `metadata.chargeId` lleva el UUID del cobro.
  `bankAccountId` es la cuenta ya registrada.
- La respuesta que vale es `201` con `id` y `qrString`. La vigencia se calcula
  aquí (600 s): Pey no la devuelve. Timeout, otro HTTP o cuerpo irreconocible
  quedan `uncertain` y no se llama otra vez.
- `GET /transaction/codi/qr/:id` sigue `nextToken`. Solo `status: PAID` en MXN
  es un pago. El importe numérico pasa a centavos y se rechaza si no cae en
  dos decimales. Esa lista no trae `numRef` ni `bankAccountId`; la conciliación
  usa los del QR guardado. Si a un pago le falta importe o fecha, se confirma
  con `GET /transaction/:id`. Un fallo de consulta es `unavailable`, no «no
  hubo pago».

Un aviso bancario de exactamente 1 centavo cierra el cobro. El importe
capturado sigue en `charges.amount_cents`, el movimiento lo muestra, y el
total del día suma el centavo recibido, tanto si el pago vino de un QR como
de una notificación.

## Notificación (`POST /codi/pn`)

Misma clave, mismo monto de **$0.01** y la misma regla de una sola llamada.
El cuerpo exige `amount` > 0 y `phoneNumber` de 10 dígitos. También van
`concept`, `expiration` (600 s), `numRef` como texto de dígitos,
`bankAccountId` y `metadata.chargeId`. No se envía `generateImage`.

La respuesta que vale es **HTTP 200** con `transactionId` (ULID de 26
caracteres) y `codiId`. El folio puede ser 20 dígitos o un token con letras;
un número de 20 dígitos sin comillas se lee del texto crudo para que
`JSON.parse` no lo redondee. Timeout, otro HTTP, un cuerpo con `error.type`
o un folio irreconocible quedan `uncertain` y no se llama otra vez.

`GET /transaction/:transactionId` consulta el aviso. No existe un listado
equivalente a `GET /transaction/codi/qr/:id`. `PENDING` no es un pago. Un pago
válido trae `status: PAID`, `payableType: API_CODI_PN`, `paymentMethod: CODI`
y `currency: MXN`. Mientras está pendiente, el `numRef` viene en
`metadata.numRef` y el id de Pey es `id`, no `transactionId`. Si Pey omite
referencia o cuenta, la conciliación usa las guardadas al crear el aviso.

El webhook es el mismo `POST /api/webhooks/pey`. El evento del aviso es
`codi.pn.payment_received`: trae `transactionId` y no trae el celular ni un
`codiQrId`. Se casa con el `transactionId` guardado. Si
`metadata.externalMetadata.chargeId` viene y no coincide, es incidencia. Un
id desconocido no crea un cobro.

## Enlace (`POST /payment-link/create`)

En el MVP el `amount` del enlace es **$0.01**, el mismo centavo del QR y de la
notificación. El cobro sigue guardando el importe capturado. Una sola llamada.
No se usa `POST /payment-link/update`: otro importe es otro cobro.

El cuerpo lleva ese `amount` como token decimal, `successUrl` y `backUrl` HTTPS,
`hasTip: false`, `clientReferenceId` igual al id del cobro y
`metadata.chargeId`. Esas dos direcciones salen de `NEXT_PUBLIC_APP_URL` más
`/enlace/pago-completado` y `/enlace/pago-cancelado`. Si no son HTTPS, no se
llama a Pey.

- **200** con `id` y `url` HTTPS: se guarda `payment_links` y el cobro pasa a
  `waiting_payment`.
- **200** sin id o sin url usable: `uncertain`. No se reintenta.
- **400**: `rejected`. El enlace no existe. Se guarda solo `error.type`, nunca
  el mensaje libre. La intención queda cerrada.
- **500**, timeout o red: `uncertain`. No se reintenta.

`GET /payment-link/:id` es la consulta. `pending`, `processing` y `partial`
dejan el cobro en espera. `paid` con una transacción cierra el cobro si la
base es el centavo del MVP o coincide con el importe capturado. La propina y
la comisión no son un desajuste. `payments.amount_cents` guarda el dinero
liquidado (`transaction.amount`). Un 400, 403, 404 o 500 de esa consulta es
`unavailable`: no marca pagado y no borra el cobro.

El webhook sigue siendo el mismo. El evento es `payment_link.status_updated`
y se casa por `paymentLinkId`. Un id desconocido no crea un cobro. Si
`clientReferenceId` viene y no es el cobro guardado, es incidencia. Un `paid`
sin transacción usable se reconoce y no cierra el cobro.
