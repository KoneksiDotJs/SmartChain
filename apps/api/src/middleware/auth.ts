import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';
import { AppError } from '../lib/response.js';

export type SmartChainRole =
  | 'DIREKSI'
  | 'PROCUREMENT_MANAGER'
  | 'WAREHOUSE_OPERATOR'
  | 'LOGISTICS_MANAGER'
  | 'PARTNER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: SmartChainRole;
  entityCode?: string;
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
  return jwt.sign(user, jwtSecret, { expiresIn: '12h' });
}

export function verifyJwtToken(token: string): AuthUser {
  const { jwtSecret } = loadEnv();
  return jwt.verify(token, jwtSecret) as AuthUser;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Token autentikasi Bearer diperlukan', 401, 'UNAUTHORIZED'));
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    req.user = verifyJwtToken(token);
    next();
  } catch {
    next(new AppError('Token autentikasi tidak valid atau kedaluwarsa', 401, 'INVALID_TOKEN'));
  }
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
