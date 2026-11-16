import type { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/response.js';

interface PrismaKnownErrorLike {
  code?: string;
  meta?: unknown;
}

export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(res, 404, 'NOT_FOUND', `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (typeof err === 'object' && err !== null && 'code' in err) {
    const prismaErr = err as PrismaKnownErrorLike;
    if (prismaErr.code === 'P2002') {
      return sendError(res, 409, 'CONFLICT_UNIQUE', 'Terjadi konflik data unik pada basis data', prismaErr.meta);
    }
    if (prismaErr.code === 'P2025') {
      return sendError(res, 404, 'RECORD_NOT_FOUND', 'Entitas yang diminta tidak ditemukan', prismaErr.meta);
    }
  }

  const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal server';
  return sendError(res, 500, 'INTERNAL_ERROR', message);
}
