import type { AuditEntryInput, AuditRecord, AuditWriter } from '../../lib/audit.js';
import type { AnalyticsRepository, MaterialAnalyticsRow } from '../../modules/analytics/analytics.repository.js';
import type { OrderForAllocation, AllocationStatus, SlaTier } from '../../modules/orders/orders.domain.js';
import type { OrdersRepository, SalesOrderSummaryRow } from '../../modules/orders/orders.repository.js';
import type { FallbackMaterialInput, SupplierRecord } from '../../modules/srm/srm.domain.js';
import type { CreatedPoRecord, CreateRfqPoInput, SrmRepository } from '../../modules/srm/srm.repository.js';
import type { ShipmentCandidate } from '../../modules/tms/tms.domain.js';
import type { TmsRepository } from '../../modules/tms/tms.repository.js';
import type { SyncDirection } from '../../modules/wms/wms.domain.js';
import type { InsertSyncLogInput, StockRow, WarehouseStockSummary, WmsRepository } from '../../modules/wms/wms.repository.js';

export function createInMemoryAuditWriter(): AuditWriter & { entries: AuditRecord[] } {
  const entries: AuditRecord[] = [];
  return {
    entries,
    async append(entry: AuditEntryInput): Promise<AuditRecord> {
      const record: AuditRecord = {
        ...entry,
        id: `aud-${entries.length + 1}`,
        createdAt: new Date(),
      };
      entries.push(record);
      return record;
    },
    async listRecent(limit = 30): Promise<AuditRecord[]> {
      return [...entries].reverse().slice(0, limit);
    },
  };
}

