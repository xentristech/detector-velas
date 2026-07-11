// ---------------------------------------------------------------------------
// Rate limiting simple en memoria (ventana deslizante por clave/IP).
//
// Nota: funciona por instancia. En serverless (Vercel) cada instancia tiene su
// propio contador; para limites estrictos globales usar un store compartido
// (Upstash Redis, etc.). Aqui es suficiente para frenar abuso basico y proteger
// la cuota de OpenAI.
// ---------------------------------------------------------------------------

interface Entry {
  timestamps: number[];
}

const store = new Map<string, Entry>();

// Limpieza perezosa: cada tanto se purga lo viejo para no crecer sin limite.
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

// Registra un intento para `key` y dice si esta dentro del limite.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  sweep(windowMs);
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };
  // Conservar solo los intentos dentro de la ventana.
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    store.set(key, entry);
    return { ok: false, remaining: 0, retryAfterSec };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return {
    ok: true,
    remaining: limit - entry.timestamps.length,
    retryAfterSec: 0,
  };
}

// Extrae una clave de cliente estable desde los headers de la peticion.
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0].trim() : "") ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
}
