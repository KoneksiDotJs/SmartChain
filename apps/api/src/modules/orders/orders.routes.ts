import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { anomalyGuardMiddleware } from '../../middleware/anomalyGuard.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaOrdersRepository } from './orders.repository.js';
import { createOrdersService } from './orders.service.js';
import { createOrdersController } from './orders.controller.js';

export function createOrdersRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaOrdersRepository(prisma);
  const audit = createPrismaAuditWriter(prisma);
  const service = createOrdersService(repo, audit);
  const controller = createOrdersController(service);

  router.get(
    '/',
    requireAuth,
    requireRoles('DIREKSI', 'LOGISTICS_MANAGER', 'PROCUREMENT_MANAGER', 'PARTNER'),
    (req, res, next) => controller.listOrders(req, res, next),
  );

  router.post(
    '/validate',
    requireAuth,
    requireRoles('LOGISTICS_MANAGER', 'DIREKSI', 'PARTNER'),
    anomalyGuardMiddleware,
    (req, res, next) => controller.validateOrder(req, res, next),
  );

  router.post(
    '/allocate-surge',
    requireAuth,
    requireRoles('LOGISTICS_MANAGER', 'DIREKSI'),
    anomalyGuardMiddleware,
    (req, res, next) => controller.allocateSurge(req, res, next),
  );

  return router;
}
