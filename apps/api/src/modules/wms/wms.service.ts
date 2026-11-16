import type { AuditWriter } from '../../lib/audit.js';
import { AppError } from '../../lib/response.js';
import {
  applyStockDelta,
  computeCycleCountReconciliation,
  prepareOrderedBatch,
  type OfflineScanItem,
  type ReconciliationResult,
} from './wms.domain.js';
import type { WmsRepository } from './wms.repository.js';

export interface SyncBatchResult {
  appliedCount: number;
  skippedDuplicateKeys: string[];
  updatedStockIds: string[];
}

export function createWmsService(repo: WmsRepository, audit: AuditWriter) {
  return {
    async listOverview() {
      const [stocks, syncLogs] = await Promise.all([
        repo.listWarehouseStocks(),
        repo.listRecentSyncLogs(25),
      ]);
      return { stocks, syncLogs };
    },

    async setWarehouseNetwork(
      warehouseIdOrCode: string,
      networkStatus: 'ONLINE' | 'OFFLINE',
      offlineHours: number,
      actor: { id: string; role: string },
    ) {
      const updated = await repo.markWarehouseNetworkStatus(
        warehouseIdOrCode,
        networkStatus,
        offlineHours,
      );
      if (!updated) {
        throw new AppError(`Gudang ${warehouseIdOrCode} tidak ditemukan`, 404, 'WAREHOUSE_NOT_FOUND');
      }

      await audit.append({
        entityType: 'Warehouse',
        entityId: updated.id,
        action: `WAREHOUSE_NETWORK_${networkStatus}`,
        actorId: actor.id,
        actorRole: actor.role,
        newState: { code: updated.code, networkStatus, offlineHours },
        reason:
          networkStatus === 'OFFLINE'
            ? `Simulasi putus koneksi ${offlineHours} jam (mode Store-and-Forward aktif)`
            : 'Koneksi gudang kembali pulih',
      });
      return updated;
    },

    async syncBatch(
      items: OfflineScanItem[],
      actor: { id: string; role: string },
    ): Promise<SyncBatchResult> {
      const ordered = prepareOrderedBatch(items);
      const skippedDuplicateKeys: string[] = [];
      const updatedStockIds = new Set<string>();
      let appliedCount = 0;

      for (const item of ordered) {
        const existingLog = await repo.findSyncLogByIdempotencyKey(item.idempotencyKey);
        if (existingLog) {
          skippedDuplicateKeys.push(item.idempotencyKey);
          continue;
        }

        const stock = await repo.findStockById(item.stockId);
        if (!stock) {
          throw new AppError(`InventoryStock ${item.stockId} tidak ditemukan`, 404, 'STOCK_NOT_FOUND');
        }

        const { nextRfidQty, nextPhysicalQty } = applyStockDelta(
          stock.rfidQty,
          stock.physicalQty,
          item.deltaQty,
          item.direction,
        );

        await repo.applySyncTransaction({
          stockId: stock.id,
          warehouseId: stock.warehouseId,
          nextRfidQty,
          nextPhysicalQty,
          syncLog: {
            stockId: stock.id,
            warehouseId: stock.warehouseId,
            idempotencyKey: item.idempotencyKey,
            deltaQty: item.deltaQty,
            direction: item.direction,
            offlineTimestamp: new Date(item.offlineTimestamp),
            wasOffline: item.wasOffline ?? true,
            operatorId: actor.id,
          },
        });

        await audit.append({
          entityType: 'InventoryStock',
          entityId: stock.id,
          action: 'WMS_OFFLINE_SYNC_APPLIED',
          actorId: actor.id,
          actorRole: actor.role,
          previousState: { rfidQty: stock.rfidQty, physicalQty: stock.physicalQty },
          newState: { rfidQty: nextRfidQty, physicalQty: nextPhysicalQty, direction: item.direction, deltaQty: item.deltaQty },
          idempotencyKey: item.idempotencyKey,
          reason: `Sinkronisasi batch ber-timestamp ${item.offlineTimestamp}`,
        });

        appliedCount += 1;
        updatedStockIds.add(stock.id);
      }

      return {
        appliedCount,
        skippedDuplicateKeys,
        updatedStockIds: Array.from(updatedStockIds),
      };
    },

    async reconcileCycleCount(
      params: { stockId: string; overridePhysicalQty?: number; notes?: string },
      actor: { id: string; role: string },
    ): Promise<ReconciliationResult> {
      const stock = await repo.findStockById(params.stockId);
      if (!stock) {
        throw new AppError(`InventoryStock ${params.stockId} tidak ditemukan`, 404, 'STOCK_NOT_FOUND');
      }

      const result = computeCycleCountReconciliation({
        stockId: stock.id,
        rfidQty: stock.rfidQty,
        physicalQty: stock.physicalQty,
        currentQuarantineQty: stock.quarantineQty,
        overridePhysicalQty: params.overridePhysicalQty,
      });

      await repo.updateStockReconciliation({
        stockId: stock.id,
        rfidQty: result.newAvailableRfidQty,
        physicalQty: result.physicalQty,
        quarantineQty: result.newQuarantineQty,
      });

      await audit.append({
        entityType: 'InventoryStock',
        entityId: stock.id,
        action: 'WMS_CYCLE_COUNT_RECONCILED',
        actorId: actor.id,
        actorRole: actor.role,
        previousState: {
          rfidQty: stock.rfidQty,
          physicalQty: stock.physicalQty,
          quarantineQty: stock.quarantineQty,
        },
        newState: {
          rfidQty: result.newAvailableRfidQty,
          physicalQty: result.physicalQty,
          quarantineQty: result.newQuarantineQty,
          discrepancyQuarantined: result.discrepancyQty,
        },
        reason:
          params.notes ??
          `Rekonsiliasi selisih RFID (${stock.rfidQty}) vs fisik (${result.physicalQty}): ${result.discrepancyQty} unit masuk karantina`,
      });

      return result;
    },
  };
}
