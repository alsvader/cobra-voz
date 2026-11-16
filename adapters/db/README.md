# adapters/db

Postgres (Supabase) + Drizzle ORM. Solo código de servidor.

## Archivos

| Archivo             | Qué es                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `schema/`           | Esquema Drizzle (fuente de verdad del modelo de datos v1.0)         |
| `create-db.ts`      | Fábrica de cliente sin dependencia de Next (seeds, pruebas)         |
| `client.ts`         | `getDb()` de runtime (`server-only`, perezoso, usa `DATABASE_URL`)  |
| `testing.ts`        | Utilidades de pruebas: transacciones con rollback y fixtures        |
| `schema.db.test.ts` | Pruebas de integración de restricciones (`npm run test:db`)         |
| `../../drizzle/`    | Migraciones SQL versionadas (generadas por drizzle-kit)             |
| `../../supabase/`   | Configuración de Supabase **local** (solo Postgres + Auth + Studio) |

## Flujo de trabajo local

```bash
npm run db:start     # levanta Supabase local (Docker)
npm run db:env       # genera .env.local con las URLs y claves locales
npm run db:migrate   # aplica drizzle/*.sql
npm run db:seed      # comercio demo + usuario demo@cobravoz.local
npm run test:db      # pruebas de integración contra la BD local
npm run db:reset     # borra todo y repite migrar + seed
npm run db:generate  # tras editar schema/: genera una migración nueva
```

Studio: <http://127.0.0.1:54323>. Los servicios que el MVP no usa (Realtime,
Storage, Edge Functions, Analytics) están desactivados en `supabase/config.toml`.

**Drizzle es el dueño de las migraciones.** `supabase/migrations` queda vacío a
propósito: no se mezclan las dos herramientas. Para cambios que Drizzle no
expresa (privilegios, funciones) se usa `drizzle-kit generate --custom`.
CI falla si el esquema cambia sin su migración.

## Decisiones de modelo

- **Dinero:** `amount_cents` entero, `> 0`, `currency = 'MXN'` (CHECK).
- **Idempotencia:** `unique (merchant_id, idempotency_key)` en `charges`.
- **Un pago, una vez:** `unique (provider, provider_transaction_id)` en `payments`.
  `unique (provider, webhook_id)` en `payment_events` deduplica entregas, pero
  **no** sustituye a la unicidad del pago.
- **`paid` exige evidencia:** `CHECK (status <> 'paid' OR paid_payment_id IS NOT NULL)`.
  La coherencia completa (pago conciliado, mismo QR) se garantiza en la
  transacción del servicio de pagos (PR-07).
- **QR solo si es real:** `codi_qrs` exige `pey_qr_id` y `qr_payload`. Si la
  creación queda incierta, el cobro existe **sin fila** en `codi_qrs`.
- **Fechas:** todo `timestamptz` en UTC. `paid_at` (fecha efectiva) separado de
  `recorded_at`; la zona del comercio solo se aplica al consultar.
- **Eventos:** solo se guardan entregas con **firma válida**; una firma
  inválida se rechaza sin persistir para no «quemar» un `webhook-id` legítimo.
  No se guarda el cuerpo crudo del webhook.
- **Borrados:** FKs financieras `ON DELETE RESTRICT` (trazabilidad). Solo
  `merchant_users` cae en cascada con su usuario de Auth.

## Estados del cobro (`charge_status`)

| Estado            | Significado                                                       | Suma a ventas |
| ----------------- | ----------------------------------------------------------------- | :-----------: |
| `created`         | Intención persistida; aún sin QR (la UI muestra «Generando QR»)   |      no       |
| `qr_uncertain`    | **Interno.** Pey no confirmó el QR (timeout). Sin reintento ciego |      no       |
| `waiting_payment` | QR real persistido; «Esperando pago»                              |      no       |
| `paid`            | Pago verificado y conciliado                                      |      sí       |
| `expired`         | Venció la vigencia; aún puede recibir pago tardío                 |      no       |
| `locally_closed`  | Cierre solo en CobraVoz; no cancela nada en el banco              |      no       |
| `incident`        | Anomalía pendiente de conciliación                                |      no       |

«Generando QR» y «Verificación no disponible» **no** se persisten: son estados
de interfaz/comunicación. Las transiciones se implementan en PR-05 a PR-08.

Implementadas hasta ahora (`modules/charges`, PR-05 y PR-06):

- `created` → `waiting_payment`: solo con un QR real y válido; la fila `codi_qrs`
  y el estado se escriben en la misma transacción.
- `created` → `qr_uncertain` (+ incidencia `qr_creation_uncertain` abierta): Pey
  no confirmó el QR, la respuesta no es válida o el QR no pudo persistirse.
  También si un cobro queda en `created` más de 60 s sin resolver.
- `waiting_payment` → `expired`: el servidor lo aplica al leer el cobro cuando
  `expires_at <= ahora` (UPDATE condicional al estado). No equivale a «pago
  rechazado»; el QR y el cobro se conservan para un posible pago tardío.
- `waiting_payment` → `locally_closed` (`closed_at` = ahora): «Cerrar cobro»,
  solo desde `waiting_payment` y con UPDATE condicional (si llegó un pago en
  paralelo, gana el pago). Cierre local: no cancela nada en el banco.
- Nunca se reintenta la creación del QR por cuenta propia.
- `waiting_payment`, `expired`, `locally_closed` o `incident` → `paid`: solo con
  un pago conciliado (`payments.reconciliation_status = reconciled`) y
  `paid_payment_id` apuntando a él. Un pago tardío que coincide también entra
  por aquí.
- Esos mismos estados, salvo `paid`, → `incident` cuando el aviso firmado no
  coincide en importe, referencia o cuenta. El pago se guarda, pero no suma.
- Un QR desconocido no crea cobro: solo el evento y una incidencia `unknown_qr`.

## Seguridad

- **RLS activo en todas las tablas**, sin políticas, y **privilegios revocados**
  a `anon`/`authenticated` (migración `0001`). La app accede solo por el backend
  (rol privilegiado) con scoping explícito por `merchant_id` derivado de la
  sesión (Arquitectura §11). `schema.db.test.ts` lo verifica, incluso por HTTP
  contra la API REST de Supabase con la clave publicable.
- El seed y las pruebas **se niegan a correr** contra una base que no sea local.
- `DATABASE_URL` en Supabase remoto debe apuntar al **transaction pooler**; el
  cliente usa `prepare: false` por esa razón.
