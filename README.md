# CobraVoz

PWA para que pequeños comerciantes de México cobren con CoDi dictando el
importe. Cobra fácilmente, sin dejar de atender tu negocio.

La fuente de verdad está en [`docs/`](docs): PRD, UX, arquitectura, `DESIGN.md`
e `IMPLEMENTATION_PLAN.md` (orden de trabajo por hitos y PR).

## Requisitos

- Node.js ≥ 22 (desarrollado con 24) y npm.

## Empezar

Requiere Docker en marcha (Supabase local).

```bash
npm install
npm run db:start             # Supabase local (Postgres + Auth); la 1.ª vez descarga imágenes
npm run db:env               # genera .env.local con las URLs/claves locales (no se commitea)
npm run db:migrate           # aplica las migraciones de Drizzle
npm run db:seed              # comercio demo + usuario demo@cobravoz.local
npm run dev                  # http://localhost:3000
```

Acceso local: `demo@cobravoz.local` / `cobravoz-local-dev` (solo desarrollo; no hay
registro público, las cuentas se preconfiguran y se vinculan a un comercio).

### Importes

`modules/charges/amount.ts` es la única vía de texto → centavos (enteros, sin `float`;
máx. 2 decimales, > 0). P02 (`/cobro/confirmar`) exige la acción explícita
«Confirmar importe»; `?centavos=` se revalida siempre en el servidor.

### Cobros (PR-05) y pantalla P03 (PR-06)

`POST /api/charges` crea la intención (idempotente por `idempotencyKey`, persistida
**antes** de llamar a Pey) y `GET /api/charges/:id` la consulta. El `merchantId`
sale siempre de la sesión. Repetir la petición devuelve el mismo cobro sin volver
a llamar a Pey; si Pey no confirma el QR, el cobro queda en `qr_uncertain` y no se
reintenta a ciegas. En Local/Preview responde el simulador (`adapters/pey`):
importe **$13.01** fuerza un resultado incierto; en cualquier otro entorno la API
responde 503 hasta integrar Pey real (H5).

P03 (`/cobro/[id]`) es una sola pantalla con variantes según el estado **persistido**:
generando QR, esperando pago (QR dibujado localmente desde el `qrString` guardado,
importe, referencia y tiempo restante), verificación no disponible, pagado, expirado,
cerrado localmente, QR incierto e incidencia. Reglas:

- El estado sale siempre de `GET /api/charges/:id` (consulta periódica cada 5 s,
  pausada con la pestaña oculta, más «Consultar nuevamente»). Ningún botón ni el
  reloj del teléfono marcan un cobro como pagado, vencido o cerrado.
- El vencimiento lo aplica el **servidor al leer** (`waiting_payment` con
  `expires_at` pasado → `expired`); el tiempo restante se calcula con la hora del
  servidor (`serverTime`). Vencer no borra el QR ni impide conciliar un pago tardío.
- `POST /api/charges/:id/close` («Cerrar cobro») es un cierre **local**: solo desde
  `waiting_payment`, idempotente, con aviso de que no cancela el pago bancario. Si el
  cobro ya cambió (pagado, vencido) responde 409 con el estado real.
- Un QR del simulador se rotula siempre «QR de prueba».

### Autenticación y autorización

- **Supabase Auth SSR** (cookies). `proxy.ts` renueva la sesión y redirige a `/acceso`
  si falta (chequeo optimista); la autorización real se repite junto a los datos con
  `auth.getUser()` + vínculo `merchant_users` (`modules/identity`).
- El `merchant_id` **siempre sale de la sesión**, nunca del cliente.
- Rutas privadas: `/inicio`, `/configuracion`, `/cobro/*` (y `/api/*` con 401/403 propios).
- Los Route Handlers que mutan usan `withMerchantApi` (comprueba `Origin` y responde
  `Cache-Control: private, no-store`). Los Server Actions ya validan `Origin`.
- `npm run check:bundle` (tras `build`) falla si un secreto de servidor llega al cliente.

Detalles del modelo de datos, estados y seguridad: [`adapters/db/README.md`](adapters/db/README.md).

## Scripts

| Script                            | Qué hace                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js                                                    |
| `npm run lint`                    | ESLint                                                     |
| `npm run typecheck`               | Genera tipos de rutas y ejecuta `tsc --noEmit`             |
| `npm run test`                    | Pruebas unitarias y de componentes (Vitest)                |
| `npm run e2e`                     | E2E con Playwright contra el build (`npm run build` antes) |
| `npm run format` / `format:check` | Prettier                                                   |
| `npm run db:*`                    | Supabase local, migraciones y seed (ver `adapters/db`)     |
| `npm run test:db`                 | Pruebas de integración contra Postgres local               |
| `npm run check:bundle`            | Falla si hay secretos de servidor en el bundle del cliente |
| `npm run icons`                   | Regenera los iconos temporales de la PWA                   |
| `npm run check`                   | `lint` + `typecheck` + `test`                              |

La primera vez que se corran los E2E: `npx playwright install chromium`
(y `webkit` con `E2E_WEBKIT=1` para Safari iOS).

## Estructura

```
app/          Rutas (App Router): landing `/`, acceso `/acceso`, app `/inicio` y `/configuracion`, `/api`
components/   UI genérica (shadcn/ui + componentes de DESIGN.md) y PWA
lib/          Utilidades y configuración pública
modules/      Dominios del monolito modular (identity, merchant, voice, charges, ...)
adapters/     Infraestructura externa (db, pey, stt), solo servidor
proxy.ts      Renovación de sesión y redirección a /acceso
e2e/          Pruebas Playwright (las de sesión requieren Supabase local)
```

## Reglas que no se negocian

- Dinero en centavos enteros; nunca `float` en el dominio.
- Un pago solo es «Pagado» con evidencia bancaria verificada en backend.
- Nunca se crea un QR ni se confirma un pago a partir de la transcripción de voz.
- Claves de Pey, OpenAI y base de datos solo en servidor (jamás `NEXT_PUBLIC_*`).
- El adaptador Pey simulado solo existe en Local/Preview.
