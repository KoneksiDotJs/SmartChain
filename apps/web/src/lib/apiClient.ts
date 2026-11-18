import { DISTRIBUTOR_DIRECTORY, INITIAL_SUPPLIERS, getPartnerEmailForCode } from './mockSnapshot';
import type { QueuedRfidScan } from './offlineQueue';
import { DEMO_ACCOUNT_PRESETS } from './rbac';
import type {
  AuditEntryDto,
  AuthSession,
  AuthUserDto,
  ForecastMaterialDto,
  ManagedUserDto,
  PurchaseOrderDto,
  SalesOrderDto,
  ShipmentDto,
  SmartChainRole,
  SupplierDto,
  WarehouseStockDto,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SESSION_STORAGE_KEY = 'smartchain_auth_session';

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export function loadStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function requestJson<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string; status?: number }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!res.ok || !json.success || !json.data) {
      return {
        ok: false,
        status: res.status,
        message: json.error?.message ?? `Permintaan gagal (${res.status})`,
      };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'API backend tidak terjangkau (mode lokal terverifikasi)' };
  }
}

export async function authenticateWithPassword(
  email: string,
  password: string,
  expectedRole?: SmartChainRole,
): Promise<{ ok: true; session: AuthSession } | { ok: false; message: string }> {
  const apiRes = await requestJson<{ token: string; user: AuthUserDto }>(
    '/api/auth/login',
    null,
    {
      method: 'POST',
      body: JSON.stringify({ email, password, expectedRole }),
    },
  );

  if (apiRes.ok) {
    const session: AuthSession = {
      token: apiRes.data.token,
      user: apiRes.data.user,
      authMode: 'jwt-api',
    };
    saveStoredSession(session);
    return { ok: true, session };
  }

  // If the server explicitly rejected credentials (401/400), surface the real error
  if (apiRes.status && apiRes.status >= 400 && apiRes.status < 500) {
    return { ok: false, message: apiRes.message };
  }

  // When API backend is offline, validate credentials locally against registered demo & partner accounts
  const normalizedEmail = email.trim().toLowerCase();
  if (password !== 'smartchain123') {
    return { ok: false, message: 'Email atau kata sandi tidak valid' };
  }

  const matched = DEMO_ACCOUNT_PRESETS.find((p) => p.email.toLowerCase() === normalizedEmail);
  if (matched) {
    if (expectedRole && matched.role !== expectedRole) {
      return {
        ok: false,
        message: `Akun berstatus ${matched.role} tidak diizinkan masuk melalui portal login ${expectedRole}.`,
      };
    }
    const session: AuthSession = {
      token: `local-token-${matched.role.toLowerCase()}`,
      user: {
        id: `local-${matched.role.toLowerCase()}-${matched.entityCode ?? 'hq'}`,
        email: matched.email,
        name: matched.name,
        role: matched.role,
        entityCode: matched.entityCode,
      },
      authMode: 'local-verified',
    };
    saveStoredSession(session);
    return { ok: true, session };
  }

  const matchedSupplier = INITIAL_SUPPLIERS.find(
    (s) => getPartnerEmailForCode(s.code).toLowerCase() === normalizedEmail,
  );
  const matchedDistributor = DISTRIBUTOR_DIRECTORY.find(
    (d) => getPartnerEmailForCode(d.code).toLowerCase() === normalizedEmail,
  );
  const matchedPartner = matchedSupplier ?? matchedDistributor;

  if (!matchedPartner) {
    return { ok: false, message: 'Email atau kata sandi tidak valid' };
  }

  if (expectedRole && expectedRole !== 'PARTNER') {
    return {
      ok: false,
      message: `Akun Mitra (PARTNER) hanya dapat masuk melalui portal login Mitra (/login/mitra).`,
    };
  }

  const session: AuthSession = {
    token: `local-token-partner-${matchedPartner.code.toLowerCase()}`,
    user: {
      id: `local-partner-${matchedPartner.code.toLowerCase()}`,
      email: normalizedEmail,
      name: matchedPartner.name,
      role: 'PARTNER',
      entityCode: matchedPartner.code,
    },
    authMode: 'local-verified',
  };
  saveStoredSession(session);
  return { ok: true, session };
}

