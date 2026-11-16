import type { SmartChainRole } from './types';
import type { QueuedRfidScan } from './offlineQueue';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

let cachedToken: string | null = null;

async function ensureDemoToken(role: SmartChainRole): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/demo-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<{ token: string }>;
    cachedToken = json.data?.token ?? null;
    return cachedToken;
  } catch {
    return null;
  }
}

async function requestJson<T>(
  path: string,
  role: SmartChainRole,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const token = cachedToken ?? (await ensureDemoToken(role));
    if (!token) {
      return { ok: false, message: 'API backend tidak terjangkau (mode simulasi lokal aktif)' };
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!res.ok || !json.success || !json.data) {
      return {
        ok: false,
        message: json.error?.message ?? `Permintaan gagal (${res.status})`,
      };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'API backend tidak terjangkau (mode simulasi lokal aktif)' };
  }
}

export const smartChainApi = {
  async switchRole(role: SmartChainRole): Promise<void> {
    cachedToken = null;
    await ensureDemoToken(role);
  },

  triggerRfqFallback(role: SmartChainRole, haltedSupplierIdOrCode = 'SUP-01') {
    return requestJson<{ rfqOrder: { poNumber: string; quantity: number }; backupSupplier: { code: string; name: string } }>(
      '/api/srm/rfq-fallback',
      role,
      {
        method: 'POST',
        body: JSON.stringify({ haltedSupplierIdOrCode, haltedDays: 14 }),
      },
    );
  },

  syncWmsBatch(role: SmartChainRole, items: QueuedRfidScan[]) {
    return requestJson<{ appliedCount: number; skippedDuplicateKeys: string[] }>(
      '/api/wms/sync-batch',
      role,
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    );
  },

  reconcileWmsStock(role: SmartChainRole, stockId: string) {
    return requestJson<{ discrepancyQty: number; newQuarantineQty: number }>(
      '/api/wms/reconcile',
      role,
      {
        method: 'POST',
        body: JSON.stringify({ stockId }),
      },
    );
  },

  validateOrder(role: SmartChainRole, orderIdOrNumber: string) {
    return requestJson<{ assessment: { isAnomaly: boolean; quotaRatio: number } }>(
      '/api/orders/validate',
      role,
      {
        method: 'POST',
        body: JSON.stringify({ orderIdOrNumber }),
      },
    );
  },

  consolidateTms(role: SmartChainRole, transportSurgePercent: number) {
    return requestJson<{ totalSavingsPercent: number; totalConsolidatedCost: number }>(
      '/api/tms/consolidate',
      role,
      {
        method: 'POST',
        body: JSON.stringify({ transportSurgePercent }),
      },
    );
  },
};
