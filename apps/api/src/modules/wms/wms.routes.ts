import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaWmsRepository } from './wms.repository.js';
import { createWmsService } from './wms.service.js';
import { createWmsController } from './wms.controller.js';

export function createWmsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaWmsRepository(prisma);
  const audit = createPrismaAuditWriter(prisma);
  const service = createWmsService(repo, audit);
  const controller = createWmsController(service);

  router.get(
    '/overview',
    requireAuth,
    requireRoles('DIREKSI', 'WAREHOUSE_OPERATOR', 'PROCUREMENT_MANAGER', 'LOGISTICS_MANAGER'),
    (req, res, next) => controller.listOverview(req, res, next),
  );

  router.patch(
    '/warehouses/:id/network',
    requireAuth,
    requireRoles('WAREHOUSE_OPERATOR'),
    (req, res, next) => controller.setNetworkStatus(req, res, next),
  );

  router.post(
    '/sync-batch',
    requireAuth,
    requireRoles('WAREHOUSE_OPERATOR'),
    (req, res, next) => controller.syncBatch(req, res, next),
  );

  router.post(
    '/reconcile',
    requireAuth,
    requireRoles('WAREHOUSE_OPERATOR'),
    (req, res, next) => controller.reconcile(req, res, next),
  );

  return router;
}
