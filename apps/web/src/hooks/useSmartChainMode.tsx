'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { smartChainApi } from '@/lib/apiClient';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_FORECAST_MATERIALS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES_ORDERS,
  INITIAL_SHIPMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_WAREHOUSE_STOCKS,
} from '@/lib/mockSnapshot';
import {
  clearQueuedScans,
  createIdempotencyKey,
  enqueueOfflineScan,
  listQueuedScans,
  type QueuedRfidScan,
} from '@/lib/offlineQueue';
import type {
  AuditEntryDto,
  ForecastMaterialDto,
  PurchaseOrderDto,
  SalesOrderDto,
  ShipmentDto,
  SmartChainRole,
  SupplierDto,
  WarehouseStockDto,
} from '@/lib/types';
import { ToastRegion } from '@/components/ui/ToastRegion';

interface SmartChainContextValue {
  stressMode: boolean;
  setStressMode: (next: boolean) => void;
  role: SmartChainRole;
  setRole: (next: SmartChainRole) => void;
  suppliers: SupplierDto[];
  purchaseOrders: PurchaseOrderDto[];
  warehouses: WarehouseStockDto[];
  salesOrders: SalesOrderDto[];
  shipments: ShipmentDto[];
  forecasts: ForecastMaterialDto[];
  auditLogs: AuditEntryDto[];
  offlineQueue: QueuedRfidScan[];
  rfqTriggered: boolean;
  wh04Offline: boolean;
  reconciled: boolean;
  anomalyFilterActive: boolean;
  tmsConsolidated: boolean;
  showToast: (message: string) => void;
  triggerRfqFallback: () => Promise<void>;
  toggleWh04Offline: () => void;
  scanWh04Rfid: (deltaQty?: number) => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  reconcileWh04: () => Promise<void>;
  toggleAnomalyFilter: () => Promise<void>;
  submitOrderValidation: (distributorCode: string, requestedQty: number, depositConfirmed: boolean) => void;
  consolidateTmsRoutes: () => Promise<void>;
}

const SmartChainContext = createContext<SmartChainContextValue | null>(null);

