import type { AuditWriter } from '../../lib/audit.js';
import { AppError } from '../../lib/response.js';
import { evaluateOrderAnomaly, type AnomalyAssessment } from '../../middleware/anomalyGuard.js';
import {
  allocateOrdersWithAnomalyGuard,
  computeSlaPriorityScore,
  type AllocationStatus,
  type OrderAllocationDecision,
} from './orders.domain.js';
import type { OrdersRepository, SalesOrderSummaryRow } from './orders.repository.js';

export interface ValidateOrderInput {
  orderIdOrNumber?: string;
  distributorIdOrCode?: string;
  materialIdOrSku?: string;
  requestedQty?: number;
  depositConfirmed?: boolean;
  actorId: string;
  actorRole: string;
}

export interface ValidateOrderResult {
  order: SalesOrderSummaryRow;
  assessment: AnomalyAssessment;
}

export function createOrdersService(repo: OrdersRepository, audit: AuditWriter) {
  return {
    async listOrders(partnerEntityCode?: string): Promise<SalesOrderSummaryRow[]> {
      return repo.listOrders(partnerEntityCode);
    },

    async validateAndAllocateOrder(input: ValidateOrderInput): Promise<ValidateOrderResult> {
      if (input.orderIdOrNumber) {
        const existing = await repo.findOrderByIdOrNumber(input.orderIdOrNumber);
        if (!existing) {
          throw new AppError(`Pesanan ${input.orderIdOrNumber} tidak ditemukan`, 404, 'ORDER_NOT_FOUND');
        }

        const assessment = evaluateOrderAnomaly({
          requestedQty: existing.requestedQty,
          monthlyQuota: existing.monthlyQuota,
          orderValue: existing.requestedQty * existing.unitPrice,
          creditLimit: existing.creditLimit,
          usedCredit: existing.usedCredit,
          depositConfirmed: input.depositConfirmed ?? existing.depositConfirmed,
        });

        const slaPriority = computeSlaPriorityScore(existing.slaTier, existing.slaScore);
        const allocationStatus: AllocationStatus = assessment.isAnomaly
          ? 'HELD_ANOMALY'
          : 'APPROVED_SLA';

        const updated = await repo.updateOrderAllocation({
          orderId: existing.id,
          allocatedQty: assessment.isAnomaly ? 0 : existing.requestedQty,
          anomalyFlag: assessment.isAnomaly,
          anomalyReason: assessment.reasons.join(' ') || null,
          slaPriority,
          allocationStatus,
        });

        await audit.append({
          entityType: 'SalesOrder',
          entityId: updated.id,
          action: assessment.isAnomaly ? 'ORDER_HELD_ANOMALY_GUARD' : 'ORDER_APPROVED_SLA',
          actorId: input.actorId,
          actorRole: input.actorRole,
          newState: {
            orderNumber: updated.orderNumber,
            allocatedQty: updated.allocatedQty,
            allocationStatus: updated.allocationStatus,
            quotaRatio: assessment.quotaRatio,
          },
          reason:
            assessment.reasons.join(' ') ||
            `Lolos Anomaly Guard & prioritas SLA (${updated.slaTier})`,
        });

        return { order: updated, assessment };
      }

      if (!input.distributorIdOrCode || !input.materialIdOrSku || !input.requestedQty) {
        throw new AppError(
          'Harus menyertakan orderIdOrNumber atau (distributorIdOrCode, materialIdOrSku, requestedQty)',
          400,
          'INVALID_VALIDATE_ORDER_PAYLOAD',
        );
      }

      const resolved = await repo.findDistributorAndMaterial(
        input.distributorIdOrCode,
        input.materialIdOrSku,
      );
      if (!resolved) {
        throw new AppError('Distributor atau material tidak ditemukan', 404, 'ENTITY_NOT_FOUND');
      }

      const depositConfirmed = input.depositConfirmed ?? false;
      const totalAmount = input.requestedQty * resolved.unitPrice;
      const assessment = evaluateOrderAnomaly({
        requestedQty: input.requestedQty,
        monthlyQuota: resolved.monthlyQuota,
        orderValue: totalAmount,
        creditLimit: resolved.creditLimit,
        usedCredit: resolved.usedCredit,
        depositConfirmed,
      });

      const slaPriority = computeSlaPriorityScore(resolved.slaTier, resolved.slaScore);
      let allocationStatus: AllocationStatus = 'HELD_ANOMALY';
      let allocatedQty = 0;

      if (!assessment.isAnomaly) {
        allocatedQty = Math.min(input.requestedQty, resolved.availablePhysicalStock);
        allocationStatus =
          allocatedQty === input.requestedQty ? 'APPROVED_SLA' : 'PARTIAL_ALLOCATED';
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const created = await repo.createOrder({
        orderNumber,
        distributorId: resolved.distributorId,
        materialId: resolved.materialId,
        requestedQty: input.requestedQty,
        allocatedQty,
        unitPrice: resolved.unitPrice,
        totalAmount,
        anomalyFlag: assessment.isAnomaly,
        anomalyReason: assessment.reasons.join(' ') || null,
        slaPriority,
        allocationStatus,
        depositConfirmed,
      });

      await audit.append({
        entityType: 'SalesOrder',
        entityId: created.id,
        action: assessment.isAnomaly ? 'ORDER_HELD_ANOMALY_GUARD' : 'ORDER_CREATED_SLA',
        actorId: input.actorId,
        actorRole: input.actorRole,
        newState: {
          orderNumber: created.orderNumber,
          requestedQty: created.requestedQty,
          allocatedQty: created.allocatedQty,
          allocationStatus: created.allocationStatus,
        },
        reason:
          assessment.reasons.join(' ') ||
          `Alokasi prioritas SLA ${resolved.slaTier} (skor ${resolved.slaScore})`,
      });

      return { order: created, assessment };
    },

    async allocateSurgeQueue(
      materialId: string,
      availableStockOverride: number | undefined,
      actor: { id: string; role: string },
    ): Promise<{ decisions: OrderAllocationDecision[]; remainingStock: number }> {
      const orders = await repo.listPendingOrdersForMaterial(materialId);
      const stock =
        availableStockOverride ?? (await repo.getAvailableStockForMaterial(materialId));

      const { decisions, remainingStock } = allocateOrdersWithAnomalyGuard(orders, stock);

      for (const decision of decisions) {
        await repo.updateOrderAllocation({
          orderId: decision.orderId,
          allocatedQty: decision.allocatedQty,
          anomalyFlag: decision.anomaly.isAnomaly,
          anomalyReason: decision.anomaly.reasons.join(' ') || null,
          slaPriority: computeSlaPriorityScore(decision.slaTier, decision.slaScore),
          allocationStatus: decision.allocationStatus,
        });
      }

      await audit.append({
        entityType: 'SalesOrderBatch',
        entityId: materialId,
        action: 'ORDER_SURGE_SLA_ALLOCATED',
        actorId: actor.id,
        actorRole: actor.role,
        newState: {
          processedOrders: decisions.length,
          heldAnomalies: decisions.filter((d) => d.anomaly.isAnomaly).length,
          remainingStock,
        },
        reason: 'Alokasi prioritas SLA saat lonjakan permintaan +300%',
      });

      return { decisions, remainingStock };
    },
  };
}
