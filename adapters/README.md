# adapters/

Adaptadores de infraestructura externa, separados de los módulos de dominio:

- `db/` — Postgres (Supabase) + Drizzle. Ver `db/README.md`.
- `pey/` — Pey / CoDi. Interfaz común con implementación real y simulada.
  El simulador es **exclusivo de Local/Preview** (`isSimulationAllowed`) y nunca se muestra como QR real.
- `stt/` — Transcripción de voz (OpenAI `gpt-transcribe`, H6).

Solo código de servidor. Las credenciales jamás llegan al cliente.
