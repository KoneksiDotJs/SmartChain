import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { loadEnv } from '../config/env.js';
import { AppError } from '../lib/response.js';

export type SmartChainRole =
  | 'DIREKSI'
  | 'PROCUREMENT_MANAGER'
  | 'WAREHOUSE_OPERATOR'
  | 'LOGISTICS_MANAGER'
  | 'PARTNER'
  | 'SYSTEM_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: SmartChainRole;
  entityCode?: string;
  tokenVersion?: number;
}

export interface PersistedAuthState {
  id: string;
  email: string;
  name: string;
  role: SmartChainRole;
  entityCode: string | null;
  isActive: boolean;
  tokenVersion: number;
}

export type UserAuthLookup = (userId: string) => Promise<PersistedAuthState | null>;

const JWT_ISSUER = 'smartchain-api';
const JWT_AUDIENCE = 'smartchain-clients';

const jwtClaimSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum([
    'DIREKSI',
    'PROCUREMENT_MANAGER',
    'WAREHOUSE_OPERATOR',
    'LOGISTICS_MANAGER',
    'PARTNER',
    'SYSTEM_ADMIN',
  ]),
  entityCode: z.string().optional(),
  tokenVersion: z.number().int().min(0).optional(),
});

let registeredUserLookup: UserAuthLookup | null = null;

export function registerUserAuthLookup(lookup: UserAuthLookup | null): void {
  registeredUserLookup = lookup;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signJwtToken(user: AuthUser): string {
  const { jwtSecret } = loadEnv();
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      entityCode: user.entityCode,
      tokenVersion: user.tokenVersion ?? 0,
    },
    jwtSecret,
    {
      expiresIn: '12h',
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
}

export function verifyJwtToken(token: string): AuthUser {
  const { jwtSecret } = loadEnv();
  const decoded = jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  const parsed = jwtClaimSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new AppError('Klaim token autentikasi tidak valid', 401, 'INVALID_TOKEN');
  }
  return parsed.data;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Token autentikasi Bearer diperlukan', 401, 'UNAUTHORIZED'));
    return;
  }

  const token = authHeader.slice(7).trim();
  let decoded: AuthUser;
  try {
    decoded = verifyJwtToken(token);
  } catch {
    next(new AppError('Token autentikasi tidak valid atau kedaluwarsa', 401, 'INVALID_TOKEN'));
    return;
  }

  const { demoAuthEnabled } = loadEnv();
  if (decoded.id.startsWith('demo-')) {
    if (!demoAuthEnabled) {
      next(new AppError('Token mode demo tidak diizinkan pada lingkungan produksi', 401, 'INVALID_TOKEN'));
      return;
    }
    req.user = decoded;
    next();
    return;
  }

  if (!registeredUserLookup) {
    req.user = decoded;
    next();
    return;
  }

  void registeredUserLookup(decoded.id)
    .then((persisted) => {
      if (!persisted || !persisted.isActive) {
        next(new AppError('Akun tidak ditemukan atau telah dinonaktifkan', 401, 'ACCOUNT_DISABLED'));
        return;
      }
      if ((decoded.tokenVersion ?? 0) !== persisted.tokenVersion) {
        next(new AppError('Token tidak lagi berlaku setelah pembaruan akses atau sandi', 401, 'TOKEN_REVOKED'));
        return;
      }
      req.user = {
        id: persisted.id,
        email: persisted.email,
        name: persisted.name,
        role: persisted.role,
        entityCode: persisted.entityCode ?? undefined,
        tokenVersion: persisted.tokenVersion,
      };
      next();
    })
    .catch(() => {
      next(new AppError('Gagal memverifikasi status akun pada basis data', 503, 'AUTH_STORE_UNAVAILABLE'));
    });
}

export function requireRoles(...allowedRoles: SmartChainRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Pengguna belum terautentikasi', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Peran ${req.user.role} tidak memiliki otorisasi untuk operasi ini`,
          403,
          'FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}
