import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createOrdersService } from './orders.service.js';

const validateSchema = z.object({
  orderIdOrNumber: z.string().min(1).optional(),
  distributorIdOrCode: z.string().min(1).optional(),
  materialIdOrSku: z.string().min(1).optional(),
  requestedQty: z.number().int().positive().optional(),
  depositConfirmed: z.boolean().optional(),
});

const surgeSchema = z.object({
  materialId: z.string().min(1),
  availableStockOverride: z.number().int().min(0).optional(),
});

export function createOrdersController(service: ReturnType<typeof createOrdersService>) {
  return {
    async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const partnerScope =
          req.user?.role === 'PARTNER' ? req.user.entityCode : undefined;
        const orders = await service.listOrders(partnerScope);
        sendSuccess(res, { orders });
      } catch (err) {
        next(err);
      }
    },

    async validateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(validateSchema, req.body);
        const result = await service.validateAndAllocateOrder({
          ...body,
          actorId: req.user?.id ?? 'system',
          actorRole: req.user?.role ?? 'SYSTEM',
        });
        sendSuccess(res, {
          ...result,
          guardContext: req.anomalyContext ?? null,
        });
      } catch (err) {
        next(err);
      }
    },

    async allocateSurge(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(surgeSchema, req.body);
        const result = await service.allocateSurgeQueue(
          body.materialId,
          body.availableStockOverride,
          { id: req.user?.id ?? 'system', role: req.user?.role ?? 'SYSTEM' },
        );
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
