import type { PrismaClient } from '@prisma/client';
import type { DemandPoint } from './analytics.domain.js';

export interface MaterialAnalyticsRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  dailyDemandAvg: number;
  demandStdDev: number;
  leadTimeDays: number;
  currentStock: number;
  quarantineStock: number;
  demandHistory: DemandPoint[];
}

export interface AnalyticsRepository {
  getMaterialsWithHistory(): Promise<MaterialAnalyticsRow[]>;
}

export function createPrismaAnalyticsRepository(prisma: PrismaClient): AnalyticsRepository {
  return {
    async getMaterialsWithHistory(): Promise<MaterialAnalyticsRow[]> {
      const materials = await prisma.materialProduct.findMany({
        include: {
          stocks: true,
          demandHistory: {
            orderBy: { periodIndex: 'asc' },
          },
        },
        orderBy: { sku: 'asc' },
      });

      return materials.map((mat) => {
        const currentStock = mat.stocks.reduce((sum, s) => sum + s.physicalQty, 0);
        const quarantineStock = mat.stocks.reduce((sum, s) => sum + s.quarantineQty, 0);

        return {
          id: mat.id,
          sku: mat.sku,
          name: mat.name,
          unit: mat.unit,
          dailyDemandAvg: mat.dailyDemandAvg,
          demandStdDev: mat.demandStdDev,
          leadTimeDays: mat.leadTimeDays,
          currentStock,
          quarantineStock,
          demandHistory: mat.demandHistory.map((h) => ({
            periodLabel: h.periodLabel,
            periodIndex: h.periodIndex,
            observedQty: h.observedQty,
            isMissing: h.isMissing,
          })),
        };
      });
    },
  };
}
