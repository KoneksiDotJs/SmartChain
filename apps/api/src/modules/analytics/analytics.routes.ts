import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaAnalyticsRepository } from './analytics.repository.js';
import { createAnalyticsService } from './analytics.service.js';
import { createAnalyticsController } from './analytics.controller.js';

export function createAnalyticsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaAnalyticsRepository(prisma);
  const service = createAnalyticsService(repo);
  const controller = createAnalyticsController(service);

  router.get(
    '/forecast',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER'),
    (req, res, next) => controller.getForecast(req, res, next),
  );

  router.get(
    '/performance',
    requireAuth,
    requireRoles('DIREKSI', 'PROCUREMENT_MANAGER', 'LOGISTICS_MANAGER'),
    (req, res, next) => controller.getPerformance(req, res, next),
  );

  return router;
}
