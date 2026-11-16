import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaPoRepository } from './po.repository.js';
import { createPoService } from './po.service.js';
import { createPoController } from './po.controller.js';

export function createPoRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaPoRepository(prisma);
  const audit = createPrismaAuditWriter(prisma);
  const service = createPoService(repo, audit);
  const controller = createPoController(service);

  router.get(
    '/',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'PARTNER'),
    (req, res, next) => controller.listOrders(req, res, next),
  );

  router.post(
    '/',
    requireAuth,
    requireRoles('PROCUREMENT_MANAGER', 'DIREKSI'),
    (req, res, next) => controller.createOrder(req, res, next),
  );

  router.patch(
    '/:id/status',
    requireAuth,
    requireRoles('PROCUREMENT_MANAGER', 'DIREKSI', 'PARTNER'),
    (req, res, next) => controller.updateStatus(req, res, next),
  );

  return router;
}
