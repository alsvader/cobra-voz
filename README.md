# CobraVoz

PWA para que pequeños comerciantes de México cobren con CoDi dictando el
importe. Cobra fácilmente, sin dejar de atender tu negocio.

La fuente de verdad está en [`docs/`](docs): PRD, UX, arquitectura, `DESIGN.md`
e `IMPLEMENTATION_PLAN.md` (orden de trabajo por hitos y PR).

## Requisitos

- Node.js ≥ 22 (desarrollado con 24) y npm.

## Empezar

```bash
npm install
cp .env.example .env.local   # sin secretos en el repo
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                            | Qué hace                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js                                                    |
| `npm run lint`                    | ESLint                                                     |
| `npm run typecheck`               | Genera tipos de rutas y ejecuta `tsc --noEmit`             |
| `npm run test`                    | Pruebas unitarias y de componentes (Vitest)                |
| `npm run e2e`                     | E2E con Playwright contra el build (`npm run build` antes) |
| `npm run format` / `format:check` | Prettier                                                   |
| `npm run icons`                   | Regenera los iconos temporales de la PWA                   |
| `npm run check`                   | `lint` + `typecheck` + `test`                              |

La primera vez que se corran los E2E: `npx playwright install chromium`
(y `webkit` con `E2E_WEBKIT=1` para Safari iOS).

## Estructura

```
app/          Rutas (App Router): landing `/` y aplicación del comerciante `/inicio`
components/   UI genérica (shadcn/ui + componentes de DESIGN.md) y PWA
lib/          Utilidades y configuración pública
modules/      Dominios del monolito modular (identity, merchant, voice, charges, ...)
adapters/     Infraestructura externa (db, pey, stt), solo servidor
e2e/          Pruebas Playwright
```

## Reglas que no se negocian

- Dinero en centavos enteros; nunca `float` en el dominio.
- Un pago solo es «Pagado» con evidencia bancaria verificada en backend.
- Nunca se crea un QR ni se confirma un pago a partir de la transcripción de voz.
- Claves de Pey, OpenAI y base de datos solo en servidor (jamás `NEXT_PUBLIC_*`).
- El adaptador Pey simulado solo existe en Local/Preview.