export const smartChainApi = {
  updateSupplierStatus(
    token: string | null,
    supplierCode: string,
    status: 'ACTIVE' | 'HALTED' | 'STANDBY',
    haltedDays: number,
  ) {
    return requestJson(`/api/srm/suppliers/${encodeURIComponent(supplierCode)}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status, haltedDays }),
    });
  },

  triggerRfqFallback(token: string | null, haltedSupplierIdOrCode = 'SUP-01') {
    return requestJson('/api/srm/rfq-fallback', token, {
      method: 'POST',
      body: JSON.stringify({ haltedSupplierIdOrCode, haltedDays: 14 }),
    });
  },

  createPo(
    token: string | null,
    payload: {
      supplierIdOrCode: string;
      materialIdOrSku: string;
      factoryIdOrCode: string;
      quantity: number;
      notes?: string;
    },
  ) {
    return requestJson('/api/po', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePoStatus(
    token: string | null,
    poId: string,
    status: 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED',
  ) {
    return requestJson(`/api/po/${encodeURIComponent(poId)}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  syncWmsBatch(token: string | null, items: QueuedRfidScan[]) {
    return requestJson('/api/wms/sync-batch', token, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  scanWmsTag(
    token: string | null,
    payload: {
      rawCode: string;
      warehouseCode?: string;
      direction: 'IN' | 'OUT' | 'CYCLE_COUNT';
      quantityOverride?: number;
      idempotencyKey: string;
    },
  ) {
    return requestJson('/api/wms/scan-tag', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  issueWmsLabel(
    token: string | null,
    payload: {
      labelType: 'BARCODE_CODE128' | 'RFID_SMARTTAG' | 'RFID_EPC';
      materialSku: string;
      warehouseCode: string;
      quantity: number;
      batchCode?: string;
    },
  ) {
    return requestJson('/api/wms/labels', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  reconcileWmsStock(token: string | null, stockId: string) {
    return requestJson('/api/wms/reconcile', token, {
      method: 'POST',
      body: JSON.stringify({ stockId }),
    });
  },

  validateOrder(
    token: string | null,
    payload: {
      orderIdOrNumber?: string;
      distributorIdOrCode?: string;
      materialIdOrSku?: string;
      requestedQty?: number;
      depositConfirmed?: boolean;
    },
  ) {
    return requestJson('/api/orders/validate', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  allocateSurge(token: string | null, materialId: string, availableStockOverride?: number) {
    return requestJson('/api/orders/allocate-surge', token, {
      method: 'POST',
      body: JSON.stringify({ materialId, availableStockOverride }),
    });
  },

  consolidateTms(token: string | null, transportSurgePercent: number) {
    return requestJson('/api/tms/consolidate', token, {
      method: 'POST',
      body: JSON.stringify({ transportSurgePercent }),
    });
  },

  createAdminUser(
    token: string | null,
    payload: {
      email: string;
      name: string;
      role: SmartChainRole;
      entityCode?: string;
      password: string;
    },
  ) {
    return requestJson<{ user: ManagedUserDto }>('/api/admin/users', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAdminUserAccess(
    token: string | null,
    userId: string,
    patch: { role?: SmartChainRole; entityCode?: string | null; isActive?: boolean },
  ) {
    return requestJson<{ user: ManagedUserDto }>(
      `/api/admin/users/${encodeURIComponent(userId)}/access`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    );
  },

  resetAdminUserPassword(token: string | null, userId: string, newPassword: string) {
    return requestJson<{ id: string; email: string }>(
      `/api/admin/users/${encodeURIComponent(userId)}/reset-password`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      },
    );
  },

  verifyCurrentSession(token: string) {
    return requestJson<{ user: AuthUserDto }>('/api/auth/me', token);
  },

  async fetchRoleWorkspaceData(session: AuthSession): Promise<{
    suppliers?: SupplierDto[];
    purchaseOrders?: PurchaseOrderDto[];
    warehouses?: WarehouseStockDto[];
    salesOrders?: SalesOrderDto[];
    shipments?: ShipmentDto[];
    forecasts?: ForecastMaterialDto[];
    auditLogs?: AuditEntryDto[];
    managedUsers?: ManagedUserDto[];
  }> {
    if (session.authMode !== 'jwt-api') return {};
    const { token, user } = session;
    const role = user.role;
    const isSupplierPartner = role === 'PARTNER' && (user.entityCode?.startsWith('SUP-') ?? false);
    const isDistPartner = role === 'PARTNER' && !isSupplierPartner;

    const results: {
      suppliers?: SupplierDto[];
      purchaseOrders?: PurchaseOrderDto[];
      warehouses?: WarehouseStockDto[];
      salesOrders?: SalesOrderDto[];
      shipments?: ShipmentDto[];
      forecasts?: ForecastMaterialDto[];
      auditLogs?: AuditEntryDto[];
      managedUsers?: ManagedUserDto[];
    } = {};

    const tasks: Promise<void>[] = [];

    if (role === 'SYSTEM_ADMIN') {
      tasks.push(
        requestJson<{ users: ManagedUserDto[] }>('/api/admin/users', token).then((r) => {
          if (r.ok) results.managedUsers = r.data.users;
        }),
      );
    }

    if (role === 'DIREKSI' || role === 'PROCUREMENT_MANAGER') {
      tasks.push(
        requestJson<{ suppliers: SupplierDto[] }>('/api/srm/suppliers', token).then((r) => {
          if (r.ok) results.suppliers = r.data.suppliers;
        }),
      );
    }

    if (role === 'DIREKSI' || role === 'PROCUREMENT_MANAGER' || isSupplierPartner) {
      tasks.push(
        requestJson<{ orders: PurchaseOrderDto[] }>('/api/po', token).then((r) => {
          if (r.ok) results.purchaseOrders = r.data.orders;
        }),
      );
    }

    if (role === 'DIREKSI' || role === 'WAREHOUSE_OPERATOR') {
      tasks.push(
        requestJson<{ stocks: WarehouseStockDto[] }>('/api/wms/overview', token).then((r) => {
          if (r.ok) results.warehouses = r.data.stocks;
        }),
      );
    }

    if (role === 'DIREKSI' || role === 'LOGISTICS_MANAGER' || isDistPartner) {
      tasks.push(
        requestJson<{ orders: SalesOrderDto[] }>('/api/orders', token).then((r) => {
          if (r.ok) results.salesOrders = r.data.orders;
        }),
      );
      tasks.push(
        requestJson<{ shipments: ShipmentDto[] }>('/api/tms/shipments', token).then((r) => {
          if (r.ok) results.shipments = r.data.shipments;
        }),
      );
    }

    if (role === 'DIREKSI' || role === 'PROCUREMENT_MANAGER' || role === 'LOGISTICS_MANAGER') {
      tasks.push(
        requestJson<{ materials: ForecastMaterialDto[] }>('/api/analytics/forecast', token).then(
          (r) => {
            if (r.ok) results.forecasts = r.data.materials;
          },
        ),
      );
    }

    if (role !== 'PARTNER') {
      tasks.push(
        requestJson<{ logs: AuditEntryDto[] }>('/api/dashboard/audit-logs?limit=40', token).then(
          (r) => {
            if (r.ok) results.auditLogs = r.data.logs;
          },
        ),
      );
    }

    await Promise.all(tasks);
    return results;
  },
};
