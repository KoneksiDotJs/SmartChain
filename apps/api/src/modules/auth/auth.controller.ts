import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { SmartChainRole } from '../../middleware/auth.js';
import type { createAuthService } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  expectedRole: z
    .enum([
      'DIREKSI',
      'PROCUREMENT_MANAGER',
      'WAREHOUSE_OPERATOR',
      'LOGISTICS_MANAGER',
      'PARTNER',
      'SYSTEM_ADMIN',
    ])
    .optional(),
});

export function createAuthController(authService: ReturnType<typeof createAuthService>) {
  return {
    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(loginSchema, req.body);
        const result = await authService.login({
          email: body.email,
          password: body.password,
          expectedRole: body.expectedRole as SmartChainRole | undefined,
        });
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    personas(_req: Request, res: Response): void {
      const personas = authService.listPersonas();
      if (personas.length === 0) {
        res.status(404).json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Daftar persona demo tidak tersedia di mode production' },
        });
        return;
      }
      sendSuccess(res, { personas });
    },

    me(req: Request, res: Response): void {
      sendSuccess(res, { user: req.user ?? null });
    },
  };
}
