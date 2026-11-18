export type SyncDirection = 'IN' | 'OUT' | 'CYCLE_COUNT';
export type ScanTagType = 'RFID' | 'BARCODE';

export interface ParsedScanTag {
  rawCode: string;
  tagType: ScanTagType;
  materialSku: string;
  warehouseCode?: string;
  suggestedQty: number;
}

function normalizeCodeToken(token: string, prefix: 'MAT' | 'WH'): string {
  const upper = token.trim().toUpperCase();
  const compact = upper.replaceAll('-', '');
  if (compact.startsWith(prefix) && compact.length > prefix.length) {
    return `${prefix}-${compact.slice(prefix.length)}`;
  }
  return upper;
}

/**
 * Decodes hardware Barcode (EAN/Code128) or RFID (EPC/SmartTag) payloads:
 * - RFID:<SKU>:<WH>:<QTY>   e.g. RFID:MAT-01:WH-04:10
 * - EPC-<SKU>-<WH>-<SEQ>    e.g. EPC-MAT01-WH04-001
 * - BC-<SKU>-<QTY>          e.g. BC-MAT01-015
 * - Numeric EAN-13 prefix   8991001.. -> MAT-01, 8991002.. -> MAT-02, 8991003.. -> MAT-03, 8991004.. -> MAT-04
 */
export function parseBarcodeOrRfidTag(rawCode: string): ParsedScanTag | null {
  const cleaned = rawCode.trim().toUpperCase();
  if (!cleaned) return null;

const MAX_WMS_TAG_QTY = 100_000;

  if (cleaned.startsWith('RFID:')) {
    const parts = cleaned.split(':');
    const skuPart = parts[1];
    if (!skuPart) return null;
    const whPart = parts[2];
    const hasQty = parts[3] !== undefined && parts[3] !== '';
    const qtyPart = hasQty ? Number(parts[3]) : 10;
    if (!Number.isFinite(qtyPart) || qtyPart <= 0 || qtyPart > MAX_WMS_TAG_QTY) {
      return null;
    }
    return {
      rawCode: cleaned,
      tagType: 'RFID',
      materialSku: normalizeCodeToken(skuPart, 'MAT'),
      warehouseCode: whPart ? normalizeCodeToken(whPart, 'WH') : undefined,
      suggestedQty: Math.round(qtyPart),
    };
  }

  if (cleaned.startsWith('EPC-')) {
    const parts = cleaned.split('-');
    const skuPart = parts[1];
    if (!skuPart) return null;
    const whPart = parts[2];
    return {
      rawCode: cleaned,
      tagType: 'RFID',
      materialSku: normalizeCodeToken(skuPart, 'MAT'),
      warehouseCode: whPart ? normalizeCodeToken(whPart, 'WH') : undefined,
      suggestedQty: 10,
    };
  }

  if (cleaned.startsWith('BC-')) {
    const parts = cleaned.split('-');
    const skuPart = parts[1];
    if (!skuPart) return null;
    const hasQty = parts[2] !== undefined && parts[2] !== '';
    const qtyPart = hasQty ? Number(parts[2]) : 1;
    if (!Number.isFinite(qtyPart) || qtyPart <= 0 || qtyPart > MAX_WMS_TAG_QTY) {
      return null;
    }
    return {
      rawCode: cleaned,
      tagType: 'BARCODE',
      materialSku: normalizeCodeToken(skuPart, 'MAT'),
      suggestedQty: Math.round(qtyPart),
    };
  }

  const eanMatch = /^899100([1-4])\d{2,10}$/.exec(cleaned);
  if (eanMatch) {
    return {
      rawCode: cleaned,
      tagType: 'BARCODE',
      materialSku: `MAT-0${eanMatch[1]!}`,
      suggestedQty: 1,
    };
  }

  return null;
}

export interface OfflineScanItem {
  idempotencyKey: string;
  stockId: string;
  deltaQty: number;
  direction: SyncDirection;
  offlineTimestamp: string;
  wasOffline?: boolean;
}

export interface ReconciliationResult {
  stockId: string;
  previousRfidQty: number;
  physicalQty: number;
  discrepancyQty: number;
  newQuarantineQty: number;
  newAvailableRfidQty: number;
  accuracyPercent: number;
}

/**
 * Chronologically sorts offline scans by offlineTimestamp and deduplicates
 * repeated idempotencyKeys within the same batch payload.
 */
