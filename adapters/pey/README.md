# adapters/pey

Adaptador Pey / CoDi. Los servicios de dominio (`modules/charges`) solo conocen
la interfaz `PeyAdapter` (`types.ts`):

```ts
createCodiQr(request): Promise<{ status: "created", peyQrId, qrString, expiresAt }
                              | { status: "uncertain", reason }>
```

- **Una sola llamada por intención.** No hay reintentos internos ni automáticos:
  Pey no documenta idempotencia de creación ni cómo recuperar un QR sin id tras
  un timeout (Arquitectura §7 y §14). Todo lo que no sea un QR real y completo
  es `uncertain`.
- **El adaptador nunca lanza** por resultados de negocio; si lo hiciera, el
  servicio lo trata como `uncertain`.

## Simulador (`mock.ts`) — solo Local/Preview

- `getPeyAdapter()` solo lo entrega si `NEXT_PUBLIC_APP_ENV` es **explícitamente**
  `local` o `preview` y `VERCEL_ENV` no es `production`. Un valor ausente o
  desconocido **falla cerrado** (`PeyNotConfiguredError` → API 503), nunca cae al
  simulador.
- Su `qrString` empieza con `COBRAVOZ-MOCK|` y **no es un payload CoDi válido**;
  `isSimulatedQr()` permite rotularlo siempre como «QR de prueba».
- Importe mágico para probar el camino incierto: **$13.01**
  (`MOCK_UNCERTAIN_AMOUNT_CENTS`) simula un timeout.

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
total del día suma el centavo recibido.
