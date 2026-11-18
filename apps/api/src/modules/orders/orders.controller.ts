import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createOrdersService } from './orders.service.js';

const validateSchema = z.object({
  orderIdOrNumber: z.string().trim().min(1).max(64).optional(),
  distributorIdOrCode: z.string().trim().min(1).max(64).optional(),
  materialIdOrSku: z.string().trim().min(1).max(64).optional(),
  requestedQty: z.number().int().positive().max(25_000).optional(),
  depositConfirmed: z.boolean().optional(),
});

const surgeSchema = z.object({
  materialId: z.string().trim().min(1).max(64),
  availableStockOverride: z.number().int().min(0).max(1_000_000).optional(),
});

function requireActor(req: Request): { id: string; role: string; entityCode?: string } {
  if (!req.user) {
    throw new AppError('Pengguna belum terautentikasi', 401, 'UNAUTHORIZED');
  }
  return { id: req.user.id, role: req.user.role, entityCode: req.user.entityCode };
}

export function createOrdersController(service: ReturnType<typeof createOrdersService>) {
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
          if (!code.startsWith('DIST-')) {
            throw new AppError('Hanya mitra distributor (DIST-*) yang dapat mengakses Sales Order', 403, 'FORBIDDEN');
          }
          partnerScope = code;
        }
        const orders = await service.listOrders(partnerScope);
        sendSuccess(res, { orders });
      } catch (err) {
        next(err);
      }
    },

    async validateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(validateSchema, req.body);

        let scopedDistributor = body.distributorIdOrCode;
        let sanitizedDepositConfirmed = body.depositConfirmed;

        if (actor.role === 'PARTNER') {
          const code = actor.entityCode?.trim().toUpperCase();
          if (!code || !code.startsWith('DIST-')) {
            throw new AppError('Hanya mitra distributor (DIST-*) dengan entityCode valid yang dapat memvalidasi order', 403, 'FORBIDDEN');
          }
          scopedDistributor = code;
          // External partners cannot self-assert deposit confirmation to bypass Anomaly Guard
          sanitizedDepositConfirmed = undefined;
        }

        const result = await service.validateAndAllocateOrder({
          ...body,
          distributorIdOrCode: scopedDistributor,
          depositConfirmed: sanitizedDepositConfirmed,
          actorId: actor.id,
          actorRole: actor.role,
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
        const actor = requireActor(req);
        const body = parseWithSchema(surgeSchema, req.body);
        const result = await service.allocateSurgeQueue(
          body.materialId,
          body.availableStockOverride,
          { id: actor.id, role: actor.role },
        );
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