export function prepareOrderedBatch(items: OfflineScanItem[]): OfflineScanItem[] {
  const seenInBatch = new Set<string>();
  const unique: OfflineScanItem[] = [];

  const sorted = [...items].sort(
    (a, b) => new Date(a.offlineTimestamp).getTime() - new Date(b.offlineTimestamp).getTime(),
  );

  for (const item of sorted) {
    if (seenInBatch.has(item.idempotencyKey)) {
      continue;
    }
    seenInBatch.add(item.idempotencyKey);
    unique.push(item);
  }

  return unique;
}

export function applyStockDelta(
  currentRfidQty: number,
  currentPhysicalQty: number,
  deltaQty: number,
  direction: SyncDirection,
): { nextRfidQty: number; nextPhysicalQty: number } {
  if (direction === 'IN') {
    return {
      nextRfidQty: currentRfidQty + deltaQty,
      nextPhysicalQty: currentPhysicalQty + deltaQty,
    };
  }
  if (direction === 'OUT') {
    return {
      nextRfidQty: Math.max(0, currentRfidQty - deltaQty),
      nextPhysicalQty: Math.max(0, currentPhysicalQty - deltaQty),
    };
  }
  // CYCLE_COUNT updates physical count directly via delta or target override
  return {
    nextRfidQty: currentRfidQty,
    nextPhysicalQty: Math.max(0, currentPhysicalQty + deltaQty),
  };
}

/**
 * Pure cycle-count reconciliation rule (FR-03):
 * Isolates discrepancy (e.g. RFID 500 vs physical 320 -> 180 unit phantom inventory)
 * into quarantineQty and aligns available rfidQty with verified physical stock.
 */
export function computeCycleCountReconciliation(params: {
  stockId: string;
  rfidQty: number;
  physicalQty: number;
  currentQuarantineQty: number;
  overridePhysicalQty?: number;
}): ReconciliationResult {
  const verifiedPhysical = Math.max(0, params.overridePhysicalQty ?? params.physicalQty);
  const discrepancyQty = Math.abs(params.rfidQty - verifiedPhysical);
  const newQuarantineQty = params.currentQuarantineQty + discrepancyQty;
  const accuracyPercent =
    params.rfidQty <= 0
      ? 100
      : Number((Math.min(verifiedPhysical, params.rfidQty) / params.rfidQty * 100).toFixed(1));

  return {
    stockId: params.stockId,
    previousRfidQty: params.rfidQty,
    physicalQty: verifiedPhysical,
    discrepancyQty,
    newQuarantineQty,
    newAvailableRfidQty: verifiedPhysical,
    accuracyPercent,
  };
}

export type WarehouseLabelType = 'BARCODE_CODE128' | 'RFID_SMARTTAG' | 'RFID_EPC';

export interface IssuedWarehouseLabel {
  rawCode: string;
  labelType: WarehouseLabelType;
  scanTagType: ScanTagType;
  materialSku: string;
  warehouseCode: string;
  quantity: number;
  batchCode: string;
  issuedAt: string;
}

/**
 * Generates deterministic, scanner-ready Barcode (Code128) or RFID (SmartTag / EPC)
 * label payloads matching `parseBarcodeOrRfidTag`.
 */
export function buildWarehouseLabelPayload(params: {
  labelType: WarehouseLabelType;
  materialSku: string;
  warehouseCode: string;
  quantity: number;
  batchCode?: string;
}): IssuedWarehouseLabel {
  const materialSku = normalizeCodeToken(params.materialSku, 'MAT');
  const warehouseCode = normalizeCodeToken(params.warehouseCode, 'WH');
  const quantity = Math.max(1, Math.min(9999, Math.round(params.quantity)));
  const compactSku = materialSku.replaceAll('-', '');
  const compactWh = warehouseCode.replaceAll('-', '');
  const cleanBatch = (params.batchCode?.trim().toUpperCase() || 'B001').replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'B001';

  let rawCode: string;
  let scanTagType: ScanTagType;

  if (params.labelType === 'RFID_SMARTTAG') {
    rawCode = `RFID:${materialSku}:${warehouseCode}:${quantity}`;
    scanTagType = 'RFID';
  } else if (params.labelType === 'RFID_EPC') {
    rawCode = `EPC-${compactSku}-${compactWh}-${cleanBatch}`;
    scanTagType = 'RFID';
  } else {
    rawCode = `BC-${compactSku}-${String(quantity).padStart(3, '0')}`;
    scanTagType = 'BARCODE';
  }

  return {
    rawCode,
    labelType: params.labelType,
    scanTagType,
    materialSku,
    warehouseCode,
    quantity,
    batchCode: cleanBatch,
    issuedAt: new Date().toISOString(),
  };
}
