import type { PrismaClient } from '@prisma/client';
import type { ShipmentCandidate } from './tms.domain.js';

export interface TmsRepository {
  listShipments(routeGroupFilter?: string, distributorCodeFilter?: string): Promise<ShipmentCandidate[]>;
  applyConsolidationUpdates(
    updates: Array<{ id: string; consolidatedCost: number; consolidationBatchId: string }>,
  ): Promise<void>;
}

export function createPrismaTmsRepository(prisma: PrismaClient): TmsRepository {
  return {
    async listShipments(
      routeGroupFilter?: string,
      distributorCodeFilter?: string,
    ): Promise<ShipmentCandidate[]> {
      if (distributorCodeFilter !== undefined && !distributorCodeFilter.trim()) {
        return [];
      }
      const rows = await prisma.shipment.findMany({
        where: {
          ...(routeGroupFilter ? { routeGroup: routeGroupFilter } : {}),
          ...(distributorCodeFilter
            ? { order: { distributor: { code: distributorCodeFilter } } }
            : {}),
        },
        include: {
          order: {
            include: {
              distributor: { select: { name: true } },
            },
          },
        },
        orderBy: [{ routeGroup: 'asc' }, { shipmentNumber: 'asc' }],
      });

      return rows.map((r) => ({
        id: r.id,
        shipmentNumber: r.shipmentNumber,
        orderNumber: r.order.orderNumber,
        distributorName: r.order.distributor.name,
        routeGroup: r.routeGroup,
        carrierName: r.carrierName,
        baseCost: r.baseCost,
        consolidatedCost: r.consolidatedCost,
        isConsolidated: r.isConsolidated,
        consolidationBatchId: r.consolidationBatchId,
        trackingStatus: r.trackingStatus,
      }));
    },

    async applyConsolidationUpdates(updates): Promise<void> {
      if (updates.length === 0) return;
      await prisma.$transaction(
        updates.map((u) =>
          prisma.shipment.update({
            where: { id: u.id },
            data: {
              consolidatedCost: u.consolidatedCost,
              isConsolidated: true,
              consolidationBatchId: u.consolidationBatchId,
              trackingStatus: 'CONSOLIDATED',
            },
          }),
        ),
      );
    },
  };
}
