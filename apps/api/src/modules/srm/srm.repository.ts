import type { PrismaClient } from '@prisma/client';
import type { FallbackMaterialInput, SupplierRecord } from './srm.domain.js';

export interface CreateRfqPoInput {
  poNumber: string;
  supplierId: string;
  materialId: string;
  factoryId: string;
  quantity: number;
  expectedDate: Date;
  notes: string;
}

export interface CreatedPoRecord {
  id: string;
  poNumber: string;
  supplierId: string;
  materialId: string;
  factoryId: string;
  quantity: number;
  isRfqFallback: boolean;
  status: string;
  expectedDate: Date;
}

export interface SrmRepository {
  listSuppliers(): Promise<SupplierRecord[]>;
  findSupplierByIdOrCode(idOrCode: string): Promise<SupplierRecord | null>;
  updateSupplierStatus(
    supplierId: string,
    status: 'ACTIVE' | 'HALTED' | 'STANDBY',
    haltedDays: number,
  ): Promise<SupplierRecord>;
  findMaterialForCategory(category: string, materialId?: string): Promise<FallbackMaterialInput | null>;
  findPrimaryFactoryId(factoryId?: string): Promise<string | null>;
  createFallbackRfqPo(input: CreateRfqPoInput): Promise<CreatedPoRecord>;
  updateMaterialRop(materialId: string, safetyStock: number, reorderPoint: number): Promise<void>;
}

export function createPrismaSrmRepository(prisma: PrismaClient): SrmRepository {
  return {
    async listSuppliers(): Promise<SupplierRecord[]> {
      const rows = await prisma.supplier.findMany({
        orderBy: [{ tierType: 'asc' }, { code: 'asc' }],
      });
      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        tierType: row.tierType,
        slaScore: row.slaScore,
        leadTimeDays: row.leadTimeDays,
        status: row.status,
        haltedDays: row.haltedDays,
        materialCategory: row.materialCategory,
        city: row.city,
      }));
    },

    async findSupplierByIdOrCode(idOrCode: string): Promise<SupplierRecord | null> {
      const row = await prisma.supplier.findFirst({
        where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
      });
      if (!row) return null;
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        tierType: row.tierType,
        slaScore: row.slaScore,
        leadTimeDays: row.leadTimeDays,
        status: row.status,
        haltedDays: row.haltedDays,
        materialCategory: row.materialCategory,
        city: row.city,
      };
    },

    async updateSupplierStatus(
      supplierId: string,
      status: 'ACTIVE' | 'HALTED' | 'STANDBY',
      haltedDays: number,
    ): Promise<SupplierRecord> {
      const row = await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          status,
          haltedDays,
          haltedAt: status === 'HALTED' ? new Date() : null,
        },
      });
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        tierType: row.tierType,
        slaScore: row.slaScore,
        leadTimeDays: row.leadTimeDays,
        status: row.status,
        haltedDays: row.haltedDays,
        materialCategory: row.materialCategory,
        city: row.city,
      };
    },

    async findMaterialForCategory(
      category: string,
      materialId?: string,
    ): Promise<FallbackMaterialInput | null> {
      const mat = materialId
        ? await prisma.materialProduct.findUnique({ where: { id: materialId }, include: { stocks: true } })
        : (await prisma.materialProduct.findFirst({
            where: { category },
            include: { stocks: true },
          })) ??
          (await prisma.materialProduct.findFirst({ include: { stocks: true } }));

      if (!mat) return null;
      return {
        id: mat.id,
        sku: mat.sku,
        name: mat.name,
        dailyDemandAvg: mat.dailyDemandAvg,
        demandStdDev: mat.demandStdDev,
        currentStock: mat.stocks.reduce((sum, s) => sum + s.physicalQty, 0),
      };
    },

    async findPrimaryFactoryId(factoryId?: string): Promise<string | null> {
      if (factoryId) {
        const found = await prisma.factory.findUnique({ where: { id: factoryId } });
        return found?.id ?? null;
      }
      const first = await prisma.factory.findFirst({ orderBy: { code: 'asc' } });
      return first?.id ?? null;
    },

    async createFallbackRfqPo(input: CreateRfqPoInput): Promise<CreatedPoRecord> {
      const created = await prisma.purchaseOrder.create({
        data: {
          poNumber: input.poNumber,
          supplierId: input.supplierId,
          materialId: input.materialId,
          factoryId: input.factoryId,
          quantity: input.quantity,
          isRfqFallback: true,
          triggeredByRop: true,
          status: 'DRAFT_RFQ',
          expectedDate: input.expectedDate,
          notes: input.notes,
        },
      });
      return {
        id: created.id,
        poNumber: created.poNumber,
        supplierId: created.supplierId,
        materialId: created.materialId,
        factoryId: created.factoryId,
        quantity: created.quantity,
        isRfqFallback: created.isRfqFallback,
        status: created.status,
        expectedDate: created.expectedDate,
      };
    },

    async updateMaterialRop(materialId: string, safetyStock: number, reorderPoint: number): Promise<void> {
      await prisma.materialProduct.update({
        where: { id: materialId },
        data: { safetyStock, reorderPoint },
      });
    },
  };
}
