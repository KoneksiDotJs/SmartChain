import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { requireAuth, requireRoles } from '../../middleware/auth.js';
import { createPrismaUsersRepository } from './users.repository.js';
import { createUsersService } from './users.service.js';
import { createUsersController } from './users.controller.js';

export function createUsersRouter(prisma: PrismaClient): Router {
  const router = Router();
  const repo = createPrismaUsersRepository(prisma);
  const audit = createPrismaAuditWriter(prisma);
  const service = createUsersService(repo, audit);
  const controller = createUsersController(service);

  // Strict Least Privilege: ONLY SYSTEM_ADMIN manages user accounts & RBAC assignments
  router.use(requireAuth, requireRoles('SYSTEM_ADMIN'));

  router.get('/', (req, res, next) => controller.listUsers(req, res, next));
  router.post('/', (req, res, next) => controller.createUser(req, res, next));
  router.patch('/:id/access', (req, res, next) => controller.updateAccess(req, res, next));
  router.post('/:id/reset-password', (req, res, next) => controller.resetPassword(req, res, next));

  return router;
}
