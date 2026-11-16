import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/response.js';
import type { createDashboardService } from './dashboard.service.js';

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
        const rawLimit = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, rawLimit) : 50;
        const logs = await service.getAuditLogs(limit);
        sendSuccess(res, { logs });
      } catch (err) {
        next(err);
      }
    },
  };
}
