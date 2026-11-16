import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createWmsService } from './wms.service.js';

const syncBatchSchema = z.object({
  items: z
    .array(
      z.object({
        idempotencyKey: z.string().min(4).max(128),
        stockId: z.string().min(1),
        deltaQty: z.number().int().positive(),
        direction: z.enum(['IN', 'OUT', 'CYCLE_COUNT']),
        offlineTimestamp: z.string().datetime(),
        wasOffline: z.boolean().optional(),
      }),
    )
    .min(1),
});

const reconcileSchema = z.object({
  stockId: z.string().min(1),
  overridePhysicalQty: z.number().int().min(0).optional(),
  notes: z.string().max(300).optional(),
});

const networkSchema = z.object({
  networkStatus: z.enum(['ONLINE', 'OFFLINE']),
  offlineHours: z.number().int().min(0).max(240).default(0),
});

export function createWmsController(service: ReturnType<typeof createWmsService>) {
  return {
    async listOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const data = await service.listOverview();
        sendSuccess(res, data);
      } catch (err) {
        next(err);
      }
    },

    async setNetworkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(networkSchema, req.body);
        const warehouseId = String(req.params.id ?? '');
        const updated = await service.setWarehouseNetwork(
          warehouseId,
          body.networkStatus,
          body.offlineHours,
          { id: req.user?.id ?? 'system', role: req.user?.role ?? 'SYSTEM' },
        );
        sendSuccess(res, { warehouse: updated });
      } catch (err) {
        next(err);
      }
    },

    async syncBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(syncBatchSchema, req.body);
        const result = await service.syncBatch(body.items, {
          id: req.user?.id ?? 'system',
          role: req.user?.role ?? 'SYSTEM',
        });
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    async reconcile(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const body = parseWithSchema(reconcileSchema, req.body);
        const result = await service.reconcileCycleCount(body, {
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
