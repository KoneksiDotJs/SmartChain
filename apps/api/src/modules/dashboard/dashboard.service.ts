import type { PrismaClient } from '@prisma/client';
import { createPrismaAuditWriter } from '../../lib/audit.js';
import { createPrismaAnalyticsRepository } from '../analytics/analytics.repository.js';
import { createAnalyticsService } from '../analytics/analytics.service.js';

export function createDashboardService(prisma: PrismaClient) {
  const auditWriter = createPrismaAuditWriter(prisma);
  const analyticsService = createAnalyticsService(createPrismaAnalyticsRepository(prisma));

  return {
    async getOverview() {
      const [
        factories,
        mainSuppliersTotal,
        mainSuppliersActive,
        backupSuppliersTotal,
        warehouses,
        stocks,
        distributorsCount,
        heldAnomaliesCount,
        forecastOverview,
        recentAuditLogs,
      ] = await Promise.all([
        prisma.factory.findMany({ orderBy: { code: 'asc' } }),
        prisma.supplier.count({ where: { tierType: 'MAIN' } }),
        prisma.supplier.count({ where: { tierType: 'MAIN', status: 'ACTIVE' } }),
        prisma.supplier.count({ where: { tierType: 'BACKUP' } }),
        prisma.warehouse.findMany({ orderBy: { code: 'asc' } }),
        prisma.inventoryStock.findMany(),
        prisma.distributor.count(),
        prisma.salesOrder.count({ where: { anomalyFlag: true } }),
        analyticsService.getForecastOverview(),
        auditWriter.listRecent(30),
      ]);

      const totalRfid = stocks.reduce((sum, s) => sum + s.rfidQty, 0);
      const totalPhysical = stocks.reduce((sum, s) => sum + s.physicalQty, 0);
      const totalQuarantine = stocks.reduce((sum, s) => sum + s.quarantineQty, 0);
      const rfidAccuracyPercent =
        totalRfid <= 0
          ? 100
          : Number(((Math.min(totalPhysical, totalRfid) / totalRfid) * 100).toFixed(1));

      const onlineWarehouses = warehouses.filter((w) => w.networkStatus === 'ONLINE').length;

      return {
        kpis: {
          factoriesCount: factories.length,
          mainSuppliersActive,
          mainSuppliersTotal,
          backupSuppliersTotal,
          warehousesOnline: onlineWarehouses,
          warehousesTotal: warehouses.length,
          distributorsCount,
          rfidAccuracyPercent,
          totalDiscrepancyUnits: Math.abs(totalRfid - totalPhysical),
          totalQuarantineUnits: totalQuarantine,
          heldAnomaliesCount,
          dataQuality: forecastOverview.overallDataQuality,
          dataCompletenessPercent: forecastOverview.averageCompletenessPercent,
        },
        factories,
        warehouses,
        recentAuditLogs,
      };
    },

    async getAuditLogs(limit = 50) {
      return auditWriter.listRecent(limit);
    },
  };
}
