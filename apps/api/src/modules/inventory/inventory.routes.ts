import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaInventoryRepository } from './inventory.repository.js';
import { createInventoryService } from './inventory.service.js';
import { createInventoryController } from './inventory.controller.js';

export function createInventoryRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaInventoryRepository(prisma);
  const service = createInventoryService(repo);
  const controller = createInventoryController(service);

  router.get(
    '/ledger',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER'),
    (req, res, next) => controller.getLedger(req, res, next),
  );

  router.get(
    '/traceability',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER'),
    (req, res, next) => controller.getTraceability(req, res, next),
  );

  return router;
}
