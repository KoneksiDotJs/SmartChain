import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createWmsService } from './wms.service.js';

const syncBatchSchema = z.object({
  items: z
    .array(
      z.object({
        idempotencyKey: z.string().min(4).max(128),
        stockId: z.string().min(1).max(64),
        deltaQty: z.number().int().positive().max(100_000),
        direction: z.enum(['IN', 'OUT', 'CYCLE_COUNT']),
        offlineTimestamp: z.string().datetime(),
        wasOffline: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(200),
});

const reconcileSchema = z.object({
  stockId: z.string().min(1).max(64),
  overridePhysicalQty: z.number().int().min(0).max(1_000_000).optional(),
  notes: z.string().max(300).optional(),
});

const networkSchema = z.object({
  networkStatus: z.enum(['ONLINE', 'OFFLINE']),
  offlineHours: z.number().int().min(0).max(240).default(0),
});

const scanTagSchema = z.object({
  rawCode: z.string().min(4).max(128),
  warehouseCode: z.string().min(2).max(16).optional(),
  direction: z.enum(['IN', 'OUT', 'CYCLE_COUNT']).default('IN'),
  quantityOverride: z.number().int().positive().max(100_000).optional(),
  idempotencyKey: z.string().min(4).max(128),
});

const issueLabelSchema = z.object({
  labelType: z.enum(['BARCODE_CODE128', 'RFID_SMARTTAG', 'RFID_EPC']).default('BARCODE_CODE128'),
  materialSku: z.string().min(2).max(24),
  warehouseCode: z.string().min(2).max(16),
  quantity: z.number().int().min(1).max(9999),
  batchCode: z.string().min(1).max(24).optional(),
});

function requireActor(req: Request): { id: string; role: string } {
  if (!req.user) {
    throw new AppError('Pengguna belum terautentikasi', 401, 'UNAUTHORIZED');
  }
  return { id: req.user.id, role: req.user.role };
}

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
        const actor = requireActor(req);
        const body = parseWithSchema(networkSchema, req.body);
        const warehouseId = String(req.params.id ?? '');
        const updated = await service.setWarehouseNetwork(
          warehouseId,
          body.networkStatus,
          body.offlineHours,
          actor,
        );
        sendSuccess(res, { warehouse: updated });
      } catch (err) {
        next(err);
      }
    },

    async syncBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(syncBatchSchema, req.body);
        const result = await service.syncBatch(body.items, actor);
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    async scanTag(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(scanTagSchema, req.body);
        const result = await service.scanTag(body, actor);
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },

    async issueLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(issueLabelSchema, req.body);
        const label = await service.issueBarcodeLabel(body, actor);
        sendSuccess(res, { label }, 201);
      } catch (err) {
        next(err);
      }
    },

    async reconcile(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(reconcileSchema, req.body);
        const result = await service.reconcileCycleCount(body, actor);
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
