import { calculateReorderPoint, calculateSafetyStock } from '../analytics/analytics.domain.js';

export interface SupplierRecord {
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

export interface FallbackMaterialInput {
  id: string;
  sku: string;
  name: string;
  dailyDemandAvg: number;
  demandStdDev: number;
  currentStock: number;
}

export interface RfqFallbackRecommendation {
  backupSupplier: SupplierRecord;
  adjustedSafetyStock: number;
  adjustedReorderPoint: number;
  recommendedQty: number;
  expectedDate: Date;
}

/**
 * Pure domain selector choosing the highest-SLA backup supplier matching
 * the affected material category (or best overall Tier-2 standby supplier)
 * and recomputing Safety Stock & ROP for the backup lead time.
 */
export function selectBestBackupSupplier(
  suppliers: SupplierRecord[],
  materialCategory?: string,
): SupplierRecord | null {
  const backups = suppliers.filter(
    (s) => s.tierType === 'BACKUP' && s.status !== 'HALTED',
  );
  if (backups.length === 0) return null;

  const categoryMatches = materialCategory
    ? backups.filter((s) => s.materialCategory === materialCategory)
    : backups;
  const pool = categoryMatches.length > 0 ? categoryMatches : backups;

  return [...pool].sort((a, b) => {
    if (b.slaScore !== a.slaScore) return b.slaScore - a.slaScore;
    return a.leadTimeDays - b.leadTimeDays;
  })[0] ?? null;
}

export function buildRfqFallbackPlan(
  backupSupplier: SupplierRecord,
  material: FallbackMaterialInput,
  haltedDays: number,
  now = new Date(),
): RfqFallbackRecommendation {
  const adjustedSafetyStock = calculateSafetyStock({
    demandStdDev: material.demandStdDev,
    leadTimeDays: backupSupplier.leadTimeDays,
  });
  const adjustedReorderPoint = calculateReorderPoint({
    dailyDemandAvg: material.dailyDemandAvg,
    leadTimeDays: backupSupplier.leadTimeDays,
    safetyStock: adjustedSafetyStock,
  });

  // Cover halted duration + backup lead time buffer minus current stock
  const coverageWindowDays = Math.min(14, Math.max(backupSupplier.leadTimeDays, haltedDays));
  const targetNeed = Math.ceil(material.dailyDemandAvg * coverageWindowDays + adjustedSafetyStock);
  const recommendedQty = Math.max(100, targetNeed - Math.max(0, material.currentStock));

  const expectedDate = new Date(now.getTime() + backupSupplier.leadTimeDays * 86_400_000);

  return {
    backupSupplier,
    adjustedSafetyStock,
    adjustedReorderPoint,
    recommendedQty,
    expectedDate,
  };
}
