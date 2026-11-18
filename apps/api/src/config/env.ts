import fs from 'node:fs';
import path from 'node:path';

export interface AppEnv {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  corsOrigin: string;
  databaseUrl: string;
  demoAuthEnabled: boolean;
}

const INSECURE_JWT_PLACEHOLDERS = new Set([
  'smartchain-dev-jwt-secret-change-me',
  'replace-with-strong-secret-in-production',
]);

let envLoadedOnce = false;

/**
 * Loads .env from cwd or monorepo root once if variables are not already in process.env.
 */
export function ensureEnvLoaded(): void {
  if (envLoadedOnce) return;
  envLoadedOnce = true;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

export function loadEnv(): AppEnv {
  ensureEnvLoaded();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const rawJwtSecret = process.env.JWT_SECRET?.trim();

  if (
    nodeEnv === 'production' &&
    (!rawJwtSecret || rawJwtSecret.length < 32 || INSECURE_JWT_PLACEHOLDERS.has(rawJwtSecret))
  ) {
    throw new Error(
      'Konfigurasi tidak aman: JWT_SECRET wajib disetel minimal 32 karakter dan bukan nilai contoh pada NODE_ENV=production.',
    );
  }

  return {
    port: Number(process.env.PORT ?? 4000),
    nodeEnv,
    jwtSecret: rawJwtSecret || 'smartchain-dev-jwt-secret-change-me',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgresql://smartchain:smartchain_dev_password@localhost:5432/smartchain_db?schema=public',
    demoAuthEnabled: nodeEnv !== 'production' && process.env.DISABLE_DEMO_AUTH !== 'true',
  };
}
