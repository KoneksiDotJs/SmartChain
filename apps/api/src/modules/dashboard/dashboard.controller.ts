import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createDashboardService } from './dashboard.service.js';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createDashboardController(service: ReturnType<typeof createDashboardService>) {
  return {
    async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const overview = await service.getOverview();
        sendSuccess(res, overview);
      } catch (err) {
        next(err);
      }
    },

    async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { limit } = parseWithSchema(auditQuerySchema, {
          limit: req.query.limit ?? 50,
        });
        const logs = await service.getAuditLogs(limit);
        sendSuccess(res, { logs });
      } catch (err) {
        next(err);
      }
    },
  };
}
