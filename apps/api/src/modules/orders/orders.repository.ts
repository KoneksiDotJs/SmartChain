import type { PrismaClient } from '@prisma/client';
import type { AllocationStatus, OrderForAllocation, SlaTier } from './orders.domain.js';

export interface SalesOrderSummaryRow {
  id: string;
  orderNumber: string;
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  routeGroup: string;
  slaTier: SlaTier;
  slaScore: number;
  monthlyQuota: number;
  creditLimit: number;
  usedCredit: number;
  materialId: string;
  materialSku: string;
  materialName: string;
  requestedQty: number;
  allocatedQty: number;
  unitPrice: number;
  totalAmount: number;
  anomalyFlag: boolean;
  anomalyReason: string | null;
  slaPriority: number;
  allocationStatus: AllocationStatus;
  depositConfirmed: boolean;
  createdAt: Date;
}

export interface OrdersRepository {
  listOrders(distributorCodeFilter?: string): Promise<SalesOrderSummaryRow[]>;
  findOrderByIdOrNumber(idOrNumber: string): Promise<OrderForAllocation | null>;
  findDistributorAndMaterial(
    distributorIdOrCode: string,
    materialIdOrSku: string,
  ): Promise<{
    distributorId: string;
    distributorCode: string;
    distributorName: string;
    slaTier: SlaTier;
    slaScore: number;
    monthlyQuota: number;
    creditLimit: number;
    usedCredit: number;
    materialId: string;
    unitPrice: number;
    availablePhysicalStock: number;
  } | null>;
  getAvailableStockForMaterial(materialId: string): Promise<number>;
  createOrder(params: {
    orderNumber: string;
    distributorId: string;
    materialId: string;
    requestedQty: number;
    allocatedQty: number;
    unitPrice: number;
    totalAmount: number;
    anomalyFlag: boolean;
    anomalyReason: string | null;
    slaPriority: number;
    allocationStatus: AllocationStatus;
    depositConfirmed: boolean;
  }): Promise<SalesOrderSummaryRow>;
  updateOrderAllocation(params: {
    orderId: string;
    allocatedQty: number;
    anomalyFlag: boolean;
    anomalyReason: string | null;
    slaPriority: number;
    allocationStatus: AllocationStatus;
  }): Promise<SalesOrderSummaryRow>;
  listPendingOrdersForMaterial(materialId: string): Promise<OrderForAllocation[]>;
}

function mapSalesOrder(row: {
  id: string;
  orderNumber: string;
  distributorId: string;
  materialId: string;
  requestedQty: number;
  allocatedQty: number;
  unitPrice: number;
  totalAmount: number;
  anomalyFlag: boolean;
  anomalyReason: string | null;
  slaPriority: number;
  allocationStatus: string;
  depositConfirmed: boolean;
  createdAt: Date;
  distributor: {
    code: string;
    name: string;
    routeGroup: string;
    slaTier: string;
    slaScore: number;
    monthlyQuota: number;
    creditLimit: number;
    usedCredit: number;
  };
  material: { sku: string; name: string };
}): SalesOrderSummaryRow {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    distributorId: row.distributorId,
    distributorCode: row.distributor.code,
    distributorName: row.distributor.name,
    routeGroup: row.distributor.routeGroup,
    slaTier: row.distributor.slaTier as SlaTier,
    slaScore: row.distributor.slaScore,
    monthlyQuota: row.distributor.monthlyQuota,
    creditLimit: row.distributor.creditLimit,
    usedCredit: row.distributor.usedCredit,
    materialId: row.materialId,
    materialSku: row.material.sku,
    materialName: row.material.name,
    requestedQty: row.requestedQty,
    allocatedQty: row.allocatedQty,
    unitPrice: row.unitPrice,
    totalAmount: row.totalAmount,
    anomalyFlag: row.anomalyFlag,
    anomalyReason: row.anomalyReason,
    slaPriority: row.slaPriority,
    allocationStatus: row.allocationStatus as AllocationStatus,
    depositConfirmed: row.depositConfirmed,
    createdAt: row.createdAt,
  };
}

