export interface InventoryLedgerItem {
  stockId: string;
  warehouseCode: string;
  warehouseName: string;
  city: string;
  networkStatus: 'ONLINE' | 'OFFLINE';
  materialSku: string;
  materialName: string;
  materialCategory: string;
  rfidQty: number;
  physicalQty: number;
  quarantineQty: number;
  discrepancyQty: number;
  rop: number;
  safetyStock: number;
  healthStatus: 'HEALTHY' | 'BELOW_ROP' | 'DISCREPANCY_ALERT';
}

export interface TraceabilityInput {
  materialSku?: string;
  warehouseCode?: string;
  suppliers: Array<{ code: string; name: string; tierType: string; status: string; materialCategory: string }>;
  materials: Array<{ sku: string; name: string; category: string; reorderPoint: number; safetyStock: number }>;
  factories: Array<{ code: string; name: string; city: string; dailyCapacity: number }>;
  stocks: InventoryLedgerItem[];
  purchaseOrders: Array<{ poNumber: string; supplierCode: string; materialSku: string; factoryCode: string; quantity: number; status: string }>;
  salesOrders: Array<{ orderNumber: string; distributorCode: string; distributorName: string; materialSku: string; requestedQty: number; allocatedQty: number; allocationStatus: string }>;
  shipments: Array<{ shipmentNumber: string; orderNumber: string; warehouseCode: string; routeGroup: string; trackingStatus: string; isConsolidated: boolean }>;
  distributors: Array<{ code: string; name: string; city: string; routeGroup: string; slaTier: string }>;
}

export interface TraceabilityGraphResult {
  filterApplied: { materialSku: string | null; warehouseCode: string | null };
  summaryCounts: {
    suppliers: number;
    materials: number;
    factories: number;
    warehouses: number;
    purchaseOrders: number;
    salesOrders: number;
    shipments: number;
    distributors: number;
  };
  links: Array<{
    stage: 'SOURCE_TO_FACTORY' | 'FACTORY_TO_WAREHOUSE' | 'WAREHOUSE_TO_DISTRIBUTOR';
    fromEntity: string;
    toEntity: string;
    materialSku: string;
    documentRef: string;
    quantity: number;
    status: string;
  }>;
}

export function classifyInventoryHealth(item: {
  rfidQty: number;
  physicalQty: number;
  rop: number;
}): 'HEALTHY' | 'BELOW_ROP' | 'DISCREPANCY_ALERT' {
  if (Math.abs(item.rfidQty - item.physicalQty) > 0) {
    return 'DISCREPANCY_ALERT';
  }
  if (item.physicalQty <= item.rop) {
    return 'BELOW_ROP';
  }
  return 'HEALTHY';
}

/**
 * Pure domain builder for End-to-End Supply Chain Entity Relationship Traceability:
 * Connects Suppliers -> Materials -> 3 Factories -> 8 Warehouses -> Orders -> Shipments -> 25 Distributors.
 */
export function buildEntityTraceabilityChain(input: TraceabilityInput): TraceabilityGraphResult {
  const skuFilter = input.materialSku?.trim().toUpperCase() || null;
  const whFilter = input.warehouseCode?.trim().toUpperCase() || null;

  const filteredMaterials = skuFilter
    ? input.materials.filter((m) => m.sku === skuFilter)
    : input.materials;
  const allowedCategories = new Set(filteredMaterials.map((m) => m.category));
  const allowedSkus = new Set(filteredMaterials.map((m) => m.sku));

  const filteredSuppliers = skuFilter
    ? input.suppliers.filter((s) => allowedCategories.has(s.materialCategory))
    : input.suppliers;

  const filteredStocks = input.stocks.filter(
    (st) =>
      (!skuFilter || st.materialSku === skuFilter) &&
      (!whFilter || st.warehouseCode === whFilter),
  );

  const filteredPos = input.purchaseOrders.filter((po) => allowedSkus.has(po.materialSku));
  const filteredOrders = input.salesOrders.filter((so) => allowedSkus.has(so.materialSku));
  const allowedOrderNumbers = new Set(filteredOrders.map((o) => o.orderNumber));

  const filteredShipments = input.shipments.filter(
    (sh) =>
      allowedOrderNumbers.has(sh.orderNumber) &&
      (!whFilter || sh.warehouseCode === whFilter),
  );

  const activeDistCodes = new Set(filteredOrders.map((o) => o.distributorCode));
  const filteredDistributors =
    skuFilter || whFilter
      ? input.distributors.filter((d) => activeDistCodes.has(d.code))
      : input.distributors;

  const links: TraceabilityGraphResult['links'] = [];

  for (const po of filteredPos) {
    links.push({
      stage: 'SOURCE_TO_FACTORY',
      fromEntity: po.supplierCode,
      toEntity: po.factoryCode,
      materialSku: po.materialSku,
      documentRef: po.poNumber,
      quantity: po.quantity,
      status: po.status,
    });
  }

  for (const st of filteredStocks.slice(0, 12)) {
    const primaryFactory = input.factories[0]?.code ?? 'FAC-01';
    links.push({
      stage: 'FACTORY_TO_WAREHOUSE',
      fromEntity: primaryFactory,
      toEntity: st.warehouseCode,
      materialSku: st.materialSku,
      documentRef: st.stockId,
      quantity: st.physicalQty,
      status: st.healthStatus,
    });
  }

  for (const sh of filteredShipments) {
    const matchingOrder = filteredOrders.find((o) => o.orderNumber === sh.orderNumber);
    links.push({
      stage: 'WAREHOUSE_TO_DISTRIBUTOR',
      fromEntity: sh.warehouseCode,
      toEntity: matchingOrder?.distributorCode ?? 'DIST',
      materialSku: matchingOrder?.materialSku ?? 'MAT-01',
      documentRef: `${sh.shipmentNumber} (${sh.orderNumber})`,
      quantity: matchingOrder?.allocatedQty ?? 0,
      status: sh.trackingStatus,
    });
  }

  return {
    filterApplied: { materialSku: skuFilter, warehouseCode: whFilter },
    summaryCounts: {
      suppliers: filteredSuppliers.length,
      materials: filteredMaterials.length,
      factories: input.factories.length,
      warehouses: new Set(filteredStocks.map((s) => s.warehouseCode)).size,
      purchaseOrders: filteredPos.length,
      salesOrders: filteredOrders.length,
      shipments: filteredShipments.length,
      distributors: filteredDistributors.length,
    },
    links,
  };
}
