export type SmartChainRole =
  | 'DIREKSI'
  | 'PROCUREMENT_MANAGER'
  | 'WAREHOUSE_OPERATOR'
  | 'LOGISTICS_MANAGER'
  | 'PARTNER';

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  tierType: 'MAIN' | 'BACKUP';
  slaScore: number;
  leadTimeDays: number;
  status: 'ACTIVE' | 'HALTED' | 'STANDBY';
  haltedDays: number;
  materialCategory: string;
  city: string;
}

export interface PurchaseOrderDto {
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
  expectedDate: string;
  notes: string | null;
}

export interface WarehouseStockDto {
  stockId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  city: string;
  networkStatus: 'ONLINE' | 'OFFLINE';
  offlineHours: number;
  lastSyncAt: string;
  materialId: string;
  materialSku: string;
  materialName: string;
  rfidQty: number;
  physicalQty: number;
  quarantineQty: number;
  rop: number;
  safetyStock: number;
}

export interface SalesOrderDto {
  id: string;
  orderNumber: string;
  distributorCode: string;
  distributorName: string;
  routeGroup: string;
  slaTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  slaScore: number;
  monthlyQuota: number;
  requestedQty: number;
  allocatedQty: number;
  totalAmount: number;
  anomalyFlag: boolean;
  anomalyReason: string | null;
  allocationStatus: string;
  depositConfirmed: boolean;
}

export interface ShipmentDto {
  id: string;
  shipmentNumber: string;
  orderNumber: string;
  distributorName: string;
  routeGroup: string;
  carrierName: string;
  baseCost: number;
  consolidatedCost: number;
  isConsolidated: boolean;
  consolidationBatchId: string | null;
  trackingStatus: string;
}

export interface ForecastMaterialDto {
  materialId: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  quarantineStock: number;
  leadTimeDays: number;
  dynamicSafetyStock: number;
  reorderPoint: number;
  needsProcurement: boolean;
  recommendedOrderQty: number;
  forecast: {
    forecastNextPeriod: number;
    completenessPercent: number;
    validIntervals: number;
    totalIntervals: number;
    missingPeriods: string[];
    qualityIndicator: 'COMPLETE' | 'INCOMPLETE_DATA_WARNING' | 'INSUFFICIENT_DATA';
    methodUsed: 'STANDARD_FORECAST' | 'HYBRID_WMA';
    advisoryNote: string;
  };
}

export interface AuditEntryDto {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorRole: string;
  reason?: string;
  idempotencyKey?: string;
  createdAt: string;
}
