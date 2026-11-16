import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createTmsService } from './tms.service.js';

const consolidateSchema = z.object({
  routeGroup: z.string().min(1).optional(),
  transportSurgePercent: z.number().min(0).max(200).optional(),
});

export function createTmsController(service: ReturnType<typeof createTmsService>) {
  return {
    async listShipments(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const routeGroup =
          typeof req.query.routeGroup === 'string' ? req.query.routeGroup : undefined;
        const partnerDistScope =
          req.user?.role === 'PARTNER' ? req.user.entityCode : undefined;
        const shipments = await service.listShipments(routeGroup, partnerDistScope);
        sendSuccess(res, { shipments });
      } catch (err) {
        next(err);
      }
    },

    async consolidate(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(consolidateSchema, req.body ?? {});
        const result = await service.consolidateRoutes(body, {
          id: req.user?.id ?? 'system',
          role: req.user?.role ?? 'SYSTEM',
        });
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
