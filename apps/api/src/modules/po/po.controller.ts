import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createPoService } from './po.service.js';

const createPoSchema = z.object({
  supplierIdOrCode: z.string().min(1),
  materialIdOrSku: z.string().min(1),
  factoryIdOrCode: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().max(300).optional(),
});

const statusSchema = z.object({
  status: z.enum(['APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']),
});

export function createPoController(service: ReturnType<typeof createPoService>) {
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

    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(createPoSchema, req.body);
        const order = await service.createOrder({
          ...body,
          actorId: req.user?.id ?? 'system',
          actorRole: req.user?.role ?? 'SYSTEM',
        });
        sendSuccess(res, { order }, 201);
      } catch (err) {
        next(err);
      }
    },

    async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(statusSchema, req.body);
        const poId = String(req.params.id ?? '');
        const order = await service.advanceStatus(poId, body.status, {
          id: req.user?.id ?? 'system',
          role: req.user?.role ?? 'SYSTEM',
        });
        sendSuccess(res, { order });
      } catch (err) {
        next(err);
      }
    },
  };
}
