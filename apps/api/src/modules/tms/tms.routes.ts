import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaTmsRepository } from './tms.repository.js';
import { createTmsService } from './tms.service.js';
import { createTmsController } from './tms.controller.js';

export function createTmsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaTmsRepository(prisma);
  const audit = createPrismaAuditWriter(prisma);
  const service = createTmsService(repo, audit);
  const controller = createTmsController(service);

  router.get(
    '/shipments',
    requireAuth,
    requireRoles('DIREKSI', 'LOGISTICS_MANAGER', 'WAREHOUSE_OPERATOR', 'PARTNER'),
    (req, res, next) => controller.listShipments(req, res, next),
  );

  router.post(
    '/consolidate',
    requireAuth,
    requireRoles('LOGISTICS_MANAGER', 'DIREKSI'),
    (req, res, next) => controller.consolidate(req, res, next),
  );

  return router;
}
