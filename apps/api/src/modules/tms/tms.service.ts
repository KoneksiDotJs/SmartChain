import type { AuditWriter } from '../../lib/audit.js';
import {
  buildRouteConsolidationPlan,
  type ConsolidationPlanResult,
  type ShipmentCandidate,
} from './tms.domain.js';
import type { TmsRepository } from './tms.repository.js';

export function createTmsService(repo: TmsRepository, audit: AuditWriter) {
  return {
    async listShipments(routeGroupFilter?: string): Promise<ShipmentCandidate[]> {
      return repo.listShipments(routeGroupFilter);
    },

    async consolidateRoutes(
      options: { routeGroup?: string; transportSurgePercent?: number },
      actor: { id: string; role: string },
    ): Promise<ConsolidationPlanResult> {
      const shipments = await repo.listShipments(options.routeGroup);
      const plan = buildRouteConsolidationPlan(shipments, {
        transportSurgePercent: options.transportSurgePercent,
      });

      await repo.applyConsolidationUpdates(plan.updatedShipments);

      await audit.append({
        entityType: 'ShipmentBatch',
        entityId: options.routeGroup ?? 'ALL_ROUTES',
        action: 'TMS_ROUTES_CONSOLIDATED',
        actorId: actor.id,
        actorRole: actor.role,
        newState: {
          consolidatedShipments: plan.updatedShipments.length,
          batchesCount: plan.batches.length,
          totalOriginalCost: plan.totalOriginalCost,
          totalConsolidatedCost: plan.totalConsolidatedCost,
          totalSavingsPercent: plan.totalSavingsPercent,
        },
        reason: `Konsolidasi muatan TMS menekan biaya kirim sebesar ${plan.totalSavingsPercent}%`,
      });

      return plan;
    },
  };
}