export function SmartChainProvider({ children }: { children: React.ReactNode }) {
  const [stressMode, setStressModeState] = useState(false);
  const [role, setRoleState] = useState<SmartChainRole>('DIREKSI');
  const [suppliers, setSuppliers] = useState<SupplierDto[]>(INITIAL_SUPPLIERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>(INITIAL_PURCHASE_ORDERS);
  const [warehouses, setWarehouses] = useState<WarehouseStockDto[]>(INITIAL_WAREHOUSE_STOCKS);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDto[]>(INITIAL_SALES_ORDERS);
  const [shipments, setShipments] = useState<ShipmentDto[]>(INITIAL_SHIPMENTS);
  const [forecasts, setForecasts] = useState<ForecastMaterialDto[]>(INITIAL_FORECAST_MATERIALS);
  const [auditLogs, setAuditLogs] = useState<AuditEntryDto[]>(INITIAL_AUDIT_LOGS);
  const [offlineQueue, setOfflineQueue] = useState<QueuedRfidScan[]>([]);

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
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3200);
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

  useEffect(() => {
    void listQueuedScans().then(setOfflineQueue).catch(() => {});
  }, []);

  const setRole = useCallback(
    (next: SmartChainRole) => {
      setRoleState(next);
      void smartChainApi.switchRole(next);
      showToast(`Peran aktif beralih ke ${next}`);
    },
    [showToast],
  );

  const setStressMode = useCallback(
    (next: boolean) => {
      setStressModeState(next);
      setSuppliers((prev) =>
        prev.map((s) =>
          s.code === 'SUP-01'
            ? {
                ...s,
                status: next ? 'HALTED' : 'ACTIVE',
                haltedDays: next ? 14 : 0,
              }
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

  const triggerRfqFallback = useCallback(async () => {
    if (role === 'PARTNER' || role === 'WAREHOUSE_OPERATOR') {
      showToast(`Peran ${role} tidak memiliki otorisasi memicu RFQ`);
      return;
    }

    await smartChainApi.triggerRfqFallback(role, 'SUP-01');
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
        actorRole: role,
        reason: 'SUP-01 berhenti 14 hari -> RFQ otomatis dikirim ke SUP-16 (Cadangan Tier-2).',
      });
    }
    showToast('RFQ otomatis dikirim ke pemasok cadangan Tier-2 (SUP-16)');
  }, [appendAudit, rfqTriggered, role, showToast]);

  const toggleWh04Offline = useCallback(() => {
    const nextOffline = !wh04Offline;
    setWh04Offline(nextOffline);
    setWarehouses((prev) =>
      prev.map((w) =>
        w.warehouseCode === 'WH-04'
          ? {
              ...w,
              networkStatus: nextOffline ? 'OFFLINE' : 'ONLINE',
              offlineHours: nextOffline ? 48 : 0,
            }
          : w,
      ),
    );
    appendAudit({
      entityType: 'Warehouse',
      entityId: 'WH-04',
      action: nextOffline ? 'WAREHOUSE_OFFLINE_48H' : 'WAREHOUSE_ONLINE_RESTORED',
      actorRole: role,
      reason: nextOffline
        ? 'Gudang #04 (Surabaya) terputus jaringan; mode Store-and-Forward IndexedDB aktif.'
        : 'Koneksi Gudang #04 pulih; siap sinkronisasi antrean lokal.',
    });
    showToast(nextOffline ? 'Gudang #04 masuk mode offline (48 jam)' : 'Gudang #04 kembali online');
  }, [appendAudit, role, showToast, wh04Offline]);

  const scanWh04Rfid = useCallback(
    async (deltaQty = 10) => {
      const key = createIdempotencyKey('WH-04');
      const scan: QueuedRfidScan = {
        idempotencyKey: key,
        stockId: 'stk-wh04',
        warehouseCode: 'WH-04',
        deltaQty,
        direction: 'IN',
        offlineTimestamp: new Date().toISOString(),
        wasOffline: wh04Offline,
      };

      setWarehouses((prev) =>
        prev.map((w) =>
          w.warehouseCode === 'WH-04'
            ? {
                ...w,
                rfidQty: w.rfidQty + deltaQty,
                physicalQty: w.physicalQty + deltaQty,
              }
            : w,
        ),
      );

      if (wh04Offline) {
        await enqueueOfflineScan(scan);
        const updatedQueue = await listQueuedScans();
        setOfflineQueue(updatedQueue);
        appendAudit({
          entityType: 'RfidSyncLog',
          entityId: 'WH-04',
          action: 'OFFLINE_SCAN_QUEUED',
          actorRole: role,
          idempotencyKey: key,
          reason: `Pindai +${deltaQty} unit disimpan ke IndexedDB lokal (offline).`,
        });
        showToast(`Pindai +${deltaQty} unit disimpan ke antrean IndexedDB`);
      } else {
        await smartChainApi.syncWmsBatch(role, [scan]);
        appendAudit({
          entityType: 'RfidSyncLog',
          entityId: 'WH-04',
          action: 'ONLINE_SCAN_SYNCED',
          actorRole: role,
          idempotencyKey: key,
          reason: `Pindai +${deltaQty} unit tersinkron langsung ke pusat.`,
        });
        showToast(`Pemindaian RFID +${deltaQty} unit tersinkron langsung`);
      }
    },
    [appendAudit, role, showToast, wh04Offline],
  );

  const syncOfflineQueue = useCallback(async () => {
    if (wh04Offline) {
      showToast('Pulihkan koneksi Gudang #04 terlebih dahulu sebelum sinkronisasi');
      return;
    }
    const pending = await listQueuedScans();
    if (pending.length === 0) {
      showToast('Tidak ada transaksi pada antrean lokal IndexedDB');
      return;
    }

    await smartChainApi.syncWmsBatch(role, pending);
    await clearQueuedScans(pending.map((item) => item.idempotencyKey));
    setOfflineQueue([]);
    appendAudit({
      entityType: 'RfidSyncLog',
      entityId: 'WH-04',
      action: 'WMS_BATCH_SYNC_COMPLETED',
      actorRole: role,
      reason: `${pending.length} transaksi antrean IndexedDB disinkronkan tanpa duplikasi.`,
    });
    showToast(`${pending.length} transaksi offline berhasil disinkronkan`);
  }, [appendAudit, role, showToast, wh04Offline]);

  const reconcileWh04 = useCallback(async () => {
    const wh04 = warehouses.find((w) => w.warehouseCode === 'WH-04');
    if (!wh04) return;
    const discrepancy = Math.abs(wh04.rfidQty - wh04.physicalQty);
    if (discrepancy === 0) {
      showToast('Stok RFID dan fisik Gudang #04 sudah seimbang (0 selisih)');
      return;
    }

    await smartChainApi.reconcileWmsStock(role, wh04.stockId);
    setWarehouses((prev) =>
      prev.map((w) =>
        w.warehouseCode === 'WH-04'
          ? {
              ...w,
              quarantineQty: w.quarantineQty + discrepancy,
              rfidQty: w.physicalQty,
            }
          : w,
      ),
    );
    setReconciled(true);
    appendAudit({
      entityType: 'InventoryStock',
      entityId: wh04.stockId,
      action: 'WMS_CYCLE_COUNT_RECONCILED',
      actorRole: role,
      reason: `Rekonsiliasi selesai: ${discrepancy} unit selisih dipindah ke karantina.`,
    });
    showToast(`${discrepancy} unit selisih berhasil dikarantina dan dicatat di audit log`);
  }, [appendAudit, role, showToast, warehouses]);

  const toggleAnomalyFilter = useCallback(async () => {
    const nextFilter = !anomalyFilterActive;
    setAnomalyFilterActive(nextFilter);
    if (nextFilter) {
      await smartChainApi.validateOrder(role, 'ORD-882');
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
      actorRole: role,
      reason: nextFilter
        ? 'Filter anomali aktif: pesanan fiktif >150% kuota ditahan sebelum penguncian stok.'
        : 'Simulasi filter anomali dikembalikan ke antrean manual.',
    });
    showToast(nextFilter ? 'Filter Anomaly Guard aktif: pesanan fiktif ditahan' : 'Filter Anomaly Guard dimatikan');
  }, [anomalyFilterActive, appendAudit, role, showToast]);

  const submitOrderValidation = useCallback(
    (distributorCode: string, requestedQty: number, depositConfirmed: boolean) => {
      const template = salesOrders.find((o) => o.distributorCode === distributorCode) ?? salesOrders[0]!;
      const isAnomaly = requestedQty > template.monthlyQuota * 1.5 && !depositConfirmed;
      const orderNo = `ORD-${Date.now().toString().slice(-3)}`;

      const created: SalesOrderDto = {
        id: `ord-${Date.now()}`,
        orderNumber: orderNo,
        distributorCode: template.distributorCode,
        distributorName: template.distributorName,
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
        depositConfirmed,
      };

      setSalesOrders((prev) => [created, ...prev]);
      appendAudit({
        entityType: 'SalesOrder',
        entityId: orderNo,
        action: isAnomaly ? 'ORDER_HELD_ANOMALY_GUARD' : 'ORDER_APPROVED_SLA',
        actorRole: role,
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
    [appendAudit, role, salesOrders, showToast],
  );

  const consolidateTmsRoutes = useCallback(async () => {
    const surgePct = stressMode ? 40 : 0;
    await smartChainApi.consolidateTms(role, surgePct);
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
      actorRole: role,
      reason: 'Konsolidasi muatan searah (JAWA_BARAT & JAWA_TIMUR) menekan biaya kirim 28%.',
    });
    showToast('Rute TMS berhasil dikonsolidasikan (hemat 28% biaya kirim)');
  }, [appendAudit, role, showToast, stressMode]);

  return (
    <SmartChainContext.Provider
      value={{
        stressMode,
        setStressMode,
        role,
        setRole,
        suppliers,
        purchaseOrders,
        warehouses,
        salesOrders,
        shipments,
        forecasts,
        auditLogs,
        offlineQueue,
        rfqTriggered,
        wh04Offline,
        reconciled,
        anomalyFilterActive,
        tmsConsolidated,
        showToast,
        triggerRfqFallback,
        toggleWh04Offline,
        scanWh04Rfid,
        syncOfflineQueue,
        reconcileWh04,
        toggleAnomalyFilter,
        submitOrderValidation,
        consolidateTmsRoutes,
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
