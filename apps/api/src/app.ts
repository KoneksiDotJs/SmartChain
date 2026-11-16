import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { PrismaClient } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { sendSuccess } from './lib/response.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createOrdersRouter } from './modules/orders/orders.routes.js';
import { createPoRouter } from './modules/po/po.routes.js';
import { createSrmRouter } from './modules/srm/srm.routes.js';
import { createTmsRouter } from './modules/tms/tms.routes.js';
import { createWmsRouter } from './modules/wms/wms.routes.js';

export function createApp(prisma: PrismaClient): Express {
  const app = express();
  const env = loadEnv();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    sendSuccess(res, {
      service: 'smartchain-api',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', createAuthRouter(prisma));
  app.use('/api/dashboard', createDashboardRouter(prisma));
  app.use('/api/srm', createSrmRouter(prisma));
  app.use('/api/po', createPoRouter(prisma));
  app.use('/api/wms', createWmsRouter(prisma));
  app.use('/api/orders', createOrdersRouter(prisma));
  app.use('/api/tms', createTmsRouter(prisma));
  app.use('/api/analytics', createAnalyticsRouter(prisma));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
