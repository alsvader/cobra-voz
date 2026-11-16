const FALLBACK_TIME_ZONE = "America/Mexico_City";

/** Zona IANA usable. Si el valor guardado no existe, se usa la de la demo. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return FALLBACK_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  let hour = read("hour");
  if (hour === 24) hour = 0;
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
    second: read("second"),
  };
}

/** Milisegundos que hay que sumar al UTC para obtener el reloj de esa zona. */
function offsetMs(instant: Date, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  return asUtc - instant.getTime();
}

/** Medianoche de ese día civil, como instante UTC. */
function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const adjusted = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(adjusted), timeZone));
}

/**
 * Día comercial `[start, end)` en la zona del comercio. El total de hoy usa
 * `paid_at` dentro de este intervalo, no la hora en que se guardó el aviso.
 */
export function businessDayRange(
  timeZone: string,
  now: Date,
): { start: Date; end: Date; timeZone: string } {
  const zone = resolveTimeZone(timeZone);
  const wall = wallClock(now, zone);
  const start = zonedMidnight(wall.year, wall.month, wall.day, zone);
  const next = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 1));
  const end = zonedMidnight(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    zone,
  );
  return { start, end, timeZone: zone };
}
