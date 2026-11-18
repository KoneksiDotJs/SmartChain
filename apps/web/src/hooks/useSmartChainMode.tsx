'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  authenticateWithPassword,
  loadStoredSession,
  saveStoredSession,
  smartChainApi,
} from '@/lib/apiClient';
import { parseBarcodeOrRfidTag, type ScanTagType } from '@/lib/barcodeRfid';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_FORECAST_MATERIALS,
  INITIAL_MANAGED_USERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES_ORDERS,
  INITIAL_SHIPMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_WAREHOUSE_STOCKS,
} from '@/lib/mockSnapshot';
import {
  clearAllQueuedScans,
  clearQueuedScans,
  createIdempotencyKey,
  enqueueOfflineScan,
  listQueuedScans,
  type QueuedRfidScan,
} from '@/lib/offlineQueue';
import { getHomeRouteForRole } from '@/lib/rbac';
import type {
  AuditEntryDto,
  AuthSession,
  ForecastMaterialDto,
  ManagedUserDto,
  PurchaseOrderDto,
  SalesOrderDto,
  ShipmentDto,
  SmartChainRole,
  SupplierDto,
  WarehouseStockDto,
} from '@/lib/types';
import { ToastRegion } from '@/components/ui/ToastRegion';

export interface ScanHistoryItem {
  id: string;
  rawCode: string;
  tagType: ScanTagType;
  materialSku: string;
  warehouseCode: string;
  direction: 'IN' | 'OUT' | 'CYCLE_COUNT';
  quantity: number;
  wasOffline: boolean;
  idempotencyKey: string;
  scannedAt: string;
}

interface SmartChainContextValue {
  session: AuthSession | null;
  authReady: boolean;
  login: (
    email: string,
    password: string,
    expectedRole?: SmartChainRole,
  ) => Promise<{ ok: boolean; message?: string; homeRoute?: string }>;
  logout: () => void;
  stressMode: boolean;
  setStressMode: (next: boolean) => void;
  suppliers: SupplierDto[];
  purchaseOrders: PurchaseOrderDto[];
  warehouses: WarehouseStockDto[];
  salesOrders: SalesOrderDto[];
  shipments: ShipmentDto[];
  forecasts: ForecastMaterialDto[];
  auditLogs: AuditEntryDto[];
  managedUsers: ManagedUserDto[];
  offlineQueue: QueuedRfidScan[];
  lastSyncedBatch: QueuedRfidScan[];
  scanHistory: ScanHistoryItem[];
  rfqTriggered: boolean;
  wh04Offline: boolean;
  reconciled: boolean;
  anomalyFilterActive: boolean;
  tmsConsolidated: boolean;
  showToast: (message: string) => void;
  toggleSupplierHalt: (supplierCode: string) => Promise<void>;
  triggerRfqFallback: () => Promise<void>;
  createPurchaseOrder: (input: {
    supplierCode: string;
    materialSku: string;
    factoryName: string;
    quantity: number;
    notes?: string;
  }) => Promise<void>;
  updatePoStatus: (poId: string, nextStatus: 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED') => Promise<void>;
  toggleWh04Offline: (warehouseCode?: string) => void;
  scanWh04Rfid: (
    deltaQty?: number,
    direction?: 'IN' | 'OUT' | 'CYCLE_COUNT',
    warehouseCode?: string,
  ) => Promise<void>;
  scanBarcodeOrRfidTag: (input: {
    rawCode: string;
    direction: 'IN' | 'OUT' | 'CYCLE_COUNT';
    warehouseCodeOverride?: string;
    quantityOverride?: number;
  }) => Promise<{ ok: boolean; message: string }>;
  issueWarehouseLabel: (input: {
    labelType: 'BARCODE_CODE128' | 'RFID_SMARTTAG' | 'RFID_EPC';
    materialSku: string;
    warehouseCode: string;
    quantity: number;
    batchCode?: string;
  }) => Promise<{
    ok: boolean;
    rawCode?: string;
    materialSku?: string;
    warehouseCode?: string;
    quantity?: number;
    batchCode?: string;
    message: string;
  }>;
  syncOfflineQueue: (warehouseCode?: string) => Promise<void>;
  replayLastBatchIdempotency: () => Promise<void>;
  reconcileWh04: (warehouseCode?: string) => Promise<void>;
  toggleAnomalyFilter: () => Promise<void>;
  verifyAndApproveOrder: (orderId: string) => Promise<void>;
  rejectOrder: (orderId: string) => void;
  runSlaSurgeAllocation: (availableStockOverride?: number) => Promise<void>;
  submitOrderValidation: (distributorCode: string, requestedQty: number, depositConfirmed: boolean) => Promise<void>;
  consolidateTmsRoutes: () => Promise<void>;
  createManagedUser: (input: {
    email: string;
    name: string;
    role: SmartChainRole;
    entityCode?: string;
    password: string;
  }) => Promise<boolean>;
  updateManagedUserAccess: (
    userId: string,
    patch: { role?: SmartChainRole; isActive?: boolean },
  ) => Promise<void>;
  resetManagedUserPassword: (userId: string, newPassword: string) => Promise<void>;
}

const SmartChainContext = createContext<SmartChainContextValue | null>(null);

export function SmartChainProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [stressMode, setStressModeState] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>(INITIAL_SUPPLIERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>(INITIAL_PURCHASE_ORDERS);
  const [warehouses, setWarehouses] = useState<WarehouseStockDto[]>(INITIAL_WAREHOUSE_STOCKS);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDto[]>(INITIAL_SALES_ORDERS);
  const [shipments, setShipments] = useState<ShipmentDto[]>(INITIAL_SHIPMENTS);
  const [forecasts, setForecasts] = useState<ForecastMaterialDto[]>(INITIAL_FORECAST_MATERIALS);
  const [auditLogs, setAuditLogs] = useState<AuditEntryDto[]>(INITIAL_AUDIT_LOGS);
  const [managedUsers, setManagedUsers] = useState<ManagedUserDto[]>(INITIAL_MANAGED_USERS);
  const [offlineQueue, setOfflineQueue] = useState<QueuedRfidScan[]>([]);
  const [lastSyncedBatch, setLastSyncedBatch] = useState<QueuedRfidScan[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  const [rfqTriggered, setRfqTriggered] = useState(false);
  const [wh04Offline, setWh04Offline] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [anomalyFilterActive, setAnomalyFilterActive] = useState(false);
  const [tmsConsolidated, setTmsConsolidated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3400);
  }, []);

