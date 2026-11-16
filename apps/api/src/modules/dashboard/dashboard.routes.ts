import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createDashboardService } from './dashboard.service.js';
import { createDashboardController } from './dashboard.controller.js';

export function createDashboardRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = createDashboardService(prisma);
  const controller = createDashboardController(service);

  router.get(
    '/overview',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER'),
    (req, res, next) => controller.getOverview(req, res, next),
  );

  router.get(
    '/audit-logs',
    requireAuth,
    requireRoles(
      'DIREKSI',
      'PROCUREMENT_MANAGER',
      'WAREHOUSE_OPERATOR',
      'LOGISTICS_MANAGER',
      'SYSTEM_ADMIN',
    ),
    (req, res, next) => controller.getAuditLogs(req, res, next),
  );

  return router;
}