export function createPrismaOrdersRepository(prisma: PrismaClient): OrdersRepository {
  return {
    async listOrders(distributorCodeFilter?: string): Promise<SalesOrderSummaryRow[]> {
      const rows = await prisma.salesOrder.findMany({
        where: distributorCodeFilter
          ? { distributor: { code: distributorCodeFilter } }
          : undefined,
        include: {
          distributor: true,
          material: { select: { sku: true, name: true } },
        },
        orderBy: [{ slaPriority: 'desc' }, { createdAt: 'desc' }],
      });
      return rows.map(mapSalesOrder);
    },

    async findOrderByIdOrNumber(idOrNumber: string): Promise<OrderForAllocation | null> {
      const row = await prisma.salesOrder.findFirst({
        where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
        include: { distributor: true },
      });
      if (!row) return null;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        distributorId: row.distributorId,
        distributorCode: row.distributor.code,
        distributorName: row.distributor.name,
        slaTier: row.distributor.slaTier as SlaTier,
        slaScore: row.distributor.slaScore,
        monthlyQuota: row.distributor.monthlyQuota,
        creditLimit: row.distributor.creditLimit,
        usedCredit: row.distributor.usedCredit,
        requestedQty: row.requestedQty,
        unitPrice: row.unitPrice,
        depositConfirmed: row.depositConfirmed,
        createdAt: row.createdAt,
      };
    },

    async findDistributorAndMaterial(distributorIdOrCode: string, materialIdOrSku: string) {
      const [dist, mat] = await Promise.all([
        prisma.distributor.findFirst({
          where: { OR: [{ id: distributorIdOrCode }, { code: distributorIdOrCode }] },
        }),
        prisma.materialProduct.findFirst({
          where: { OR: [{ id: materialIdOrSku }, { sku: materialIdOrSku }] },
          include: { stocks: true },
        }),
      ]);
      if (!dist || !mat) return null;
      const availablePhysicalStock = mat.stocks.reduce((sum, s) => sum + s.physicalQty, 0);
      return {
        distributorId: dist.id,
        distributorCode: dist.code,
        distributorName: dist.name,
        slaTier: dist.slaTier as SlaTier,
        slaScore: dist.slaScore,
        monthlyQuota: dist.monthlyQuota,
        creditLimit: dist.creditLimit,
        usedCredit: dist.usedCredit,
        materialId: mat.id,
        unitPrice: mat.unitCost,
        availablePhysicalStock,
      };
    },

    async getAvailableStockForMaterial(materialId: string): Promise<number> {
      const agg = await prisma.inventoryStock.aggregate({
        where: { materialId },
        _sum: { physicalQty: true },
      });
      return agg._sum.physicalQty ?? 0;
    },

    async createOrder(params): Promise<SalesOrderSummaryRow> {
      const row = await prisma.salesOrder.create({
        data: params,
        include: {
          distributor: true,
          material: { select: { sku: true, name: true } },
        },
      });
      return mapSalesOrder(row);
    },

    async updateOrderAllocation(params): Promise<SalesOrderSummaryRow> {
      const row = await prisma.salesOrder.update({
        where: { id: params.orderId },
        data: {
          allocatedQty: params.allocatedQty,
          anomalyFlag: params.anomalyFlag,
          anomalyReason: params.anomalyReason,
          slaPriority: params.slaPriority,
          allocationStatus: params.allocationStatus,
        },
        include: {
          distributor: true,
          material: { select: { sku: true, name: true } },
        },
      });
      return mapSalesOrder(row);
    },

    async listPendingOrdersForMaterial(materialId: string): Promise<OrderForAllocation[]> {
      const rows = await prisma.salesOrder.findMany({
        where: { materialId, allocationStatus: { not: 'DISPATCHED' } },
        include: { distributor: true },
      });
      return rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        distributorId: row.distributorId,
        distributorCode: row.distributor.code,
        distributorName: row.distributor.name,
        slaTier: row.distributor.slaTier as SlaTier,
        slaScore: row.distributor.slaScore,
        monthlyQuota: row.distributor.monthlyQuota,
        creditLimit: row.distributor.creditLimit,
        usedCredit: row.distributor.usedCredit,
        requestedQty: row.requestedQty,
        unitPrice: row.unitPrice,
        depositConfirmed: row.depositConfirmed,
        createdAt: row.createdAt,
      }));
    },
  };
}
