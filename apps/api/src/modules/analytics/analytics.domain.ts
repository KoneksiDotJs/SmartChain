export interface DemandPoint {
  periodLabel: string;
  periodIndex: number;
  observedQty: number | null;
  isMissing: boolean;
}

export type DataQualityStatus = 'COMPLETE' | 'INCOMPLETE_DATA_WARNING' | 'INSUFFICIENT_DATA';
export type ForecastMethod = 'STANDARD_FORECAST' | 'HYBRID_WMA';

export interface HybridWmaResult {
  forecastNextPeriod: number;
  completenessPercent: number;
  validIntervals: number;
  totalIntervals: number;
  missingPeriods: string[];
  qualityIndicator: DataQualityStatus;
  methodUsed: ForecastMethod;
  advisoryNote: string;
}

export interface SafetyStockParams {
  demandStdDev: number;
  leadTimeDays: number;
  zScore?: number;
  demandSurgeMultiplier?: number;
}

export interface ReorderPointParams {
  dailyDemandAvg: number;
  leadTimeDays: number;
  safetyStock: number;
  demandSurgeMultiplier?: number;
}

/**
 * Dynamic Safety Stock formula: SS = ceil(Z * sigma_d * sqrt(L) * surgeFactor).
 * Adapts to both supplier lead-time shifts (14-day fallback) and +300% demand surges.
 */
export function calculateSafetyStock(params: SafetyStockParams): number {
  const zScore = params.zScore ?? 1.65; // ~95% service level
  const surge = Math.max(1, params.demandSurgeMultiplier ?? 1);
  const leadTime = Math.max(1, params.leadTimeDays);
  return Math.ceil(zScore * Math.max(0, params.demandStdDev) * Math.sqrt(leadTime) * surge);
}

/**
 * Reorder Point formula: ROP = ceil(avgDailyDemand * surgeFactor * leadTimeDays + safetyStock).
 */
export function calculateReorderPoint(params: ReorderPointParams): number {
  const surge = Math.max(1, params.demandSurgeMultiplier ?? 1);
  const leadTime = Math.max(1, params.leadTimeDays);
  return Math.ceil(Math.max(0, params.dailyDemandAvg) * surge * leadTime + params.safetyStock);
}

/**
 * Hybrid Weighted Moving Average (WMA) tolerant to incomplete 3-month historical data.
 * Assigns increasing weights to recent valid intervals and renormalizes weights over
 * non-null observations while flagging data completeness warnings.
 */
export function computeHybridWmaForecast(
  history: DemandPoint[],
  options?: { demandSurgeMultiplier?: number },
): HybridWmaResult {
  const sorted = [...history].sort((a, b) => a.periodIndex - b.periodIndex);
  const totalIntervals = sorted.length;
  const missingPeriods: string[] = [];

  let weightedSum = 0;
  let totalWeight = 0;
  let validIntervals = 0;

  sorted.forEach((point, idx) => {
    if (point.observedQty === null || point.isMissing || Number.isNaN(point.observedQty)) {
      missingPeriods.push(point.periodLabel);
      return;
    }

    const weight = idx + 1;
    weightedSum += point.observedQty * weight;
    totalWeight += weight;
    validIntervals += 1;
  });

  const completenessPercent =
    totalIntervals === 0 ? 0 : Number(((validIntervals / totalIntervals) * 100).toFixed(1));
  const surge = Math.max(1, options?.demandSurgeMultiplier ?? 1);
  const baseForecast = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const forecastNextPeriod = Math.round(baseForecast * surge);

  let qualityIndicator: DataQualityStatus = 'COMPLETE';
  let methodUsed: ForecastMethod = 'STANDARD_FORECAST';
  let advisoryNote = 'Data historis lengkap; proyeksi permintaan standar aktif.';

  if (validIntervals === 0) {
    qualityIndicator = 'INSUFFICIENT_DATA';
    methodUsed = 'HYBRID_WMA';
    advisoryNote = 'Data historis kosong; diperlukan input manual baseline sebelum pelatihan model AI.';
  } else if (completenessPercent < 95) {
    qualityIndicator = 'INCOMPLETE_DATA_WARNING';
    methodUsed = 'HYBRID_WMA';
    advisoryNote = `Kelengkapan data ${completenessPercent}% (${missingPeriods.length} interval hilang: ${missingPeriods.join(', ')}). Menggunakan Weighted Moving Average (WMA) hibrida untuk mencegah bias model AI kompleks.`;
  }

  return {
    forecastNextPeriod,
    completenessPercent,
    validIntervals,
    totalIntervals,
    missingPeriods,
    qualityIndicator,
    methodUsed,
    advisoryNote,
  };
}

