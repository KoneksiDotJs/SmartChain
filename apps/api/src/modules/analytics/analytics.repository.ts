import type { PrismaClient } from '@prisma/client';
import type {
  DemandPoint,
  DistributionEvaluationInput,
  SupplierEvaluationInput,
} from './analytics.domain.js';

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
  getPerformanceInputs(): Promise<{
    suppliers: SupplierEvaluationInput[];
    corridors: DistributionEvaluationInput[];
  }>;
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

    async getPerformanceInputs() {
      const [suppliers, distributors, orders, shipments] = await Promise.all([
        prisma.supplier.findMany({
          include: { _count: { select: { purchaseOrders: true } } },
          orderBy: { code: 'asc' },
        }),
        prisma.distributor.findMany(),
        prisma.salesOrder.findMany({ include: { distributor: true } }),
        prisma.shipment.findMany(),
      ]);

      const supplierInputs: SupplierEvaluationInput[] = suppliers.map((s) => ({
        code: s.code,
        name: s.name,
        tierType: s.tierType,
        slaScore: s.slaScore,
        leadTimeDays: s.leadTimeDays,
        status: s.status,
        haltedDays: s.haltedDays,
        materialCategory: s.materialCategory,
        poCount: s._count.purchaseOrders,
      }));

      const routeGroups = ['JAWA_BARAT', 'JAWA_TENGAH', 'JAWA_TIMUR', 'LUAR_JAWA'];
      const corridors: DistributionEvaluationInput[] = routeGroups.map((rg) => {
        const distInRoute = distributors.filter((d) => d.routeGroup === rg);
        const ordInRoute = orders.filter((o) => o.distributor.routeGroup === rg);
        const shpInRoute = shipments.filter((sh) => sh.routeGroup === rg);

        return {
          routeGroup: rg,
          distributorsCount: distInRoute.length,
          totalOrders: ordInRoute.length,
          heldAnomalies: ordInRoute.filter((o) => o.anomalyFlag).length,
          requestedUnits: ordInRoute.reduce((sum, o) => sum + o.requestedQty, 0),
          allocatedUnits: ordInRoute.reduce((sum, o) => sum + o.allocatedQty, 0),
          baseShippingCost: shpInRoute.reduce((sum, sh) => sum + sh.baseCost, 0),
          effectiveShippingCost: shpInRoute.reduce(
            (sum, sh) => sum + (sh.isConsolidated ? sh.consolidatedCost : sh.baseCost),
            0,
          ),
          consolidatedCount: shpInRoute.filter((sh) => sh.isConsolidated).length,
        };
      });

      return { suppliers: supplierInputs, corridors };
    },
  };
}
