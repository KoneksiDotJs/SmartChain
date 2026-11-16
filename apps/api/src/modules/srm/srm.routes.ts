import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaSrmRepository } from './srm.repository.js';
import { createSrmService } from './srm.service.js';
import { createSrmController } from './srm.controller.js';

export function createSrmRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaSrmRepository(prisma);
  const audit = createPrismaAuditWriter(prisma);
  const service = createSrmService(repo, audit);
  const controller = createSrmController(service);

  router.get(
    '/suppliers',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER', 'PARTNER'),
    (req, res, next) => controller.listSuppliers(req, res, next),
  );

  router.patch(
    '/suppliers/:id/status',
    requireAuth,
    requireRoles('PROCUREMENT_MANAGER', 'DIREKSI'),
    (req, res, next) => controller.updateStatus(req, res, next),
  );

  router.post(
    '/rfq-fallback',
    requireAuth,
    requireRoles('PROCUREMENT_MANAGER', 'DIREKSI'),
    (req, res, next) => controller.triggerFallback(req, res, next),
  );

  return router;
}
