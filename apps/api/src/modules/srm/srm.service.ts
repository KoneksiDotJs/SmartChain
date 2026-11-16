import type { AuditWriter } from '../../lib/audit.js';
import { AppError } from '../../lib/response.js';
import { buildRfqFallbackPlan, selectBestBackupSupplier, type SupplierRecord } from './srm.domain.js';
import type { CreatedPoRecord, SrmRepository } from './srm.repository.js';

export interface TriggerFallbackInput {
  haltedSupplierIdOrCode?: string;
  haltedDays?: number;
  materialId?: string;
  factoryId?: string;
  actorId: string;
  actorRole: string;
}

export interface TriggerFallbackResult {
  haltedSupplier: SupplierRecord;
  backupSupplier: SupplierRecord;
  rfqOrder: CreatedPoRecord;
  adjustedSafetyStock: number;
  adjustedReorderPoint: number;
}

export function createSrmService(repo: SrmRepository, audit: AuditWriter) {
  return {
    async listSuppliers(): Promise<SupplierRecord[]> {
      return repo.listSuppliers();
    },

    async setSupplierStatus(
      supplierIdOrCode: string,
      status: 'ACTIVE' | 'HALTED' | 'STANDBY',
      haltedDays: number,
      actor: { id: string; role: string },
    ): Promise<SupplierRecord> {
      const existing = await repo.findSupplierByIdOrCode(supplierIdOrCode);
      if (!existing) {
        throw new AppError(`Pemasok ${supplierIdOrCode} tidak ditemukan`, 404, 'SUPPLIER_NOT_FOUND');
      }

      const updated = await repo.updateSupplierStatus(existing.id, status, haltedDays);
      await audit.append({
        entityType: 'Supplier',
        entityId: updated.id,
        action: 'SUPPLIER_STATUS_CHANGED',
        actorId: actor.id,
        actorRole: actor.role,
        previousState: { status: existing.status, haltedDays: existing.haltedDays },
        newState: { status: updated.status, haltedDays: updated.haltedDays },
        reason: status === 'HALTED' ? `Pemasok berhenti pasokan ${haltedDays} hari` : 'Pemulihan status pemasok',
      });
      return updated;
    },

    async triggerRfqFallback(input: TriggerFallbackInput): Promise<TriggerFallbackResult> {
      const allSuppliers = await repo.listSuppliers();
      const targetKey = input.haltedSupplierIdOrCode ?? 'SUP-01';
      let halted = allSuppliers.find((s) => s.id === targetKey || s.code === targetKey);

      if (!halted) {
        halted = allSuppliers.find((s) => s.tierType === 'MAIN' && s.status === 'HALTED') ??
          allSuppliers.find((s) => s.tierType === 'MAIN');
      }
      if (!halted) {
        throw new AppError('Tidak ada pemasok utama yang tersedia', 404, 'SUPPLIER_NOT_FOUND');
      }

      const haltedDays = input.haltedDays ?? (halted.haltedDays > 0 ? halted.haltedDays : 14);
      const updatedHalted = await repo.updateSupplierStatus(halted.id, 'HALTED', haltedDays);

      const backup = selectBestBackupSupplier(allSuppliers, halted.materialCategory);
      if (!backup) {
        throw new AppError(
          'Tidak ada pemasok cadangan Tier-2 aktif yang tersedia',
          409,
          'NO_BACKUP_SUPPLIER',
        );
      }

      const material = await repo.findMaterialForCategory(halted.materialCategory, input.materialId);
      const factoryId = await repo.findPrimaryFactoryId(input.factoryId);
      if (!material || !factoryId) {
        throw new AppError('Master bahan baku atau pabrik tidak lengkap', 404, 'MASTER_DATA_MISSING');
      }

      const plan = buildRfqFallbackPlan(backup, material, haltedDays);
      const poNumber = `RFQ-${Date.now().toString().slice(-6)}`;
      const rfqOrder = await repo.createFallbackRfqPo({
        poNumber,
        supplierId: backup.id,
        materialId: material.id,
        factoryId,
        quantity: plan.recommendedQty,
        expectedDate: plan.expectedDate,
        notes: `Auto-RFQ fallback akibat ${updatedHalted.code} (${updatedHalted.name}) berhenti ${haltedDays} hari`,
      });

      await repo.updateMaterialRop(
        material.id,
        plan.adjustedSafetyStock,
        plan.adjustedReorderPoint,
      );

      await audit.append({
        entityType: 'PurchaseOrder',
        entityId: rfqOrder.id,
        action: 'SRM_RFQ_FALLBACK_TRIGGERED',
        actorId: input.actorId,
        actorRole: input.actorRole,
        previousState: {
          haltedSupplier: updatedHalted.code,
          haltedDays,
        },
        newState: {
          poNumber: rfqOrder.poNumber,
          backupSupplier: backup.code,
          quantity: rfqOrder.quantity,
          adjustedSafetyStock: plan.adjustedSafetyStock,
          adjustedReorderPoint: plan.adjustedReorderPoint,
        },
        reason: `Multi-sourcing otomatis: ${updatedHalted.code} berhenti ${haltedDays} hari -> RFQ ke ${backup.code}`,
      });

      return {
        haltedSupplier: updatedHalted,
        backupSupplier: backup,
        rfqOrder,
        adjustedSafetyStock: plan.adjustedSafetyStock,
        adjustedReorderPoint: plan.adjustedReorderPoint,
      };
    },
  };
}
