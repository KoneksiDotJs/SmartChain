import type { PrismaClient } from '@prisma/client';

export interface PoSummaryRow {
  id: string;
  poNumber: string;
  supplierCode: string;
  supplierName: string;
  materialSku: string;
  materialName: string;
  factoryName: string;
  quantity: number;
  isRfqFallback: boolean;
  triggeredByRop: boolean;
  status: string;
  expectedDate: Date;
  notes: string | null;
  createdAt: Date;
}

export interface CreatePoParams {
  poNumber: string;
  supplierId: string;
  materialId: string;
  factoryId: string;
  quantity: number;
  triggeredByRop: boolean;
  expectedDate: Date;
  notes?: string;
}

export interface PoRepository {
  listOrders(supplierCodeFilter?: string): Promise<PoSummaryRow[]>;
  findById(id: string): Promise<PoSummaryRow | null>;
  createOrder(params: CreatePoParams): Promise<PoSummaryRow>;
  updateStatus(
    id: string,
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED',
  ): Promise<PoSummaryRow>;
  resolveEntities(input: {
    supplierIdOrCode: string;
    materialIdOrSku: string;
    factoryIdOrCode: string;
  }): Promise<{
    supplierId: string;
    leadTimeDays: number;
    materialId: string;
    currentStock: number;
    reorderPoint: number;
    factoryId: string;
  } | null>;
}

function mapPoRow(row: {
  id: string;
  poNumber: string;
  quantity: number;
  isRfqFallback: boolean;
  triggeredByRop: boolean;
  status: string;
  expectedDate: Date;
  notes: string | null;
  createdAt: Date;
  supplier: { code: string; name: string };
  material: { sku: string; name: string };
  factory: { name: string };
}): PoSummaryRow {
  return {
    id: row.id,
    poNumber: row.poNumber,
    supplierCode: row.supplier.code,
    supplierName: row.supplier.name,
    materialSku: row.material.sku,
    materialName: row.material.name,
    factoryName: row.factory.name,
    quantity: row.quantity,
    isRfqFallback: row.isRfqFallback,
    triggeredByRop: row.triggeredByRop,
    status: row.status,
    expectedDate: row.expectedDate,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export function createPrismaPoRepository(prisma: PrismaClient): PoRepository {
  return {
    async listOrders(supplierCodeFilter?: string): Promise<PoSummaryRow[]> {
      if (supplierCodeFilter !== undefined && !supplierCodeFilter.trim()) {
        return [];
      }
      const rows = await prisma.purchaseOrder.findMany({
        where: supplierCodeFilter ? { supplier: { code: supplierCodeFilter } } : undefined,
        include: {
          supplier: { select: { code: true, name: true } },
          material: { select: { sku: true, name: true } },
          factory: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapPoRow);
    },

    async findById(id: string): Promise<PoSummaryRow | null> {
      const row = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: { select: { code: true, name: true } },
          material: { select: { sku: true, name: true } },
          factory: { select: { name: true } },
        },
      });
      return row ? mapPoRow(row) : null;
    },

    async createOrder(params: CreatePoParams): Promise<PoSummaryRow> {
      const row = await prisma.purchaseOrder.create({
        data: {
          poNumber: params.poNumber,
          supplierId: params.supplierId,
          materialId: params.materialId,
          factoryId: params.factoryId,
          quantity: params.quantity,
          triggeredByRop: params.triggeredByRop,
          status: 'PENDING_APPROVAL',
          expectedDate: params.expectedDate,
          notes: params.notes,
        },
        include: {
          supplier: { select: { code: true, name: true } },
          material: { select: { sku: true, name: true } },
          factory: { select: { name: true } },
        },
      });
      return mapPoRow(row);
    },

    async updateStatus(
      id: string,
      status: 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED',
    ): Promise<PoSummaryRow> {
      const row = await prisma.purchaseOrder.update({
        where: { id },
        data: { status },
        include: {
          supplier: { select: { code: true, name: true } },
          material: { select: { sku: true, name: true } },
          factory: { select: { name: true } },
        },
      });
      return mapPoRow(row);
    },

    async resolveEntities(input) {
      const [supplier, material, factory] = await Promise.all([
        prisma.supplier.findFirst({
          where: { OR: [{ id: input.supplierIdOrCode }, { code: input.supplierIdOrCode }] },
        }),
        prisma.materialProduct.findFirst({
          where: { OR: [{ id: input.materialIdOrSku }, { sku: input.materialIdOrSku }] },
          include: { stocks: true },
        }),
        prisma.factory.findFirst({
          where: { OR: [{ id: input.factoryIdOrCode }, { code: input.factoryIdOrCode }] },
        }),
      ]);

      if (!supplier || !material || !factory) return null;
      return {
        supplierId: supplier.id,
        leadTimeDays: supplier.leadTimeDays,
        materialId: material.id,
        currentStock: material.stocks.reduce((sum, s) => sum + s.physicalQty, 0),
        reorderPoint: material.reorderPoint,
        factoryId: factory.id,
      };
    },
  };
}
