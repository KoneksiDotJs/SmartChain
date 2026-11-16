import type { PrismaClient } from '@prisma/client';
import type { SyncDirection } from './wms.domain.js';

export interface WarehouseStockSummary {
  stockId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  city: string;
  networkStatus: 'ONLINE' | 'OFFLINE';
  offlineHours: number;
  lastSyncAt: Date;
  materialId: string;
  materialSku: string;
  materialName: string;
  rfidQty: number;
  physicalQty: number;
  quarantineQty: number;
  rop: number;
  safetyStock: number;
}

export interface StockRow {
  id: string;
  warehouseId: string;
  materialId: string;
  rfidQty: number;
  physicalQty: number;
  quarantineQty: number;
}

export interface InsertSyncLogInput {
  stockId: string;
  warehouseId: string;
  idempotencyKey: string;
  deltaQty: number;
  direction: SyncDirection;
  offlineTimestamp: Date;
  wasOffline: boolean;
  operatorId: string;
}

export interface WmsRepository {
  listWarehouseStocks(): Promise<WarehouseStockSummary[]>;
  findStockById(stockId: string): Promise<StockRow | null>;
  findSyncLogByIdempotencyKey(key: string): Promise<{ id: string } | null>;
  applySyncTransaction(params: {
    stockId: string;
    warehouseId: string;
    nextRfidQty: number;
    nextPhysicalQty: number;
    syncLog: InsertSyncLogInput;
  }): Promise<StockRow>;
  markWarehouseNetworkStatus(
    warehouseIdOrCode: string,
    networkStatus: 'ONLINE' | 'OFFLINE',
    offlineHours: number,
  ): Promise<{ id: string; code: string; networkStatus: string; offlineHours: number } | null>;
  updateStockReconciliation(params: {
    stockId: string;
    rfidQty: number;
    physicalQty: number;
    quarantineQty: number;
  }): Promise<StockRow>;
  listRecentSyncLogs(limit?: number): Promise<
    Array<{
      id: string;
      warehouseCode: string;
      idempotencyKey: string;
      deltaQty: number;
      direction: string;
      offlineTimestamp: Date;
      syncedAt: Date;
      wasOffline: boolean;
    }>
  >;
}

export function createPrismaWmsRepository(prisma: PrismaClient): WmsRepository {
  return {
    async listWarehouseStocks(): Promise<WarehouseStockSummary[]> {
      const rows = await prisma.inventoryStock.findMany({
        include: {
          warehouse: true,
          material: true,
        },
        orderBy: [{ warehouse: { code: 'asc' } }, { material: { sku: 'asc' } }],
      });
      return rows.map((r) => ({
        stockId: r.id,
        warehouseId: r.warehouse.id,
        warehouseCode: r.warehouse.code,
        warehouseName: r.warehouse.name,
        city: r.warehouse.city,
        networkStatus: r.warehouse.networkStatus,
        offlineHours: r.warehouse.offlineHours,
        lastSyncAt: r.warehouse.lastSyncAt,
        materialId: r.material.id,
        materialSku: r.material.sku,
        materialName: r.material.name,
        rfidQty: r.rfidQty,
        physicalQty: r.physicalQty,
        quarantineQty: r.quarantineQty,
        rop: r.rop,
        safetyStock: r.safetyStock,
      }));
    },

    async findStockById(stockId: string): Promise<StockRow | null> {
      const row = await prisma.inventoryStock.findUnique({ where: { id: stockId } });
      if (!row) return null;
      return {
        id: row.id,
        warehouseId: row.warehouseId,
        materialId: row.materialId,
        rfidQty: row.rfidQty,
        physicalQty: row.physicalQty,
        quarantineQty: row.quarantineQty,
      };
    },

    async findSyncLogByIdempotencyKey(key: string): Promise<{ id: string } | null> {
      return prisma.rfidSyncLog.findUnique({
        where: { idempotencyKey: key },
        select: { id: true },
      });
    },

    async applySyncTransaction(params): Promise<StockRow> {
      const [updatedStock] = await prisma.$transaction([
        prisma.inventoryStock.update({
          where: { id: params.stockId },
          data: {
            rfidQty: params.nextRfidQty,
            physicalQty: params.nextPhysicalQty,
          },
        }),
        prisma.rfidSyncLog.create({
          data: {
            stockId: params.syncLog.stockId,
            warehouseId: params.syncLog.warehouseId,
            idempotencyKey: params.syncLog.idempotencyKey,
            deltaQty: params.syncLog.deltaQty,
            direction: params.syncLog.direction,
            offlineTimestamp: params.syncLog.offlineTimestamp,
            wasOffline: params.syncLog.wasOffline,
            operatorId: params.syncLog.operatorId,
          },
        }),
        prisma.warehouse.update({
          where: { id: params.warehouseId },
          data: {
            networkStatus: 'ONLINE',
            offlineHours: 0,
            lastSyncAt: new Date(),
          },
        }),
      ]);

      return {
        id: updatedStock.id,
        warehouseId: updatedStock.warehouseId,
        materialId: updatedStock.materialId,
        rfidQty: updatedStock.rfidQty,
        physicalQty: updatedStock.physicalQty,
        quarantineQty: updatedStock.quarantineQty,
      };
    },

    async markWarehouseNetworkStatus(warehouseIdOrCode, networkStatus, offlineHours) {
      const wh = await prisma.warehouse.findFirst({
        where: { OR: [{ id: warehouseIdOrCode }, { code: warehouseIdOrCode }] },
      });
      if (!wh) return null;
      const updated = await prisma.warehouse.update({
        where: { id: wh.id },
        data: {
          networkStatus,
          offlineHours,
          lastSyncAt: networkStatus === 'ONLINE' ? new Date() : wh.lastSyncAt,
        },
      });
      return {
        id: updated.id,
        code: updated.code,
        networkStatus: updated.networkStatus,
        offlineHours: updated.offlineHours,
      };
    },

    async updateStockReconciliation(params): Promise<StockRow> {
      const updated = await prisma.inventoryStock.update({
        where: { id: params.stockId },
        data: {
          rfidQty: params.rfidQty,
          physicalQty: params.physicalQty,
          quarantineQty: params.quarantineQty,
          lastCountedAt: new Date(),
        },
      });
      return {
        id: updated.id,
        warehouseId: updated.warehouseId,
        materialId: updated.materialId,
        rfidQty: updated.rfidQty,
        physicalQty: updated.physicalQty,
        quarantineQty: updated.quarantineQty,
      };
    },

    async listRecentSyncLogs(limit = 20) {
      const rows = await prisma.rfidSyncLog.findMany({
        include: { warehouse: { select: { code: true } } },
        orderBy: { syncedAt: 'desc' },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        warehouseCode: r.warehouse.code,
        idempotencyKey: r.idempotencyKey,
        deltaQty: r.deltaQty,
        direction: r.direction,
        offlineTimestamp: r.offlineTimestamp,
        syncedAt: r.syncedAt,
        wasOffline: r.wasOffline,
      }));
    },
  };
}
