import { test as base, expect, type Page } from "@playwright/test";
import { createTenant, deleteTenant, type Tenant } from "./tenants";

type Fixtures = {
  /** Comercio A con usuario propio (se elimina al terminar la prueba). */
  tenant: Tenant;
  /** Comercio B, para comprobar el aislamiento entre comercios. */
  otherTenant: Tenant;
};

async function withTenant(
  provide: (tenant: Tenant) => Promise<void>,
  options?: Parameters<typeof createTenant>[0],
) {
  const tenant = await createTenant(options);
  try {
    await provide(tenant);
  } finally {
    await deleteTenant(tenant);
  }
}

export const test = base.extend<Fixtures>({
  tenant: async ({}, use) => withTenant(use, { label: "Tienda A" }),
  otherTenant: async ({}, use) => withTenant(use, { label: "Tienda B" }),
});

export { expect };

/** Inicia sesión por la pantalla A01, como lo haría la persona usuaria. */
export async function login(
  page: Page,
  tenant: Pick<Tenant, "email" | "password">,
) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(tenant.email);
  await page.getByLabel("Contraseña").fill(tenant.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

/** Nombre de la cookie de sesión de @supabase/ssr para el Supabase configurado. */
export function authCookieName(): string {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
  return `sb-${host.split(".")[0]}-auth-token`;
}

/** Inicia sesión y espera a llegar a Inicio (flujo exitoso). */
export async function signIn(
  page: Page,
  tenant: Pick<Tenant, "email" | "password">,
) {
  await login(page, tenant);
  await expect(page).toHaveURL(/\/inicio$/);
}
