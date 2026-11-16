import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { SmartChainRole } from '../../middleware/auth.js';
import { DEMO_PERSONAS, createAuthService } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const demoSwitchSchema = z.object({
  role: z.enum(['DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER', 'PARTNER']),
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

    demoSwitch(req: Request, res: Response, next: NextFunction): void {
      try {
        const body = parseWithSchema(demoSwitchSchema, req.body);
        const result = authService.issueDemoToken(body.role as SmartChainRole);
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    me(req: Request, res: Response): void {
      sendSuccess(res, { user: req.user ?? null, availableRoles: DEMO_PERSONAS });
    },
  };
}
