import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createSrmService } from './srm.service.js';

const fallbackSchema = z.object({
  haltedSupplierIdOrCode: z.string().min(1).optional(),
  haltedDays: z.number().int().min(1).max(90).optional(),
  materialId: z.string().min(1).optional(),
  factoryId: z.string().min(1).optional(),
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'HALTED', 'STANDBY']),
  haltedDays: z.number().int().min(0).max(90).default(0),
});

export function createSrmController(service: ReturnType<typeof createSrmService>) {
  return {
    async listSuppliers(_req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const suppliers = await service.listSuppliers();
        sendSuccess(res, { suppliers });
      } catch (err) {
        next(err);
      }
    },

    async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(statusSchema, req.body);
        const supplierId = String(req.params.id ?? '');
        const updated = await service.setSupplierStatus(
          supplierId,
          body.status,
          body.haltedDays,
          { id: req.user?.id ?? 'system', role: req.user?.role ?? 'SYSTEM' },
        );
        sendSuccess(res, { supplier: updated });
      } catch (err) {
        next(err);
      }
    },

    async triggerFallback(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(fallbackSchema, req.body ?? {});
        const result = await service.triggerRfqFallback({
          ...body,
          actorId: req.user?.id ?? 'system',
          actorRole: req.user?.role ?? 'SYSTEM',
        });
        sendSuccess(res, result, 201);
      } catch (err) {
        next(err);
      }
    },
  };
}
