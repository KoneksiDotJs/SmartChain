import type { NextFunction, Request, Response } from 'express';

export interface AnomalyCheckInput {
  requestedQty: number;
  monthlyQuota: number;
  orderValue: number;
  creditLimit: number;
  usedCredit: number;
  depositConfirmed: boolean;
  demandSurgeActive?: boolean;
}

export interface AnomalyAssessment {
  isAnomaly: boolean;
  quotaRatio: number;
  thresholdRatio: number;
  exceedsQuota: boolean;
  exceedsCredit: boolean;
  reasons: string[];
}

export const ANOMALY_QUOTA_MULTIPLIER = 1.5;

/**
 * Pure domain rule shared between Anomaly Guard middleware and Orders service.
 * Prevents fictitious bulk orders (>150% historical monthly quota without deposit
 * or exceeding distributor credit limit) from locking scarce stock.
 */
export function evaluateOrderAnomaly(input: AnomalyCheckInput): AnomalyAssessment {
  const safeQuota = Math.max(1, input.monthlyQuota);
  const quotaRatio = Number((input.requestedQty / safeQuota).toFixed(2));
  const exceedsQuota = quotaRatio > ANOMALY_QUOTA_MULTIPLIER && !input.depositConfirmed;
  const exceedsCredit = input.usedCredit + input.orderValue > input.creditLimit;

  const reasons: string[] = [];
  if (exceedsQuota) {
    reasons.push(
      `Volume pesanan (${input.requestedQty} unit) mencapai ${Math.round(quotaRatio * 100)}% dari kuota historis (${input.monthlyQuota} unit) tanpa konfirmasi deposit.`,
    );
  }
  if (exceedsCredit) {
    reasons.push(
      `Nilai pesanan plus kredit terpakai (${(input.usedCredit + input.orderValue).toLocaleString('id-ID')}) melampaui batas kredit (${input.creditLimit.toLocaleString('id-ID')}).`,
    );
  }

  return {
    isAnomaly: exceedsQuota || exceedsCredit,
    quotaRatio,
    thresholdRatio: ANOMALY_QUOTA_MULTIPLIER,
    exceedsQuota,
    exceedsCredit,
    reasons,
  };
}

declare global {
  namespace Express {
    interface Request {
      anomalyContext?: {
        guardVersion: string;
        checkedAt: string;
        thresholdMultiplier: number;
      };
    }
  }
}

/**
 * Express middleware marking requests entering the Order Allocation boundary
 * so controllers/services enforce Anomaly Guard before locking inventory.
 */
export function anomalyGuardMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.anomalyContext = {
    guardVersion: 'v1.0-quota-credit',
    checkedAt: new Date().toISOString(),
    thresholdMultiplier: ANOMALY_QUOTA_MULTIPLIER,
  };
  next();
}
