export interface ShipmentCandidate {
  id: string;
  shipmentNumber: string;
  orderNumber: string;
  distributorName: string;
  routeGroup: string;
  carrierName: string;
  baseCost: number;
  consolidatedCost: number;
  isConsolidated: boolean;
  consolidationBatchId: string | null;
  trackingStatus: string;
}

export interface ConsolidatedBatchSummary {
  batchId: string;
  routeGroup: string;
  shipmentIds: string[];
  shipmentNumbers: string[];
  originalCostTotal: number;
  consolidatedCostTotal: number;
  savingsAmount: number;
  savingsPercent: number;
}

export interface ConsolidationPlanResult {
  batches: ConsolidatedBatchSummary[];
  updatedShipments: Array<{
    id: string;
    consolidatedCost: number;
    consolidationBatchId: string;
  }>;
  totalOriginalCost: number;
  totalConsolidatedCost: number;
  totalSavingsAmount: number;
  totalSavingsPercent: number;
}

export const CONSOLIDATION_DISCOUNT_RATE = 0.28; // 28% cost reduction via FTL multi-drop consolidation

/**
 * Pure TMS route consolidation algorithm (FR-06):
 * Groups shipments along the same corridor (routeGroup) and applies multi-drop
 * consolidation discounts to offset +40% transport tariff hikes.
 */
export function buildRouteConsolidationPlan(
  shipments: ShipmentCandidate[],
  options?: { transportSurgePercent?: number },
): ConsolidationPlanResult {
  const surgeFactor = 1 + (options?.transportSurgePercent ?? 0) / 100;
  const byRoute = new Map<string, ShipmentCandidate[]>();

  for (const shipment of shipments) {
    const group = byRoute.get(shipment.routeGroup) ?? [];
    group.push(shipment);
    byRoute.set(shipment.routeGroup, group);
  }

  const batches: ConsolidatedBatchSummary[] = [];
  const updatedShipments: Array<{
    id: string;
    consolidatedCost: number;
    consolidationBatchId: string;
  }> = [];

  let totalOriginalCost = 0;
  let totalConsolidatedCost = 0;

  let batchSeq = 1;
  const runTag = Date.now().toString(36).slice(-4).toUpperCase();
  for (const [routeGroup, items] of byRoute.entries()) {
    const batchId = `TMS-BATCH-${routeGroup.slice(0, 6).toUpperCase()}-${runTag}-${String(batchSeq).padStart(2, '0')}`;
    batchSeq += 1;

    const canConsolidate = items.length >= 2;
    let groupOriginal = 0;
    let groupConsolidated = 0;

    for (const item of items) {
      const effectiveBase = Math.round(item.baseCost * surgeFactor);
      const effectiveConsolidated = canConsolidate
        ? Math.round(effectiveBase * (1 - CONSOLIDATION_DISCOUNT_RATE))
        : effectiveBase;

      groupOriginal += effectiveBase;
      groupConsolidated += effectiveConsolidated;

      if (canConsolidate) {
        updatedShipments.push({
          id: item.id,
          consolidatedCost: effectiveConsolidated,
          consolidationBatchId: batchId,
        });
      }
    }

    totalOriginalCost += groupOriginal;
    totalConsolidatedCost += groupConsolidated;

    if (canConsolidate) {
      const savingsAmount = groupOriginal - groupConsolidated;
      batches.push({
        batchId,
        routeGroup,
        shipmentIds: items.map((i) => i.id),
        shipmentNumbers: items.map((i) => i.shipmentNumber),
        originalCostTotal: groupOriginal,
        consolidatedCostTotal: groupConsolidated,
        savingsAmount,
        savingsPercent:
          groupOriginal > 0 ? Number(((savingsAmount / groupOriginal) * 100).toFixed(1)) : 0,
      });
    }
  }

  const totalSavingsAmount = Math.max(0, totalOriginalCost - totalConsolidatedCost);
  const totalSavingsPercent =
    totalOriginalCost > 0
      ? Number(((totalSavingsAmount / totalOriginalCost) * 100).toFixed(1))
      : 0;

  return {
    batches,
    updatedShipments,
    totalOriginalCost,
    totalConsolidatedCost,
    totalSavingsAmount,
    totalSavingsPercent,
  };
}
