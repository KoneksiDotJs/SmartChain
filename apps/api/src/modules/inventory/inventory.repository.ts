import type { PrismaClient } from '@prisma/client';
import {
  classifyInventoryHealth,
  type InventoryLedgerItem,
  type TraceabilityInput,
} from './inventory.domain.js';

export interface InventoryRepository {
  getLedger(filters?: { materialSku?: string; warehouseCode?: string }): Promise<InventoryLedgerItem[]>;
  getTraceabilitySnapshot(filters?: { materialSku?: string; warehouseCode?: string }): Promise<TraceabilityInput>;
}

export function createPrismaInventoryRepository(prisma: PrismaClient): InventoryRepository {
  return {
    async getLedger(filters): Promise<InventoryLedgerItem[]> {
      const rows = await prisma.inventoryStock.findMany({
        where: {
          ...(filters?.materialSku ? { material: { sku: filters.materialSku } } : {}),
          ...(filters?.warehouseCode ? { warehouse: { code: filters.warehouseCode } } : {}),
        },
        include: {
          warehouse: true,
          material: true,
        },
        orderBy: [{ warehouse: { code: 'asc' } }, { material: { sku: 'asc' } }],
      });

      return rows.map((r) => {
        const discrepancyQty = Math.abs(r.rfidQty - r.physicalQty);
        return {
          stockId: r.id,
          warehouseCode: r.warehouse.code,
          warehouseName: r.warehouse.name,
          city: r.warehouse.city,
          networkStatus: r.warehouse.networkStatus,
          materialSku: r.material.sku,
          materialName: r.material.name,
          materialCategory: r.material.category,
          rfidQty: r.rfidQty,
          physicalQty: r.physicalQty,
          quarantineQty: r.quarantineQty,
          discrepancyQty,
          rop: r.rop,
          safetyStock: r.safetyStock,
          healthStatus: classifyInventoryHealth({
            rfidQty: r.rfidQty,
            physicalQty: r.physicalQty,
            rop: r.rop,
          }),
        };
      });
    },

    async getTraceabilitySnapshot(filters): Promise<TraceabilityInput> {
      const [
        suppliers,
        materials,
        factories,
        stocks,
        purchaseOrders,
        salesOrders,
        shipments,
        distributors,
      ] = await Promise.all([
        prisma.supplier.findMany({ orderBy: { code: 'asc' } }),
        prisma.materialProduct.findMany({ orderBy: { sku: 'asc' } }),
        prisma.factory.findMany({ orderBy: { code: 'asc' } }),
        this.getLedger(filters),
        prisma.purchaseOrder.findMany({
          include: {
            supplier: { select: { code: true } },
            material: { select: { sku: true } },
            factory: { select: { code: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.salesOrder.findMany({
          include: {
            distributor: { select: { code: true, name: true } },
            material: { select: { sku: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.shipment.findMany({
          include: {
            order: { select: { orderNumber: true } },
            warehouse: { select: { code: true } },
          },
          orderBy: { shipmentNumber: 'asc' },
        }),
        prisma.distributor.findMany({ orderBy: { code: 'asc' } }),
      ]);

      return {
        materialSku: filters?.materialSku,
        warehouseCode: filters?.warehouseCode,
        suppliers: suppliers.map((s) => ({
          code: s.code,
          name: s.name,
          tierType: s.tierType,
          status: s.status,
          materialCategory: s.materialCategory,
        })),
        materials: materials.map((m) => ({
          sku: m.sku,
          name: m.name,
          category: m.category,
          reorderPoint: m.reorderPoint,
          safetyStock: m.safetyStock,
        })),
        factories: factories.map((f) => ({
          code: f.code,
          name: f.name,
          city: f.city,
          dailyCapacity: f.dailyCapacity,
        })),
        stocks,
        purchaseOrders: purchaseOrders.map((po) => ({
          poNumber: po.poNumber,
          supplierCode: po.supplier.code,
          materialSku: po.material.sku,
          factoryCode: po.factory.code,
          quantity: po.quantity,
          status: po.status,
        })),
        salesOrders: salesOrders.map((so) => ({
          orderNumber: so.orderNumber,
          distributorCode: so.distributor.code,
          distributorName: so.distributor.name,
          materialSku: so.material.sku,
          requestedQty: so.requestedQty,
          allocatedQty: so.allocatedQty,
          allocationStatus: so.allocationStatus,
        })),
        shipments: shipments.map((sh) => ({
          shipmentNumber: sh.shipmentNumber,
          orderNumber: sh.order.orderNumber,
          warehouseCode: sh.warehouse.code,
          routeGroup: sh.routeGroup,
          trackingStatus: sh.trackingStatus,
          isConsolidated: sh.isConsolidated,
        })),
        distributors: distributors.map((d) => ({
          code: d.code,
          name: d.name,
          city: d.city,
          routeGroup: d.routeGroup,
          slaTier: d.slaTier,
        })),
      };
    },
  };
}
