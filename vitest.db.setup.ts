try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables del entorno (p. ej. CI).
}