export function createInMemoryRepositories() {
  const suppliers: SupplierRecord[] = [
    {
      id: 'sup-1',
      code: 'SUP-01',
      name: 'PT Baja Nusantara',
      tierType: 'MAIN',
      slaScore: 96,
      leadTimeDays: 4,
      status: 'HALTED',
      haltedDays: 14,
      materialCategory: 'LOGAM',
      city: 'Cilegon',
    },
    {
      id: 'sup-16',
      code: 'SUP-16',
      name: 'PT Mitra Bahan Cadangan',
      tierType: 'BACKUP',
      slaScore: 91,
      leadTimeDays: 5,
      status: 'STANDBY',
      haltedDays: 0,
      materialCategory: 'LOGAM',
      city: 'Bekasi',
    },
  ];

  const material: FallbackMaterialInput & { safetyStock: number; reorderPoint: number; unitCost: number } = {
    id: 'mat-1',
    sku: 'MAT-01',
    name: 'Baja Lembaran Canai Dingin',
    dailyDemandAvg: 65,
    demandStdDev: 14,
    currentStock: 320,
    safetyStock: 47,
    reorderPoint: 307,
    unitCost: 420_000,
  };

  const purchaseOrders: CreatedPoRecord[] = [];

  const srmRepo: SrmRepository = {
    async listSuppliers() {
      return [...suppliers];
    },
    async findSupplierByIdOrCode(idOrCode) {
      return suppliers.find((s) => s.id === idOrCode || s.code === idOrCode) ?? null;
    },
    async updateSupplierStatus(supplierId, status, haltedDays) {
      const found = suppliers.find((s) => s.id === supplierId)!;
      found.status = status;
      found.haltedDays = haltedDays;
      return { ...found };
    },
    async findMaterialForCategory() {
      return { ...material };
    },
    async findPrimaryFactoryId() {
      return 'fac-1';
    },
    async createFallbackRfqPo(input: CreateRfqPoInput) {
      const created: CreatedPoRecord = {
        id: `po-${purchaseOrders.length + 1}`,
        poNumber: input.poNumber,
        supplierId: input.supplierId,
        materialId: input.materialId,
        factoryId: input.factoryId,
        quantity: input.quantity,
        isRfqFallback: true,
        status: 'DRAFT_RFQ',
        expectedDate: input.expectedDate,
      };
      purchaseOrders.push(created);
      return created;
    },
    async updateMaterialRop(_materialId, safetyStock, reorderPoint) {
      material.safetyStock = safetyStock;
      material.reorderPoint = reorderPoint;
    },
  };

  const stocks: StockRow[] = [
    {
      id: 'stk-wh04',
      warehouseId: 'wh-04',
      materialId: 'mat-1',
      rfidQty: 500,
      physicalQty: 320,
      quarantineQty: 0,
    },
  ];
  const syncLogs: Array<InsertSyncLogInput & { id: string; syncedAt: Date }> = [];
  const warehouses = new Map<string, { id: string; code: string; networkStatus: 'ONLINE' | 'OFFLINE'; offlineHours: number }>([
    ['wh-04', { id: 'wh-04', code: 'WH-04', networkStatus: 'OFFLINE', offlineHours: 48 }],
  ]);

  const wmsRepo: WmsRepository = {
    async listWarehouseStocks(): Promise<WarehouseStockSummary[]> {
      const s = stocks[0]!;
      const wh = warehouses.get(s.warehouseId)!;
      return [
        {
          stockId: s.id,
          warehouseId: wh.id,
          warehouseCode: wh.code,
          warehouseName: 'Gudang #04 (Surabaya)',
          city: 'Surabaya',
          networkStatus: wh.networkStatus,
          offlineHours: wh.offlineHours,
          lastSyncAt: new Date(),
          materialId: material.id,
          materialSku: material.sku,
          materialName: material.name,
          rfidQty: s.rfidQty,
          physicalQty: s.physicalQty,
          quarantineQty: s.quarantineQty,
          rop: material.reorderPoint,
          safetyStock: material.safetyStock,
        },
      ];
    },
    async findStockById(stockId) {
      const found = stocks.find((s) => s.id === stockId);
      return found ? { ...found } : null;
    },
    async findStockByWarehouseAndSku(warehouseCode, materialSku) {
      if (warehouseCode === 'WH-04' && materialSku === 'MAT-01') {
        return { ...stocks[0]! };
      }
      return null;
    },
    async findSyncLogByIdempotencyKey(key) {
      const found = syncLogs.find((l) => l.idempotencyKey === key);
      return found ? { id: found.id } : null;
    },
    async applySyncTransaction(params) {
      const target = stocks.find((s) => s.id === params.stockId)!;
      target.rfidQty = params.nextRfidQty;
      target.physicalQty = params.nextPhysicalQty;
      syncLogs.push({
        ...params.syncLog,
        id: `sync-${syncLogs.length + 1}`,
        syncedAt: new Date(),
      });
      const wh = warehouses.get(params.warehouseId);
      if (wh) {
        wh.networkStatus = 'ONLINE';
        wh.offlineHours = 0;
      }
      return { ...target };
    },
    async markWarehouseNetworkStatus(warehouseIdOrCode, networkStatus, offlineHours) {
      const wh = [...warehouses.values()].find(
        (w) => w.id === warehouseIdOrCode || w.code === warehouseIdOrCode,
      );
      if (!wh) return null;
      wh.networkStatus = networkStatus;
      wh.offlineHours = offlineHours;
      return { ...wh };
    },
    async updateStockReconciliation(params) {
      const target = stocks.find((s) => s.id === params.stockId)!;
      target.rfidQty = params.rfidQty;
      target.physicalQty = params.physicalQty;
      target.quarantineQty = params.quarantineQty;
      return { ...target };
    },
    async listRecentSyncLogs() {
      return syncLogs.map((l) => ({
        id: l.id,
        warehouseCode: 'WH-04',
        idempotencyKey: l.idempotencyKey,
        deltaQty: l.deltaQty,
        direction: l.direction as SyncDirection,
        offlineTimestamp: l.offlineTimestamp,
        syncedAt: l.syncedAt,
        wasOffline: l.wasOffline,
      }));
    },
  };

  const distributors: Array<{
    id: string;
    code: string;
    name: string;
    routeGroup: string;
    slaTier: SlaTier;
    slaScore: number;
    monthlyQuota: number;
    creditLimit: number;
    usedCredit: number;
  }> = [
    {
      id: 'dist-1',
      code: 'DIST-01',
      name: 'PT Distribusi Timur',
      routeGroup: 'JAWA_BARAT',
      slaTier: 'TIER_1',
      slaScore: 96,
      monthlyQuota: 130,
      creditLimit: 250_000_000,
      usedCredit: 45_000_000,
    },
    {
      id: 'dist-2',
      code: 'DIST-02',
      name: 'CV Sentosa Jaya',
      routeGroup: 'JAWA_BARAT',
      slaTier: 'TIER_2',
      slaScore: 86,
      monthlyQuota: 150,
      creditLimit: 250_000_000,
      usedCredit: 180_000_000,
    },
    {
      id: 'dist-3',
      code: 'DIST-03',
      name: 'PT Surya Mandiri',
      routeGroup: 'JAWA_TIMUR',
      slaTier: 'TIER_3',
      slaScore: 76,
      monthlyQuota: 110,
      creditLimit: 250_000_000,
      usedCredit: 30_000_000,
    },
  ];

  const salesOrders: SalesOrderSummaryRow[] = [];

  const ordersRepo: OrdersRepository = {
    async listOrders(filter) {
      return filter ? salesOrders.filter((o) => o.distributorCode === filter) : [...salesOrders];
    },
    async findOrderByIdOrNumber(idOrNumber): Promise<OrderForAllocation | null> {
      const found = salesOrders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
      if (!found) return null;
      return {
        id: found.id,
        orderNumber: found.orderNumber,
        distributorId: found.distributorId,
        distributorCode: found.distributorCode,
        distributorName: found.distributorName,
        slaTier: found.slaTier,
        slaScore: found.slaScore,
        monthlyQuota: found.monthlyQuota,
        creditLimit: found.creditLimit,
        usedCredit: found.usedCredit,
        requestedQty: found.requestedQty,
        unitPrice: found.unitPrice,
        depositConfirmed: found.depositConfirmed,
        createdAt: found.createdAt,
      };
    },
    async findDistributorAndMaterial(distCode) {
      const dist = distributors.find((d) => d.id === distCode || d.code === distCode);
      if (!dist) return null;
      return {
        distributorId: dist.id,
        distributorCode: dist.code,
        distributorName: dist.name,
        slaTier: dist.slaTier,
        slaScore: dist.slaScore,
        monthlyQuota: dist.monthlyQuota,
        creditLimit: dist.creditLimit,
        usedCredit: dist.usedCredit,
        materialId: material.id,
        unitPrice: material.unitCost,
        availablePhysicalStock: stocks[0]!.physicalQty,
      };
    },
    async getAvailableStockForMaterial() {
      return stocks[0]!.physicalQty;
    },
    async createOrder(params) {
      const dist = distributors.find((d) => d.id === params.distributorId)!;
      const row: SalesOrderSummaryRow = {
        id: `ord-${salesOrders.length + 1}`,
        orderNumber: params.orderNumber,
        distributorId: dist.id,
        distributorCode: dist.code,
        distributorName: dist.name,
        routeGroup: dist.routeGroup,
        slaTier: dist.slaTier,
        slaScore: dist.slaScore,
        monthlyQuota: dist.monthlyQuota,
        creditLimit: dist.creditLimit,
        usedCredit: dist.usedCredit,
        materialId: params.materialId,
        materialSku: material.sku,
        materialName: material.name,
        requestedQty: params.requestedQty,
        allocatedQty: params.allocatedQty,
        unitPrice: params.unitPrice,
        totalAmount: params.totalAmount,
        anomalyFlag: params.anomalyFlag,
        anomalyReason: params.anomalyReason,
        slaPriority: params.slaPriority,
        allocationStatus: params.allocationStatus,
        depositConfirmed: params.depositConfirmed,
        createdAt: new Date(),
      };
      salesOrders.push(row);
      return row;
    },
    async updateOrderAllocation(params) {
      const row = salesOrders.find((o) => o.id === params.orderId)!;
      row.allocatedQty = params.allocatedQty;
      row.anomalyFlag = params.anomalyFlag;
      row.anomalyReason = params.anomalyReason;
      row.slaPriority = params.slaPriority;
      row.allocationStatus = params.allocationStatus as AllocationStatus;
      return { ...row };
    },
    async listPendingOrdersForMaterial() {
      return salesOrders.map((found) => ({
        id: found.id,
        orderNumber: found.orderNumber,
        distributorId: found.distributorId,
        distributorCode: found.distributorCode,
        distributorName: found.distributorName,
        slaTier: found.slaTier,
        slaScore: found.slaScore,
        monthlyQuota: found.monthlyQuota,
        creditLimit: found.creditLimit,
        usedCredit: found.usedCredit,
        requestedQty: found.requestedQty,
        unitPrice: found.unitPrice,
        depositConfirmed: found.depositConfirmed,
        createdAt: found.createdAt,
      }));
    },
  };

  const shipments: ShipmentCandidate[] = [
    {
      id: 'shp-1',
      shipmentNumber: 'SHP-2026-01',
      orderNumber: 'ORD-881',
      distributorName: 'PT Distribusi Timur',
      routeGroup: 'JAWA_BARAT',
      carrierName: 'Ekspedisi Nusantara Darat',
      baseCost: 5_800_000,
      consolidatedCost: 5_800_000,
      isConsolidated: false,
      consolidationBatchId: null,
      trackingStatus: 'PLANNED',
    },
    {
      id: 'shp-2',
      shipmentNumber: 'SHP-2026-02',
      orderNumber: 'ORD-884',
      distributorName: 'PT Mitra Niaga Bandung',
      routeGroup: 'JAWA_BARAT',
      carrierName: 'Ekspedisi Nusantara Darat',
      baseCost: 5_400_000,
      consolidatedCost: 5_400_000,
      isConsolidated: false,
      consolidationBatchId: null,
      trackingStatus: 'PLANNED',
    },
  ];

  const tmsRepo: TmsRepository = {
    async listShipments(routeGroupFilter) {
      return routeGroupFilter
        ? shipments.filter((s) => s.routeGroup === routeGroupFilter)
        : [...shipments];
    },
    async applyConsolidationUpdates(updates) {
      for (const u of updates) {
        const target = shipments.find((s) => s.id === u.id);
        if (target) {
          target.consolidatedCost = u.consolidatedCost;
          target.consolidationBatchId = u.consolidationBatchId;
          target.isConsolidated = true;
          target.trackingStatus = 'CONSOLIDATED';
        }
      }
    },
  };

  const analyticsRepo: AnalyticsRepository = {
    async getMaterialsWithHistory(): Promise<MaterialAnalyticsRow[]> {
      return [
        {
          id: material.id,
          sku: material.sku,
          name: material.name,
          unit: 'unit',
          dailyDemandAvg: material.dailyDemandAvg,
          demandStdDev: material.demandStdDev,
          leadTimeDays: 4,
          currentStock: stocks[0]!.physicalQty,
          quarantineStock: stocks[0]!.quarantineQty,
          demandHistory: [
            { periodLabel: 'M1-W1', periodIndex: 1, observedQty: 410, isMissing: false },
            { periodLabel: 'M1-W2', periodIndex: 2, observedQty: 435, isMissing: false },
            { periodLabel: 'M1-W3', periodIndex: 3, observedQty: null, isMissing: true },
            { periodLabel: 'M1-W4', periodIndex: 4, observedQty: 460, isMissing: false },
            { periodLabel: 'M2-W1', periodIndex: 5, observedQty: 490, isMissing: false },
            { periodLabel: 'M2-W2', periodIndex: 6, observedQty: null, isMissing: true },
            { periodLabel: 'M2-W3', periodIndex: 7, observedQty: 515, isMissing: false },
            { periodLabel: 'M2-W4', periodIndex: 8, observedQty: 530, isMissing: false },
            { periodLabel: 'M3-W1', periodIndex: 9, observedQty: null, isMissing: true },
            { periodLabel: 'M3-W2', periodIndex: 10, observedQty: 555, isMissing: false },
            { periodLabel: 'M3-W3', periodIndex: 11, observedQty: 580, isMissing: false },
            { periodLabel: 'M3-W4', periodIndex: 12, observedQty: null, isMissing: true },
          ],
        },
      ];
    },
    async getPerformanceInputs() {
      return {
        suppliers: suppliers.map((s) => ({
          code: s.code,
          name: s.name,
          tierType: s.tierType,
          slaScore: s.slaScore,
          leadTimeDays: s.leadTimeDays,
          status: s.status,
          haltedDays: s.haltedDays,
          materialCategory: s.materialCategory,
          poCount: 1,
        })),
        corridors: [
          {
            routeGroup: 'JAWA_BARAT',
            distributorsCount: 7,
            totalOrders: 2,
            heldAnomalies: 1,
            requestedUnits: 600,
            allocatedUnits: 120,
            baseShippingCost: 11_200_000,
            effectiveShippingCost: 8_064_000,
            consolidatedCount: 2,
          },
        ],
      };
    },
  };

  return {
    srmRepo,
    wmsRepo,
    ordersRepo,
    tmsRepo,
    analyticsRepo,
    state: { suppliers, material, purchaseOrders, stocks, syncLogs, salesOrders, shipments },
  };
}
