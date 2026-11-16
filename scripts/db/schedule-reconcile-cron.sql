-- Conciliación cada 5 minutos desde Supabase Cron (pg_cron + pg_net).
--
-- Vercel Hobby rechaza un cron más de una vez al día, así que el horario no
-- vive en vercel.json. Este archivo NO entra en drizzle/ ni en `db:migrate`:
-- el Supabase local no precarga pg_cron y un migrate fallido bloquearía el
-- resto del esquema. Se ejecuta una vez en el SQL Editor del proyecto
-- Supabase alojado (o con psql contra su conexión directa).
--
-- Antes, en Vault (Dashboard → Project Settings → Vault), dos secretos.
-- El valor NO lleva el prefijo «Bearer»; la función lo agrega.
--
--   select vault.create_secret(
--     'https://tu-dominio.vercel.app/api/internal/reconcile',
--     'cobravoz_reconcile_url',
--     'URL de producción de GET /api/internal/reconcile'
--   );
--   select vault.create_secret(
--     '<el mismo CRON_SECRET configurado en Vercel>',
--     'cobravoz_cron_secret',
--     'Secreto Bearer del cron de conciliación'
--   );
--
-- Volver a ejecutar este archivo reemplaza el job del mismo nombre.
-- pg_net manda el GET al confirmar la transacción del job. El timeout es
-- 10 s, el tope práctico de una función en Vercel Hobby.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres;

create or replace function private.reconcile_pending()
returns void
language plpgsql
set search_path = pg_catalog
as $$
declare
  target text;
  secret text;
begin
  select decrypted_secret
    into target
  from vault.decrypted_secrets
  where name = 'cobravoz_reconcile_url';

  select decrypted_secret
    into secret
  from vault.decrypted_secrets
  where name = 'cobravoz_cron_secret';

  if coalesce(target, '') = '' or coalesce(secret, '') = '' then
    raise exception
      'Faltan los secretos de Vault cobravoz_reconcile_url o cobravoz_cron_secret';
  end if;

  if target !~ '^https://' then
    raise exception 'cobravoz_reconcile_url debe empezar por https://';
  end if;

  perform net.http_get(
    url := target,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function private.reconcile_pending() from public;
grant execute on function private.reconcile_pending() to postgres;

select cron.schedule(
  'cobravoz-reconcile',
  '*/5 * * * *',
  $$select private.reconcile_pending()$$
);

-- cron.job_run_details no se purga solo. Un segundo job diario conserva 7 días.
select cron.schedule(
  'cobravoz-cron-history-cleanup',
  '15 8 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
