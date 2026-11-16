import { evaluateOrderAnomaly, type AnomalyAssessment } from '../../middleware/anomalyGuard.js';

export type SlaTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type AllocationStatus =
  | 'PENDING'
  | 'APPROVED_SLA'
  | 'HELD_ANOMALY'
  | 'PARTIAL_ALLOCATED'
  | 'DISPATCHED';

export interface OrderForAllocation {
  id: string;
  orderNumber: string;
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  slaTier: SlaTier;
  slaScore: number;
  monthlyQuota: number;
  creditLimit: number;
  usedCredit: number;
  requestedQty: number;
  unitPrice: number;
  depositConfirmed: boolean;
  createdAt: Date;
}

export interface OrderAllocationDecision {
  orderId: string;
  orderNumber: string;
  distributorCode: string;
  slaTier: SlaTier;
  slaScore: number;
  slaPriorityRank: number;
  anomaly: AnomalyAssessment;
  allocatedQty: number;
  allocationStatus: AllocationStatus;
}

const TIER_WEIGHT: Record<SlaTier, number> = {
  TIER_1: 300,
  TIER_2: 200,
  TIER_3: 100,
};

export function computeSlaPriorityScore(slaTier: SlaTier, slaScore: number): number {
  return Math.round(TIER_WEIGHT[slaTier] + slaScore);
}

/**
 * Pure domain allocator for +300% demand surge & Anomaly Guard:
 * 1. Filters out fictitious / anomalous orders before any stock lock occurs.
 * 2. Ranks valid orders strictly by SLA Tier (Tier-1 > Tier-2 > Tier-3), then SLA score.
 * 3. Allocates remaining available physical stock without overcommitting.
 */
export function allocateOrdersWithAnomalyGuard(
  orders: OrderForAllocation[],
  availableStock: number,
): { decisions: OrderAllocationDecision[]; remainingStock: number } {
  let remainingStock = Math.max(0, availableStock);
  const decisions: OrderAllocationDecision[] = [];

  const assessed = orders.map((order) => ({
    order,
    priority: computeSlaPriorityScore(order.slaTier, order.slaScore),
    anomaly: evaluateOrderAnomaly({
      requestedQty: order.requestedQty,
      monthlyQuota: order.monthlyQuota,
      orderValue: order.requestedQty * order.unitPrice,
      creditLimit: order.creditLimit,
      usedCredit: order.usedCredit,
      depositConfirmed: order.depositConfirmed,
    }),
  }));

  const sorted = [...assessed].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.order.createdAt.getTime() - b.order.createdAt.getTime();
  });

  sorted.forEach((entry, index) => {
    if (entry.anomaly.isAnomaly) {
      decisions.push({
        orderId: entry.order.id,
        orderNumber: entry.order.orderNumber,
        distributorCode: entry.order.distributorCode,
        slaTier: entry.order.slaTier,
        slaScore: entry.order.slaScore,
        slaPriorityRank: index + 1,
        anomaly: entry.anomaly,
        allocatedQty: 0,
        allocationStatus: 'HELD_ANOMALY',
      });
      return;
    }

    const allocatedQty = Math.min(entry.order.requestedQty, remainingStock);
    remainingStock -= allocatedQty;

    let allocationStatus: AllocationStatus = 'PENDING';
    if (allocatedQty === entry.order.requestedQty && allocatedQty > 0) {
      allocationStatus = 'APPROVED_SLA';
    } else if (allocatedQty > 0) {
      allocationStatus = 'PARTIAL_ALLOCATED';
    }

    decisions.push({
      orderId: entry.order.id,
      orderNumber: entry.order.orderNumber,
      distributorCode: entry.order.distributorCode,
      slaTier: entry.order.slaTier,
      slaScore: entry.order.slaScore,
      slaPriorityRank: index + 1,
      anomaly: entry.anomaly,
      allocatedQty,
      allocationStatus,
    });
  });

  return { decisions, remainingStock };
}
