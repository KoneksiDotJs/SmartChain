import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createInventoryService } from './inventory.service.js';

const filterQuerySchema = z.object({
  materialSku: z.string().trim().min(1).max(32).optional(),
  warehouseCode: z.string().trim().min(1).max(32).optional(),
});

export function createInventoryController(service: ReturnType<typeof createInventoryService>) {
  return {
    async getLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const filters = parseWithSchema(filterQuerySchema, {
          materialSku: typeof req.query.materialSku === 'string' && req.query.materialSku.trim()
            ? req.query.materialSku
            : undefined,
          warehouseCode: typeof req.query.warehouseCode === 'string' && req.query.warehouseCode.trim()
            ? req.query.warehouseCode
            : undefined,
        });
        const ledger = await service.getLedger(filters);
        sendSuccess(res, ledger);
      } catch (err) {
        next(err);
      }
    },

    async getTraceability(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const filters = parseWithSchema(filterQuerySchema, {
          materialSku: typeof req.query.materialSku === 'string' && req.query.materialSku.trim()
            ? req.query.materialSku
            : undefined,
          warehouseCode: typeof req.query.warehouseCode === 'string' && req.query.warehouseCode.trim()
            ? req.query.warehouseCode
            : undefined,
        });
        const graph = await service.getTraceability(filters);
        sendSuccess(res, graph);
      } catch (err) {
        next(err);
      }
    },
  };
}
