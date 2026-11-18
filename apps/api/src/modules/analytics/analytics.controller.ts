import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createAnalyticsService } from './analytics.service.js';

const querySchema = z.object({
  surgeMultiplier: z.coerce.number().min(1).max(10).optional(),
  leadTimeDays: z.coerce.number().int().min(1).max(60).optional(),
});

export function createAnalyticsController(service: ReturnType<typeof createAnalyticsService>) {
  return {
    async getForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = parseWithSchema(querySchema, req.query);
        const result = await service.getForecastOverview({
          demandSurgeMultiplier: query.surgeMultiplier,
          leadTimeOverrideDays: query.leadTimeDays,
        });
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    async getPerformance(_req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const result = await service.getPerformanceEvaluation();
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
