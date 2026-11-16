export type SyncDirection = 'IN' | 'OUT' | 'CYCLE_COUNT';

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
