import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createPoService } from './po.service.js';

const createPoSchema = z.object({
  supplierIdOrCode: z.string().trim().min(1).max(64),
  materialIdOrSku: z.string().trim().min(1).max(64),
  factoryIdOrCode: z.string().trim().min(1).max(64),
  quantity: z.number().int().positive().max(100_000),
  notes: z.string().max(300).optional(),
});

const statusSchema = z.object({
  status: z.enum(['APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']),
});

function requireActor(req: Request): { id: string; role: string; entityCode?: string } {
  if (!req.user) {
    throw new AppError('Pengguna belum terautentikasi', 401, 'UNAUTHORIZED');
  }
  return { id: req.user.id, role: req.user.role, entityCode: req.user.entityCode };
}

export function createPoController(service: ReturnType<typeof createPoService>) {
  return {
    async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        let partnerScope: string | undefined;
        if (actor.role === 'PARTNER') {
          const code = actor.entityCode?.trim().toUpperCase();
          if (!code) {
            throw new AppError('Akun PARTNER wajib memiliki kode entitas aktif', 403, 'PARTNER_ENTITY_REQUIRED');
          }
          if (!code.startsWith('SUP-')) {
            throw new AppError('Hanya mitra pemasok (SUP-*) yang dapat mengakses Purchase Order', 403, 'FORBIDDEN');
          }
          partnerScope = code;
        }
        const orders = await service.listOrders(partnerScope);
        sendSuccess(res, { orders });
      } catch (err) {
        next(err);
      }
    },

    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(createPoSchema, req.body);
        const order = await service.createOrder({
          ...body,
          actorId: actor.id,
          actorRole: actor.role,
        });
        sendSuccess(res, { order }, 201);
      } catch (err) {
        next(err);
      }
    },

    async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(statusSchema, req.body);
        const poId = String(req.params.id ?? '').trim();
        const order = await service.advanceStatus(poId, body.status, actor);
        sendSuccess(res, { order });
      } catch (err) {
        next(err);
      }
    },
  };
}
