import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/** IPv4 de esta máquina. En desarrollo, Next solo entrega su JavaScript a estos orígenes. */
function lanDevOrigins(): string[] {
  const origins = new Set<string>();
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      origins.add(entry.address);
    }
  }
  return [...origins];
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El micrófono lo usa la propia app (voz, H6); cámara y geolocalización no.
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Detección de conectividad (useOffline) para el banner global.
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // El service worker nunca debe quedar en caché para recibir actualizaciones.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
