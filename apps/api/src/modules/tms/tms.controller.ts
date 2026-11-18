import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { createTmsService } from './tms.service.js';

const consolidateSchema = z.object({
  routeGroup: z.string().trim().min(1).max(32).optional(),
  transportSurgePercent: z.number().min(0).max(200).optional(),
});

const shipmentsQuerySchema = z.object({
  routeGroup: z.string().trim().min(1).max(32).optional(),
});

function requireActor(req: Request): { id: string; role: string; entityCode?: string } {
  if (!req.user) {
    throw new AppError('Pengguna belum terautentikasi', 401, 'UNAUTHORIZED');
  }
  return { id: req.user.id, role: req.user.role, entityCode: req.user.entityCode };
}

export function createTmsController(service: ReturnType<typeof createTmsService>) {
  return {
    async listShipments(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const query = parseWithSchema(shipmentsQuerySchema, {
          routeGroup: typeof req.query.routeGroup === 'string' && req.query.routeGroup.trim()
            ? req.query.routeGroup
            : undefined,
        });

        let partnerDistScope: string | undefined;
        if (actor.role === 'PARTNER') {
          const code = actor.entityCode?.trim().toUpperCase();
          if (!code) {
            throw new AppError('Akun PARTNER wajib memiliki kode entitas aktif', 403, 'PARTNER_ENTITY_REQUIRED');
          }
          if (!code.startsWith('DIST-')) {
            throw new AppError('Hanya mitra distributor (DIST-*) yang dapat memantau pengiriman', 403, 'FORBIDDEN');
          }
          partnerDistScope = code;
        }

        const shipments = await service.listShipments(query.routeGroup, partnerDistScope);
        sendSuccess(res, { shipments });
      } catch (err) {
        next(err);
      }
    },

    async consolidate(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(consolidateSchema, req.body ?? {});
        const result = await service.consolidateRoutes(body, {
          id: actor.id,
          role: actor.role,
        });
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
