import type { Response } from 'express';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    error: null,
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const payload: ApiResponse<null> = {
    success: false,
    data: null,
    error: { code, message, details },
  };
  return res.status(statusCode).json(payload);
}
