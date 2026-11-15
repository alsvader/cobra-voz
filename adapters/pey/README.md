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

## Pendiente (H5)

Implementación real: `POST /codi/qr` (`amount` en pesos desde centavos sin
`float`, `numRef` ≤ 7 dígitos, `expiration` 600 s, `metadata`, `generateImage=false`),
confrontando payloads reales antes de inferir campos.