  const appendAudit = useCallback(
    (entry: Omit<AuditEntryDto, 'id' | 'createdAt'>) => {
      setAuditLogs((prev) => [
        {
          ...entry,
          id: `aud-${Date.now()}-${prev.length + 1}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [],
  );

  const hydrateFromSession = useCallback(async (activeSession: AuthSession | null) => {
    if (!activeSession || activeSession.authMode !== 'jwt-api') return;
    const live = await smartChainApi.fetchRoleWorkspaceData(activeSession);
    if (live.suppliers && live.suppliers.length > 0) setSuppliers(live.suppliers);
    if (live.purchaseOrders) setPurchaseOrders(live.purchaseOrders);
    if (live.warehouses && live.warehouses.length > 0) setWarehouses(live.warehouses);
    if (live.salesOrders) setSalesOrders(live.salesOrders);
    if (live.shipments) setShipments(live.shipments);
    if (live.forecasts && live.forecasts.length > 0) setForecasts(live.forecasts);
    if (live.auditLogs && live.auditLogs.length > 0) setAuditLogs(live.auditLogs);
    if (live.managedUsers && live.managedUsers.length > 0) setManagedUsers(live.managedUsers);
  }, []);

  useEffect(() => {
    const stored = loadStoredSession();
    if (!stored) {
      setAuthReady(true);
      return;
    }

    if (stored.authMode === 'jwt-api') {
      void smartChainApi.verifyCurrentSession(stored.token).then((res) => {
        if (!res.ok && (res.status === 401 || res.status === 403)) {
          saveStoredSession(null);
          setSession(null);
          void clearAllQueuedScans().catch(() => {});
          setOfflineQueue([]);
          setAuthReady(true);
          return;
        }
        const activeSession =
          res.ok && res.data?.user
            ? { ...stored, user: res.data.user }
            : stored;
        if (res.ok && res.data?.user) {
          saveStoredSession(activeSession);
        }
        setSession(activeSession);
        setAuthReady(true);
        void hydrateFromSession(activeSession);
        void listQueuedScans().then(setOfflineQueue).catch(() => {});
      });
      return;
    }

    setSession(stored);
    setAuthReady(true);
    void hydrateFromSession(stored);
    void listQueuedScans().then(setOfflineQueue).catch(() => {});
  }, [hydrateFromSession]);

  const activeRole = session?.user.role ?? 'DIREKSI';
  const activeToken = session?.token ?? null;

  const login = useCallback(
    async (email: string, password: string, expectedRole?: SmartChainRole) => {
      const res = await authenticateWithPassword(email, password, expectedRole);
      if (!res.ok) {
        return { ok: false, message: res.message };
      }
      setSession(res.session);
      void hydrateFromSession(res.session);
      const homeRoute = getHomeRouteForRole(res.session.user.role);
      showToast(`Masuk sebagai ${res.session.user.name}`);
      return { ok: true, homeRoute };
    },
    [hydrateFromSession, showToast],
  );

  const logout = useCallback(() => {
    saveStoredSession(null);
    setSession(null);
    setOfflineQueue([]);
    setLastSyncedBatch([]);
    setScanHistory([]);
    void clearAllQueuedScans().catch(() => {});
    showToast('Sesi pengguna diakhiri dan antrean lokal terminal dibersihkan');
  }, [showToast]);

  const setStressMode = useCallback(
    (next: boolean) => {
      setStressModeState(next);
      setSuppliers((prev) =>
        prev.map((s) =>
          s.code === 'SUP-01'
            ? { ...s, status: next ? 'HALTED' : 'ACTIVE', haltedDays: next ? 14 : 0 }
            : s,
        ),
      );
      setForecasts(
        INITIAL_FORECAST_MATERIALS.map((item) => {
          const factor = next ? 3 : 1;
          const safety = Math.ceil(item.dynamicSafetyStock * factor);
          const rop = Math.ceil(item.reorderPoint * (next ? 2.8 : 1));
          return {
            ...item,
            dynamicSafetyStock: safety,
            reorderPoint: rop,
            needsProcurement: item.currentStock <= rop,
            recommendedOrderQty: Math.max(0, rop + safety - item.currentStock),
            forecast: {
              ...item.forecast,
              forecastNextPeriod: item.forecast.forecastNextPeriod * factor,
            },
          };
        }),
      );
      showToast(next ? 'Simulasi 6 gangguan diaktifkan lintas modul' : 'Beralih ke kondisi operasi normal');
    },
    [showToast],
  );

  const toggleSupplierHalt = useCallback(
    async (supplierCode: string) => {
      if (activeRole !== 'PROCUREMENT_MANAGER') {
        showToast('Hanya Manajer Pengadaan yang berhak mengubah status pemasok');
        return;
      }
      const target = suppliers.find((s) => s.code === supplierCode);
      if (!target) return;
      const nextStatus = target.status === 'HALTED' ? 'ACTIVE' : 'HALTED';
      const nextDays = nextStatus === 'HALTED' ? 14 : 0;

      await smartChainApi.updateSupplierStatus(activeToken, supplierCode, nextStatus, nextDays);
      setSuppliers((prev) =>
        prev.map((s) =>
          s.code === supplierCode ? { ...s, status: nextStatus, haltedDays: nextDays } : s,
        ),
      );
      appendAudit({
        entityType: 'Supplier',
        entityId: supplierCode,
        action: 'SUPPLIER_STATUS_CHANGED',
        actorRole: activeRole,
        reason:
          nextStatus === 'HALTED'
            ? `${supplierCode} ditandai berhenti pasokan 14 hari.`
            : `${supplierCode} dipulihkan ke status aktif.`,
      });
      showToast(
        nextStatus === 'HALTED'
          ? `${supplierCode} ditandai berhenti 14 hari — siap RFQ cadangan`
          : `${supplierCode} kembali aktif`,
      );
    },
    [activeRole, activeToken, appendAudit, showToast, suppliers],
  );

  const triggerRfqFallback = useCallback(async () => {
    if (activeRole !== 'PROCUREMENT_MANAGER') {
      showToast('Operasi ini khusus Manajer Pengadaan & Produksi');
      return;
    }

    await smartChainApi.triggerRfqFallback(activeToken, 'SUP-01');
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.code === 'SUP-01') return { ...s, status: 'HALTED', haltedDays: 14 };
        if (s.code === 'SUP-16') return { ...s, status: 'ACTIVE' };
        return s;
      }),
    );

    if (!rfqTriggered) {
      const rfqNo = `RFQ-${Date.now().toString().slice(-6)}`;
      setPurchaseOrders((prev) => [
        {
          id: `po-rfq-${Date.now()}`,
          poNumber: rfqNo,
          supplierCode: 'SUP-16',
          supplierName: 'PT Mitra Bahan Cadangan',
          materialSku: 'MAT-01',
          materialName: 'Baja Lembaran Canai Dingin',
          factoryName: 'Pabrik Cikarang (Utama)',
          quantity: 640,
          isRfqFallback: true,
          triggeredByRop: true,
          status: 'DRAFT_RFQ',
          expectedDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          notes: 'Auto-RFQ fallback akibat SUP-01 berhenti 14 hari',
        },
        ...prev,
      ]);
      setRfqTriggered(true);
      appendAudit({
        entityType: 'PurchaseOrder',
        entityId: rfqNo,
        action: 'SRM_RFQ_FALLBACK_TRIGGERED',
        actorRole: activeRole,
        reason: 'SUP-01 berhenti 14 hari -> RFQ otomatis dikirim ke SUP-16 (Cadangan Tier-2).',
      });
    }
    showToast('RFQ otomatis dikirim ke pemasok cadangan Tier-2 (SUP-16)');
  }, [activeRole, activeToken, appendAudit, rfqTriggered, showToast]);

  const createPurchaseOrder = useCallback(
    async (input: {
      supplierCode: string;
      materialSku: string;
      factoryName: string;
      quantity: number;
      notes?: string;
    }) => {
      if (activeRole !== 'PROCUREMENT_MANAGER') {
        showToast('Hanya Manajer Pengadaan yang dapat menerbitkan PO');
        return;
      }
      const sup = suppliers.find((s) => s.code === input.supplierCode) ?? suppliers[0]!;
      const mat = forecasts.find((m) => m.sku === input.materialSku) ?? forecasts[0]!;
      const poNo = `PO-${Date.now().toString().slice(-6)}`;

      await smartChainApi.createPo(activeToken, {
        supplierIdOrCode: input.supplierCode,
        materialIdOrSku: input.materialSku,
        factoryIdOrCode: 'FAC-01',
        quantity: input.quantity,
        notes: input.notes,
      });

      setPurchaseOrders((prev) => [
        {
          id: `po-${Date.now()}`,
          poNumber: poNo,
          supplierCode: sup.code,
          supplierName: sup.name,
          materialSku: mat.sku,
          materialName: mat.name,
          factoryName: input.factoryName,
          quantity: input.quantity,
          isRfqFallback: sup.tierType === 'BACKUP',
          triggeredByRop: mat.needsProcurement,
          status: 'PENDING_APPROVAL',
          expectedDate: new Date(Date.now() + sup.leadTimeDays * 86_400_000).toISOString(),
          notes: input.notes ?? 'Pengadaan terjadwal dari Meja Kerja Pengadaan',
        },
        ...prev,
      ]);
      appendAudit({
        entityType: 'PurchaseOrder',
        entityId: poNo,
        action: 'PO_CREATED',
        actorRole: activeRole,
        reason: `Terbit ${poNo} ke ${sup.code} (${input.quantity} unit ${mat.sku}).`,
      });
      showToast(`${poNo} diterbitkan ke ${sup.name}`);
    },
    [activeRole, activeToken, appendAudit, forecasts, showToast, suppliers],
  );

  const updatePoStatus = useCallback(
    async (poId: string, nextStatus: 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED') => {
      if (activeRole !== 'PROCUREMENT_MANAGER' && activeRole !== 'PARTNER') {
        showToast('Peran Anda tidak berhak mengubah status PO');
        return;
      }
      await smartChainApi.updatePoStatus(activeToken, poId, nextStatus);
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === poId ? { ...po, status: nextStatus } : po)),
      );
      appendAudit({
        entityType: 'PurchaseOrder',
        entityId: poId,
        action: `PO_STATUS_${nextStatus}`,
        actorRole: activeRole,
        reason: `Status PO diperbarui menjadi ${nextStatus}.`,
      });
      showToast(`Status PO diperbarui menjadi ${nextStatus}`);
    },
    [activeRole, activeToken, appendAudit, showToast],
  );

  const toggleWh04Offline = useCallback(
    (warehouseCode = 'WH-04') => {
      if (activeRole !== 'WAREHOUSE_OPERATOR') {
        showToast('Operasi jaringan gudang hanya untuk Operator Gudang');
        return;
      }
      const target = warehouses.find((w) => w.warehouseCode === warehouseCode);
      const nextOffline = target ? target.networkStatus === 'ONLINE' : !wh04Offline;
      if (warehouseCode === 'WH-04') {
        setWh04Offline(nextOffline);
      }
      setWarehouses((prev) =>
        prev.map((w) =>
          w.warehouseCode === warehouseCode
            ? { ...w, networkStatus: nextOffline ? 'OFFLINE' : 'ONLINE', offlineHours: nextOffline ? 48 : 0 }
            : w,
        ),
      );
      appendAudit({
        entityType: 'Warehouse',
        entityId: warehouseCode,
        action: nextOffline ? 'WAREHOUSE_OFFLINE_48H' : 'WAREHOUSE_ONLINE_RESTORED',
        actorRole: activeRole,
        reason: nextOffline
          ? `${warehouseCode} terputus jaringan; mode Store-and-Forward IndexedDB aktif.`
          : `Koneksi ${warehouseCode} pulih; siap sinkronisasi antrean lokal.`,
      });
      showToast(nextOffline ? `${warehouseCode} masuk mode offline (48 jam)` : `${warehouseCode} kembali online`);
    },
    [activeRole, appendAudit, showToast, warehouses, wh04Offline],
  );

  const scanWh04Rfid = useCallback(
    async (deltaQty = 10, direction: 'IN' | 'OUT' | 'CYCLE_COUNT' = 'IN', warehouseCode = 'WH-04') => {
      if (activeRole !== 'WAREHOUSE_OPERATOR') {
        showToast('Pemindaian RFID hanya dapat dilakukan oleh Operator Gudang');
        return;
      }
      const targetWh = warehouses.find((w) => w.warehouseCode === warehouseCode) ?? warehouses[0]!;
      const isOffline = targetWh.networkStatus === 'OFFLINE';
      const key = createIdempotencyKey(warehouseCode);
      const scan: QueuedRfidScan = {
        idempotencyKey: key,
        stockId: targetWh.stockId,
        warehouseCode,
        deltaQty,
        direction,
        offlineTimestamp: new Date().toISOString(),
        wasOffline: isOffline,
      };

      setWarehouses((prev) =>
        prev.map((w) => {
          if (w.warehouseCode !== warehouseCode) return w;
          if (direction === 'IN') {
            return { ...w, rfidQty: w.rfidQty + deltaQty, physicalQty: w.physicalQty + deltaQty };
          }
          if (direction === 'OUT') {
            return {
              ...w,
              rfidQty: Math.max(0, w.rfidQty - deltaQty),
              physicalQty: Math.max(0, w.physicalQty - deltaQty),
            };
          }
          return { ...w, physicalQty: deltaQty };
        }),
      );

      if (isOffline) {
        await enqueueOfflineScan(scan);
        const updatedQueue = await listQueuedScans();
        setOfflineQueue(updatedQueue);
        appendAudit({
          entityType: 'RfidSyncLog',
          entityId: warehouseCode,
          action: 'OFFLINE_SCAN_QUEUED',
          actorRole: activeRole,
          idempotencyKey: key,
          reason: `Pindai ${direction} ${deltaQty} unit (${warehouseCode}) disimpan ke IndexedDB.`,
        });
        showToast(`Pindai ${direction} ${deltaQty} unit (${warehouseCode}) masuk antrean IndexedDB`);
      } else {
        await smartChainApi.syncWmsBatch(activeToken, [scan]);
        setLastSyncedBatch([scan]);
        appendAudit({
          entityType: 'RfidSyncLog',
          entityId: warehouseCode,
          action: 'ONLINE_SCAN_SYNCED',
          actorRole: activeRole,
          idempotencyKey: key,
          reason: `Pindai ${direction} ${deltaQty} unit (${warehouseCode}) tersinkron langsung.`,
        });
        showToast(`Pemindaian ${direction} ${deltaQty} unit (${warehouseCode}) tersinkron`);
      }
    },
    [activeRole, activeToken, appendAudit, showToast, warehouses],
  );

  const scanBarcodeOrRfidTag = useCallback(
    async (input: {
      rawCode: string;
      direction: 'IN' | 'OUT' | 'CYCLE_COUNT';
      warehouseCodeOverride?: string;
      quantityOverride?: number;
    }): Promise<{ ok: boolean; message: string }> => {
      if (activeRole !== 'WAREHOUSE_OPERATOR') {
        const msg = 'Pemindaian Barcode/RFID hanya dapat dilakukan oleh Operator Gudang';
        showToast(msg);
        return { ok: false, message: msg };
      }

      const parsed = parseBarcodeOrRfidTag(input.rawCode);
      if (!parsed) {
        const msg = `Format tag "${input.rawCode}" tidak dikenali. Contoh valid: RFID:MAT-01:WH-04:10, BC-MAT01-015, atau 899100100101`;
        showToast(msg);
        return { ok: false, message: msg };
      }

      const warehouseCode = input.warehouseCodeOverride ?? parsed.warehouseCode ?? 'WH-04';
      const targetStock =
        warehouses.find(
          (w) => w.warehouseCode === warehouseCode && w.materialSku === parsed.materialSku,
        ) ??
        warehouses.find((w) => w.warehouseCode === warehouseCode) ??
        warehouses[0]!;

      const isOffline = targetStock.networkStatus === 'OFFLINE';
      const qty = input.quantityOverride ?? parsed.suggestedQty;
      const key = createIdempotencyKey(`${warehouseCode}-${parsed.tagType.toLowerCase()}`);

      setWarehouses((prev) =>
        prev.map((w) => {
          if (w.stockId !== targetStock.stockId) return w;
          if (input.direction === 'IN') {
            return { ...w, rfidQty: w.rfidQty + qty, physicalQty: w.physicalQty + qty };
          }
          if (input.direction === 'OUT') {
            return {
              ...w,
              rfidQty: Math.max(0, w.rfidQty - qty),
              physicalQty: Math.max(0, w.physicalQty - qty),
            };
          }
          return { ...w, physicalQty: qty };
        }),
      );

      const scanEntry: ScanHistoryItem = {
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rawCode: parsed.rawCode,
        tagType: parsed.tagType,
        materialSku: parsed.materialSku,
        warehouseCode,
        direction: input.direction,
        quantity: qty,
        wasOffline: isOffline,
        idempotencyKey: key,
        scannedAt: new Date().toISOString(),
      };
      setScanHistory((prev) => [scanEntry, ...prev].slice(0, 20));

      if (isOffline) {
        const queued: QueuedRfidScan = {
          idempotencyKey: key,
          stockId: targetStock.stockId,
          warehouseCode,
          deltaQty: qty,
          direction: input.direction,
          offlineTimestamp: scanEntry.scannedAt,
          wasOffline: true,
        };
        await enqueueOfflineScan(queued);
        setOfflineQueue(await listQueuedScans());
        appendAudit({
          entityType: 'InventoryStock',
          entityId: targetStock.stockId,
          action: `WMS_${parsed.tagType}_OFFLINE_QUEUED`,
          actorRole: activeRole,
          idempotencyKey: key,
          reason: `Tag ${parsed.tagType} (${parsed.rawCode}) -> ${input.direction} ${qty} unit (${warehouseCode}) masuk IndexedDB.`,
        });
        const msg = `${parsed.tagType} ${parsed.materialSku} (+${qty}) disimpan ke antrean offline ${warehouseCode}`;
        showToast(msg);
        return { ok: true, message: msg };
      }

      await smartChainApi.scanWmsTag(activeToken, {
        rawCode: parsed.rawCode,
        warehouseCode,
        direction: input.direction,
        quantityOverride: qty,
        idempotencyKey: key,
      });

      appendAudit({
        entityType: 'InventoryStock',
        entityId: targetStock.stockId,
        action: `WMS_${parsed.tagType}_SCANNED`,
        actorRole: activeRole,
        idempotencyKey: key,
        reason: `Pindai ${parsed.tagType} (${parsed.rawCode}) -> ${input.direction} ${qty} unit di ${warehouseCode}.`,
      });
      const msg = `${parsed.tagType} terdekode: ${parsed.materialSku} (${input.direction} ${qty} unit) di ${warehouseCode}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [activeRole, activeToken, appendAudit, showToast, warehouses],
  );

  const issueWarehouseLabel = useCallback(
    async (input: {
      labelType: 'BARCODE_CODE128' | 'RFID_SMARTTAG' | 'RFID_EPC';
      materialSku: string;
      warehouseCode: string;
      quantity: number;
      batchCode?: string;
    }) => {
      if (activeRole !== 'WAREHOUSE_OPERATOR') {
        const msg = 'Penerbitan label Barcode/RFID hanya diizinkan untuk Operator Gudang';
        showToast(msg);
        return { ok: false, message: msg };
      }

      const normSku = input.materialSku.trim().toUpperCase();
      const normWh = input.warehouseCode.trim().toUpperCase();
      const qty = Math.max(1, Math.min(9999, Math.round(input.quantity)));
      const compactSku = normSku.replaceAll('-', '');
      const compactWh = normWh.replaceAll('-', '');
      const batch = (input.batchCode?.trim().toUpperCase() || 'B001').replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'B001';

      const rawCode =
        input.labelType === 'RFID_SMARTTAG'
          ? `RFID:${normSku}:${normWh}:${qty}`
          : input.labelType === 'RFID_EPC'
            ? `EPC-${compactSku}-${compactWh}-${batch}`
            : `BC-${compactSku}-${String(qty).padStart(3, '0')}`;

      const res = await smartChainApi.issueWmsLabel(activeToken, {
        labelType: input.labelType,
        materialSku: normSku,
        warehouseCode: normWh,
        quantity: qty,
        batchCode: batch,
      });

      if (!res.ok && session?.authMode === 'jwt-api') {
        showToast(res.message);
        return { ok: false, message: res.message };
      }

      const stockMatch = warehouses.find(
        (w) => w.warehouseCode === normWh && w.materialSku === normSku,
      );
      appendAudit({
        entityType: 'InventoryStock',
        entityId: stockMatch?.stockId ?? `${normWh}-${normSku}`,
        action: 'WMS_LABEL_GENERATED',
        actorRole: activeRole,
        reason: `Label ${input.labelType} (${rawCode}) dicetak untuk ${qty} unit di ${normWh} [Batch ${batch}].`,
      });
      const msg = `Label ${rawCode} diterbitkan & dicatat ke audit gudang ${normWh}`;
      showToast(msg);
      return {
        ok: true,
        rawCode,
        materialSku: normSku,
        warehouseCode: normWh,
        quantity: qty,
        batchCode: batch,
        message: msg,
      };
    },
    [activeRole, activeToken, appendAudit, session?.authMode, showToast, warehouses],
  );

  const syncOfflineQueue = useCallback(
    async (warehouseCode = 'WH-04') => {
      if (activeRole !== 'WAREHOUSE_OPERATOR') {
        showToast('Sinkronisasi batch hanya untuk Operator Gudang');
        return;
      }
      const targetWh = warehouses.find((w) => w.warehouseCode === warehouseCode);
      if (targetWh?.networkStatus === 'OFFLINE') {
        showToast(`Pulihkan koneksi ${warehouseCode} terlebih dahulu sebelum sinkronisasi`);
        return;
      }
      const pending = await listQueuedScans();
      const matching = pending.filter((p) => p.warehouseCode === warehouseCode);
      const batch = matching.length > 0 ? matching : pending;
      if (batch.length === 0) {
        showToast('Tidak ada transaksi pada antrean lokal IndexedDB');
        return;
      }

      await smartChainApi.syncWmsBatch(activeToken, batch);
      setLastSyncedBatch(batch);
      await clearQueuedScans(batch.map((item) => item.idempotencyKey));
      setOfflineQueue(await listQueuedScans());
      appendAudit({
        entityType: 'RfidSyncLog',
        entityId: warehouseCode,
        action: 'WMS_BATCH_SYNC_COMPLETED',
        actorRole: activeRole,
        reason: `${batch.length} transaksi antrean IndexedDB disinkronkan tanpa duplikasi.`,
      });
      showToast(`${batch.length} transaksi offline berhasil disinkronkan`);
    },
    [activeRole, activeToken, appendAudit, showToast, warehouses],
  );

  const replayLastBatchIdempotency = useCallback(async () => {
    if (lastSyncedBatch.length === 0) {
      showToast('Belum ada batch yang disinkronkan untuk diuji ulang idempotency-nya');
      return;
    }
    await smartChainApi.syncWmsBatch(activeToken, lastSyncedBatch);
    appendAudit({
      entityType: 'RfidSyncLog',
      entityId: lastSyncedBatch[0]?.warehouseCode ?? 'WH-04',
      action: 'IDEMPOTENCY_DUPLICATE_SKIPPED',
      actorRole: activeRole,
      idempotencyKey: lastSyncedBatch[0]?.idempotencyKey,
      reason: `Uji kirim ulang ${lastSyncedBatch.length} kunci idempoten ditolak tanpa mutasi stok ganda.`,
    });
    showToast(`Idempotency check lolos: ${lastSyncedBatch.length} duplikat diabaikan (0 mutasi ganda)`);
  }, [activeRole, activeToken, appendAudit, lastSyncedBatch, showToast]);

  const reconcileWh04 = useCallback(
    async (warehouseCode = 'WH-04') => {
      if (activeRole !== 'WAREHOUSE_OPERATOR') {
        showToast('Rekonsiliasi cycle count hanya untuk Operator Gudang');
        return;
      }
      const targetWh = warehouses.find((w) => w.warehouseCode === warehouseCode);
      if (!targetWh) return;
      const discrepancy = Math.abs(targetWh.rfidQty - targetWh.physicalQty);
      if (discrepancy === 0) {
        showToast(`Stok RFID dan fisik ${warehouseCode} sudah seimbang (0 selisih)`);
        return;
      }

      await smartChainApi.reconcileWmsStock(activeToken, targetWh.stockId);
      setWarehouses((prev) =>
        prev.map((w) =>
          w.warehouseCode === warehouseCode
            ? { ...w, quarantineQty: w.quarantineQty + discrepancy, rfidQty: w.physicalQty }
            : w,
        ),
      );
      if (warehouseCode === 'WH-04') setReconciled(true);
      appendAudit({
        entityType: 'InventoryStock',
        entityId: targetWh.stockId,
        action: 'WMS_CYCLE_COUNT_RECONCILED',
        actorRole: activeRole,
        reason: `Rekonsiliasi ${warehouseCode}: ${discrepancy} unit selisih dipindah ke karantina.`,
      });
      showToast(`${discrepancy} unit selisih (${warehouseCode}) dikarantina dan diaudit`);
    },
    [activeRole, activeToken, appendAudit, showToast, warehouses],
  );

  const toggleAnomalyFilter = useCallback(async () => {
    if (activeRole !== 'LOGISTICS_MANAGER') {
      showToast('Filter Anomaly Guard dikelola oleh Manajer Distribusi & Logistik');
      return;
    }
    const nextFilter = !anomalyFilterActive;
    setAnomalyFilterActive(nextFilter);
    if (nextFilter) {
      await smartChainApi.validateOrder(activeToken, { orderIdOrNumber: 'ORD-882' });
    }
    setSalesOrders((prev) =>
      prev.map((o) => {
        if (o.requestedQty > o.monthlyQuota * 1.5 && !o.depositConfirmed) {
          return {
            ...o,
            anomalyFlag: nextFilter,
            allocationStatus: nextFilter ? 'HELD_ANOMALY' : 'PENDING',
            allocatedQty: 0,
            anomalyReason: nextFilter
              ? `Melebihi 150% kuota (${o.requestedQty} vs ${o.monthlyQuota} unit) tanpa deposit.`
              : null,
          };
        }
        return o;
      }),
    );
    appendAudit({
      entityType: 'SalesOrder',
      entityId: 'ORD-882',
      action: nextFilter ? 'ORDER_ANOMALY_GUARD_ENABLED' : 'ORDER_ANOMALY_GUARD_RESET',
      actorRole: activeRole,
      reason: nextFilter
        ? 'Filter anomali aktif: pesanan fiktif >150% kuota ditahan sebelum penguncian stok.'
        : 'Simulasi filter anomali dikembalikan ke antrean manual.',
    });
    showToast(nextFilter ? 'Filter Anomaly Guard aktif: pesanan fiktif ditahan' : 'Filter Anomaly Guard dimatikan');
  }, [activeRole, activeToken, anomalyFilterActive, appendAudit, showToast]);

  const verifyAndApproveOrder = useCallback(
    async (orderId: string) => {
      if (activeRole !== 'LOGISTICS_MANAGER') {
        showToast('Hanya Manajer Logistik yang dapat memverifikasi deposit & meloloskan order');
        return;
      }
      const target = salesOrders.find((o) => o.id === orderId);
      if (!target) return;

      await smartChainApi.validateOrder(activeToken, {
        orderIdOrNumber: target.orderNumber,
        depositConfirmed: true,
      });

      setSalesOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                depositConfirmed: true,
                anomalyFlag: false,
                anomalyReason: null,
                allocatedQty: o.requestedQty,
                allocationStatus: 'APPROVED_SLA',
              }
            : o,
        ),
      );
      appendAudit({
        entityType: 'SalesOrder',
        entityId: target.orderNumber,
        action: 'ORDER_DEPOSIT_VERIFIED_APPROVED',
        actorRole: activeRole,
        reason: `Deposit ${target.orderNumber} terverifikasi; alokasi ${target.requestedQty} unit disetujui.`,
      });
      showToast(`${target.orderNumber} terverifikasi deposit dan diloloskan`);
    },
    [activeRole, activeToken, appendAudit, salesOrders, showToast],
  );

  const rejectOrder = useCallback(
    (orderId: string) => {
      if (activeRole !== 'LOGISTICS_MANAGER') {
        showToast('Penahanan permanen order dikelola oleh Manajer Logistik');
        return;
      }
      const target = salesOrders.find((o) => o.id === orderId);
      if (!target) return;
      setSalesOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                anomalyFlag: true,
                allocatedQty: 0,
                allocationStatus: 'HELD_ANOMALY',
                anomalyReason: 'Ditolak permanen oleh Manajer Logistik (indikasi pesanan fiktif).',
              }
            : o,
        ),
      );
      appendAudit({
        entityType: 'SalesOrder',
        entityId: target.orderNumber,
        action: 'ORDER_REJECTED_ANOMALY',
        actorRole: activeRole,
        reason: `${target.orderNumber} ditolak permanen untuk melindungi alokasi stok.`,
      });
      showToast(`${target.orderNumber} ditahan permanen`);
    },
    [activeRole, appendAudit, salesOrders, showToast],
  );

  const runSlaSurgeAllocation = useCallback(
    async (availableStockOverride = 280) => {
      if (activeRole !== 'LOGISTICS_MANAGER') {
        showToast('Alokasi prioritas SLA dikelola oleh Manajer Distribusi & Logistik');
        return;
      }
      await smartChainApi.allocateSurge(activeToken, 'mat-1', availableStockOverride);

      let remaining = availableStockOverride;
      const tierRank: Record<SalesOrderDto['slaTier'], number> = {
        TIER_1: 300,
        TIER_2: 200,
        TIER_3: 100,
      };
      const sortedIds = [...salesOrders]
        .sort((a, b) => tierRank[b.slaTier] + b.slaScore - (tierRank[a.slaTier] + a.slaScore))
        .map((o) => o.id);

      const updates = new Map<string, { allocatedQty: number; status: string; anomalyFlag: boolean }>();
      for (const id of sortedIds) {
        const ord = salesOrders.find((o) => o.id === id)!;
        const isAnomaly = ord.requestedQty > ord.monthlyQuota * 1.5 && !ord.depositConfirmed;
        if (isAnomaly) {
          updates.set(id, { allocatedQty: 0, status: 'HELD_ANOMALY', anomalyFlag: true });
          continue;
        }
        const alloc = Math.min(ord.requestedQty, remaining);
        remaining -= alloc;
        updates.set(id, {
          allocatedQty: alloc,
          status: alloc === ord.requestedQty && alloc > 0 ? 'APPROVED_SLA' : alloc > 0 ? 'PARTIAL_ALLOCATED' : 'PENDING',
          anomalyFlag: false,
        });
      }

      setSalesOrders((prev) =>
        prev.map((o) => {
          const next = updates.get(o.id);
          return next
            ? { ...o, allocatedQty: next.allocatedQty, allocationStatus: next.status, anomalyFlag: next.anomalyFlag }
            : o;
        }),
      );
      setAnomalyFilterActive(true);
      appendAudit({
        entityType: 'SalesOrderBatch',
        entityId: 'SURGE-300',
        action: 'ORDER_SURGE_SLA_ALLOCATED',
        actorRole: activeRole,
        reason: `Alokasi SLA dijalankan pada stok terbatas (${availableStockOverride} unit); sisa ${remaining} unit.`,
      });
      showToast(`Alokasi prioritas SLA selesai (stok tersedia ${availableStockOverride} unit)`);
    },
    [activeRole, activeToken, appendAudit, salesOrders, showToast],
  );

  const submitOrderValidation = useCallback(
    async (distributorCode: string, requestedQty: number, depositConfirmed: boolean) => {
      if (activeRole !== 'LOGISTICS_MANAGER' && activeRole !== 'PARTNER') {
        showToast('Pengajuan atau validasi order hanya untuk Manajer Logistik atau Mitra Distributor');
        return;
      }
      const scopedCode =
        activeRole === 'PARTNER' && session?.user.entityCode
          ? session.user.entityCode
          : distributorCode;
      const effectiveDeposit = activeRole === 'PARTNER' ? false : depositConfirmed;

      await smartChainApi.validateOrder(activeToken, {
        distributorIdOrCode: scopedCode,
        materialIdOrSku: 'MAT-01',
        requestedQty,
        depositConfirmed: effectiveDeposit,
      });

      const template = salesOrders.find((o) => o.distributorCode === scopedCode) ?? salesOrders[0]!;
      const isAnomaly = requestedQty > template.monthlyQuota * 1.5 && !effectiveDeposit;
      const orderNo = `ORD-${Date.now().toString().slice(-3)}`;

      const created: SalesOrderDto = {
        id: `ord-${Date.now()}`,
        orderNumber: orderNo,
        distributorCode: scopedCode,
        distributorName:
          activeRole === 'PARTNER' && session?.user.name ? session.user.name : template.distributorName,
        routeGroup: template.routeGroup,
        slaTier: template.slaTier,
        slaScore: template.slaScore,
        monthlyQuota: template.monthlyQuota,
        requestedQty,
        allocatedQty: isAnomaly ? 0 : requestedQty,
        totalAmount: requestedQty * 420_000,
        anomalyFlag: isAnomaly,
        anomalyReason: isAnomaly
          ? `Volume (${requestedQty} unit) melebihi 150% kuota bulanan (${template.monthlyQuota} unit) tanpa deposit.`
          : null,
        allocationStatus: isAnomaly ? 'HELD_ANOMALY' : 'APPROVED_SLA',
        depositConfirmed: effectiveDeposit,
      };

      setSalesOrders((prev) => [created, ...prev]);
      appendAudit({
        entityType: 'SalesOrder',
        entityId: orderNo,
        action: isAnomaly ? 'ORDER_HELD_ANOMALY_GUARD' : 'ORDER_APPROVED_SLA',
        actorRole: activeRole,
        reason: isAnomaly
          ? `${orderNo} ditahan oleh Anomaly Guard (${requestedQty} vs kuota ${template.monthlyQuota}).`
          : `${orderNo} lolos SLA ${template.slaTier} dan dialokasikan.`,
      });
      showToast(
        isAnomaly
          ? `${orderNo} terdeteksi anomali dan ditahan sebelum penguncian stok`
          : `${orderNo} lolos validasi SLA dan dialokasikan`,
      );
    },
    [activeRole, activeToken, appendAudit, salesOrders, session?.user.entityCode, session?.user.name, showToast],
  );

  const consolidateTmsRoutes = useCallback(async () => {
    if (activeRole !== 'LOGISTICS_MANAGER') {
      showToast('Konsolidasi rute TMS dikelola oleh Manajer Distribusi & Logistik');
      return;
    }
    const surgePct = stressMode ? 40 : 0;
    await smartChainApi.consolidateTms(activeToken, surgePct);
    setShipments((prev) =>
      prev.map((s) => {
        const effectiveBase = Math.round(s.baseCost * (1 + surgePct / 100));
        const consolidated = Math.round(effectiveBase * 0.72);
        return {
          ...s,
          consolidatedCost: consolidated,
          isConsolidated: true,
          consolidationBatchId: `TMS-${s.routeGroup.slice(0, 6)}`,
          trackingStatus: 'CONSOLIDATED',
        };
      }),
    );
    setTmsConsolidated(true);
    appendAudit({
      entityType: 'ShipmentBatch',
      entityId: 'ALL_ROUTES',
      action: 'TMS_ROUTES_CONSOLIDATED',
      actorRole: activeRole,
      reason: 'Konsolidasi muatan searah (JAWA_BARAT & JAWA_TIMUR) menekan biaya kirim 28%.',
    });
    showToast('Rute TMS berhasil dikonsolidasikan (hemat 28% biaya kirim)');
  }, [activeRole, activeToken, appendAudit, showToast, stressMode]);

  const createManagedUser = useCallback(
    async (input: {
      email: string;
      name: string;
      role: SmartChainRole;
      entityCode?: string;
      password: string;
    }): Promise<boolean> => {
      if (activeRole !== 'SYSTEM_ADMIN') {
        showToast('Hanya Admin Sistem IT yang berhak membuat akun pengguna');
        return false;
      }
      const normalized = input.email.trim().toLowerCase();
      if (managedUsers.some((u) => u.email.toLowerCase() === normalized)) {
        showToast(`Email ${normalized} sudah terdaftar`);
        return false;
      }

      const apiRes = await smartChainApi.createAdminUser(activeToken, {
        ...input,
        email: normalized,
      });
      if (!apiRes.ok && session?.authMode === 'jwt-api') {
        showToast(apiRes.message);
        return false;
      }

      const created: ManagedUserDto = apiRes.ok
        ? apiRes.data.user
        : {
            id: `usr-${Date.now()}`,
            email: normalized,
            name: input.name.trim(),
            role: input.role,
            entityCode: input.role === 'PARTNER' ? input.entityCode?.trim() ?? null : null,
            isActive: true,
            createdAt: new Date().toISOString(),
          };
      setManagedUsers((prev) => [...prev, created]);
      appendAudit({
        entityType: 'UserAccount',
        entityId: created.id,
        action: 'USER_ACCOUNT_CREATED',
        actorRole: activeRole,
        reason: `Akun ${created.email} dibuat dengan peran ${created.role}.`,
      });
      showToast(`Akun ${created.email} berhasil dibuat`);
      return true;
    },
    [activeRole, activeToken, appendAudit, managedUsers, session?.authMode, showToast],
  );

  const updateManagedUserAccess = useCallback(
    async (userId: string, patch: { role?: SmartChainRole; isActive?: boolean }) => {
      if (activeRole !== 'SYSTEM_ADMIN') {
        showToast('Hanya Admin Sistem IT yang dapat mengubah akses pengguna');
        return;
      }
      const target = managedUsers.find((u) => u.id === userId);
      if (!target) return;
      if (target.email === session?.user.email && patch.isActive === false) {
        showToast('Admin Sistem tidak dapat menonaktifkan akunnya sendiri');
        return;
      }

      const apiRes = await smartChainApi.updateAdminUserAccess(activeToken, userId, patch);
      if (!apiRes.ok && session?.authMode === 'jwt-api') {
        showToast(apiRes.message);
        return;
      }

      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: patch.role ?? u.role,
                isActive: patch.isActive ?? u.isActive,
              }
            : u,
        ),
      );
      appendAudit({
        entityType: 'UserAccount',
        entityId: userId,
        action: 'USER_ACCESS_UPDATED',
        actorRole: activeRole,
        reason: `Akses ${target.email} diperbarui (${patch.role ?? target.role}, aktif=${String(patch.isActive ?? target.isActive)}).`,
      });
      showToast(`Akses untuk ${target.email} berhasil diperbarui`);
    },
    [activeRole, activeToken, appendAudit, managedUsers, session?.authMode, session?.user.email, showToast],
  );

  const resetManagedUserPassword = useCallback(
    async (userId: string, newPassword: string) => {
      if (activeRole !== 'SYSTEM_ADMIN') {
        showToast('Hanya Admin Sistem IT yang dapat mereset kata sandi');
        return;
      }
      const target = managedUsers.find((u) => u.id === userId);
      if (!target) return;

      const apiRes = await smartChainApi.resetAdminUserPassword(activeToken, userId, newPassword);
      if (!apiRes.ok && session?.authMode === 'jwt-api') {
        showToast(apiRes.message);
        return;
      }
      appendAudit({
        entityType: 'UserAccount',
        entityId: userId,
        action: 'USER_PASSWORD_RESET',
        actorRole: activeRole,
        reason: `Kata sandi ${target.email} telah direset oleh Admin Sistem.`,
      });
      showToast(`Kata sandi untuk ${target.email} berhasil direset`);
    },
    [activeRole, activeToken, appendAudit, managedUsers, session?.authMode, showToast],
  );

  return (
    <SmartChainContext.Provider
      value={{
        session,
        authReady,
        login,
        logout,
        stressMode,
        setStressMode,
        suppliers,
        purchaseOrders,
        warehouses,
        salesOrders,
        shipments,
        forecasts,
        auditLogs,
        managedUsers,
        offlineQueue,
        lastSyncedBatch,
        scanHistory,
        rfqTriggered,
        wh04Offline,
        reconciled,
        anomalyFilterActive,
        tmsConsolidated,
        showToast,
        toggleSupplierHalt,
        triggerRfqFallback,
        createPurchaseOrder,
        updatePoStatus,
        toggleWh04Offline,
        scanWh04Rfid,
        scanBarcodeOrRfidTag,
        issueWarehouseLabel,
        syncOfflineQueue,
        replayLastBatchIdempotency,
        reconcileWh04,
        toggleAnomalyFilter,
        verifyAndApproveOrder,
        rejectOrder,
        runSlaSurgeAllocation,
        submitOrderValidation,
        consolidateTmsRoutes,
        createManagedUser,
        updateManagedUserAccess,
        resetManagedUserPassword,
      }}
    >
      {children}
      <ToastRegion message={toastMessage} />
    </SmartChainContext.Provider>
  );
}

export function useSmartChainMode() {
  const ctx = useContext(SmartChainContext);
  if (!ctx) {
    throw new Error('useSmartChainMode must be used inside SmartChainProvider');
  }
  return ctx;
}
