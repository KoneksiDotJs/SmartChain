import {
  calculateReorderPoint,
  calculateSafetyStock,
  computeHybridWmaForecast,
  evaluateDistributionPerformance,
  evaluateSuppliersPerformance,
  type DataQualityStatus,
  type DemandPoint,
  type HybridWmaResult,
} from './analytics.domain.js';
import type { AnalyticsRepository } from './analytics.repository.js';

export interface MaterialForecastItem {
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
  historySeries: DemandPoint[];
  forecast: HybridWmaResult;
}

export interface ForecastOverviewResponse {
  demandSurgeMultiplier: number;
  overallDataQuality: DataQualityStatus;
  averageCompletenessPercent: number;
  materials: MaterialForecastItem[];
}

export function createAnalyticsService(repo: AnalyticsRepository) {
  return {
    async getForecastOverview(options?: {
      demandSurgeMultiplier?: number;
      leadTimeOverrideDays?: number;
    }): Promise<ForecastOverviewResponse> {
      const surge = Math.max(1, options?.demandSurgeMultiplier ?? 1);
      const rows = await repo.getMaterialsWithHistory();

      const materials: MaterialForecastItem[] = rows.map((row) => {
        const effectiveLeadTime = options?.leadTimeOverrideDays ?? row.leadTimeDays;
        const dynamicSafetyStock = calculateSafetyStock({
          demandStdDev: row.demandStdDev,
          leadTimeDays: effectiveLeadTime,
          demandSurgeMultiplier: surge,
        });
        const reorderPoint = calculateReorderPoint({
          dailyDemandAvg: row.dailyDemandAvg,
          leadTimeDays: effectiveLeadTime,
          safetyStock: dynamicSafetyStock,
          demandSurgeMultiplier: surge,
        });
        const forecast = computeHybridWmaForecast(row.demandHistory, {
          demandSurgeMultiplier: surge,
        });

        const needsProcurement = row.currentStock <= reorderPoint;
        const recommendedOrderQty = needsProcurement
          ? Math.max(0, reorderPoint + dynamicSafetyStock - row.currentStock)
          : 0;

        return {
          materialId: row.id,
          sku: row.sku,
          name: row.name,
          unit: row.unit,
          currentStock: row.currentStock,
          quarantineStock: row.quarantineStock,
          leadTimeDays: effectiveLeadTime,
          dynamicSafetyStock,
          reorderPoint,
          needsProcurement,
          recommendedOrderQty,
          historySeries: row.demandHistory,
          forecast,
        };
      });

      const averageCompletenessPercent =
        materials.length === 0
          ? 0
          : Number(
              (
                materials.reduce((sum, item) => sum + item.forecast.completenessPercent, 0) /
                materials.length
              ).toFixed(1),
            );

      const hasIncomplete = materials.some(
        (m) => m.forecast.qualityIndicator !== 'COMPLETE',
      );

      return {
        demandSurgeMultiplier: surge,
        overallDataQuality: hasIncomplete ? 'INCOMPLETE_DATA_WARNING' : 'COMPLETE',
        averageCompletenessPercent,
        materials,
      };
    },

    async getPerformanceEvaluation() {
      const { suppliers, corridors } = await repo.getPerformanceInputs();
      const supplierCards = evaluateSuppliersPerformance(suppliers);
      const distributionCorridors = evaluateDistributionPerformance(corridors);

      const avgSupplierScore =
        supplierCards.length === 0
          ? 0
          : Number(
              (
                supplierCards.reduce((sum, s) => sum + s.compositeScore, 0) /
                supplierCards.length
              ).toFixed(1),
            );

      return {
        avgSupplierScore,
        supplierCards,
        distributionCorridors,
      };
    },
  };
}
