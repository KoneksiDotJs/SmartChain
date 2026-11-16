import type { AuditWriter } from '../../lib/audit.js';
import { AppError } from '../../lib/response.js';
import type { PoRepository, PoSummaryRow } from './po.repository.js';

export interface CreatePurchaseOrderInput {
  supplierIdOrCode: string;
  materialIdOrSku: string;
  factoryIdOrCode: string;
  quantity: number;
  notes?: string;
  actorId: string;
  actorRole: string;
}

export function createPoService(repo: PoRepository, audit: AuditWriter) {
  return {
    async listOrders(partnerEntityCode?: string): Promise<PoSummaryRow[]> {
      return repo.listOrders(partnerEntityCode);
    },

    async createOrder(input: CreatePurchaseOrderInput): Promise<PoSummaryRow> {
      const resolved = await repo.resolveEntities(input);
      if (!resolved) {
        throw new AppError(
          'Pemasok, bahan baku, atau pabrik tidak ditemukan',
          404,
          'ENTITY_NOT_FOUND',
        );
      }

      const triggeredByRop = resolved.currentStock <= resolved.reorderPoint;
      const expectedDate = new Date(Date.now() + resolved.leadTimeDays * 86_400_000);
      const poNumber = `PO-${Date.now().toString().slice(-6)}`;

      const created = await repo.createOrder({
        poNumber,
        supplierId: resolved.supplierId,
        materialId: resolved.materialId,
        factoryId: resolved.factoryId,
        quantity: input.quantity,
        triggeredByRop,
        expectedDate,
        notes: input.notes,
      });

      await audit.append({
        entityType: 'PurchaseOrder',
        entityId: created.id,
        action: 'PO_CREATED',
        actorId: input.actorId,
        actorRole: input.actorRole,
        newState: {
          poNumber: created.poNumber,
          quantity: created.quantity,
          triggeredByRop,
          status: created.status,
        },
        reason: triggeredByRop ? 'Stok menyentuh/di bawah Reorder Point (ROP)' : 'Pengadaan terjadwal',
      });

      return created;
    },

    async advanceStatus(
      id: string,
      status: 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED',
      actor: { id: string; role: string },
    ): Promise<PoSummaryRow> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(`Purchase Order ${id} tidak ditemukan`, 404, 'PO_NOT_FOUND');
      }

      const updated = await repo.updateStatus(id, status);
      await audit.append({
        entityType: 'PurchaseOrder',
        entityId: updated.id,
        action: `PO_STATUS_${status}`,
        actorId: actor.id,
        actorRole: actor.role,
        previousState: { status: existing.status },
        newState: { status: updated.status },
      });
      return updated;
    },
  };
}