export interface SupplierEvaluationInput {
  code: string;
  name: string;
  tierType: 'MAIN' | 'BACKUP';
  slaScore: number;
  leadTimeDays: number;
  status: 'ACTIVE' | 'HALTED' | 'STANDBY';
  haltedDays: number;
  materialCategory: string;
  poCount: number;
}

export interface SupplierPerformanceCard {
  code: string;
  name: string;
  tierType: 'MAIN' | 'BACKUP';
  materialCategory: string;
  slaScore: number;
  leadTimeDays: number;
  onTimeRate: number;
  compositeScore: number;
  grade: 'A' | 'B' | 'C';
  status: string;
  poCount: number;
}

export interface DistributionEvaluationInput {
  routeGroup: string;
  distributorsCount: number;
  totalOrders: number;
  heldAnomalies: number;
  requestedUnits: number;
  allocatedUnits: number;
  baseShippingCost: number;
  effectiveShippingCost: number;
  consolidatedCount: number;
}

export interface DistributionCorridorCard {
  routeGroup: string;
  distributorsCount: number;
  totalOrders: number;
  heldAnomalies: number;
  fulfillmentRatePercent: number;
  costSavingsPercent: number;
  effectiveShippingCost: number;
  consolidatedRatePercent: number;
}

export function evaluateSuppliersPerformance(
  suppliers: SupplierEvaluationInput[],
): SupplierPerformanceCard[] {
  return suppliers.map((s) => {
    const onTimeRate =
      s.status === 'HALTED' ? Math.max(40, Math.round(s.slaScore - s.haltedDays * 2.5)) : s.slaScore;
    const leadTimeEfficiency = Math.max(60, 100 - (s.leadTimeDays - 2) * 8);
    const compositeScore = Number(
      (s.slaScore * 0.55 + onTimeRate * 0.3 + leadTimeEfficiency * 0.15).toFixed(1),
    );
    const grade: 'A' | 'B' | 'C' =
      compositeScore >= 92 ? 'A' : compositeScore >= 84 ? 'B' : 'C';

    return {
      code: s.code,
      name: s.name,
      tierType: s.tierType,
      materialCategory: s.materialCategory,
      slaScore: s.slaScore,
      leadTimeDays: s.leadTimeDays,
      onTimeRate,
      compositeScore,
      grade,
      status: s.status,
      poCount: s.poCount,
    };
  });
}

export function evaluateDistributionPerformance(
  corridors: DistributionEvaluationInput[],
): DistributionCorridorCard[] {
  return corridors.map((c) => {
    const fulfillmentRatePercent =
      c.requestedUnits <= 0
        ? 100
        : Number(((c.allocatedUnits / c.requestedUnits) * 100).toFixed(1));
    const costSavingsPercent =
      c.baseShippingCost <= 0
        ? 0
        : Number(
            (
              (Math.max(0, c.baseShippingCost - c.effectiveShippingCost) / c.baseShippingCost) *
              100
            ).toFixed(1),
          );
    const consolidatedRatePercent =
      c.totalOrders <= 0
        ? 0
        : Number(((c.consolidatedCount / c.totalOrders) * 100).toFixed(1));

    return {
      routeGroup: c.routeGroup,
      distributorsCount: c.distributorsCount,
      totalOrders: c.totalOrders,
      heldAnomalies: c.heldAnomalies,
      fulfillmentRatePercent,
      costSavingsPercent,
      effectiveShippingCost: c.effectiveShippingCost,
      consolidatedRatePercent,
    };
  });
}
