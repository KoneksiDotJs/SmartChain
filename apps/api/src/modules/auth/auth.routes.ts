import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../middleware/auth.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = createAuthService(prisma);
  const controller = createAuthController(service);

  router.post('/login', (req, res, next) => controller.login(req, res, next));
  router.get('/personas', (req, res) => controller.personas(req, res));
  router.get('/me', requireAuth, (req, res) => controller.me(req, res));

  return router;
}
