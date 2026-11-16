import fs from 'node:fs';
import path from 'node:path';

export interface AppEnv {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  corsOrigin: string;
  databaseUrl: string;
}

/**
 * Loads .env from cwd or monorepo root if variables are not already in process.env.
 */
export function ensureEnvLoaded(): void {
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
  return {
    port: Number(process.env.PORT ?? 4000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    jwtSecret: process.env.JWT_SECRET ?? 'smartchain-dev-jwt-secret-change-me',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgresql://smartchain:smartchain_dev_password@localhost:5432/smartchain_db?schema=public',
  };
}
