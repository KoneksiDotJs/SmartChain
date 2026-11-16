import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createAuthService } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export function createAuthController(authService: ReturnType<typeof createAuthService>) {
  return {
    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(loginSchema, req.body);
        const result = await authService.login(body);
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    personas(_req: Request, res: Response): void {
      sendSuccess(res, { personas: authService.listPersonas() });
    },

    me(req: Request, res: Response): void {
      sendSuccess(res, { user: req.user ?? null });
    },
  };
}
