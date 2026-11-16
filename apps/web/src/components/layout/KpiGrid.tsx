'use client';

import React from 'react';
import { PaperCard } from '@/components/ui/PaperCard';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

interface KpiCardData {
  title: string;
  val: string;
  note: string;
}

export function KpiGrid() {
  const {
    session,
    stressMode,
    rfqTriggered,
    wh04Offline,
    offlineQueue,
    reconciled,
    warehouses,
    suppliers,
    purchaseOrders,
    salesOrders,
    shipments,
    forecasts,
    managedUsers,
    auditLogs,
  } = useSmartChainMode();

  if (!session) return null;

  const role = session.user.role;
  const wh04 = warehouses.find((w) => w.warehouseCode === 'WH-04' && w.materialSku === 'MAT-01') ??
    warehouses.find((w) => w.warehouseCode === 'WH-04');
  const uniqueWarehouses = new Map<string, typeof warehouses[number]>();
  warehouses.forEach((w) => {
    if (!uniqueWarehouses.has(w.warehouseCode)) uniqueWarehouses.set(w.warehouseCode, w);
  });
  const totalWarehousesCount = uniqueWarehouses.size;
  const onlineCount = [...uniqueWarehouses.values()].filter((w) => w.networkStatus === 'ONLINE').length;
  const haltedSuppliers = suppliers.filter((s) => s.status === 'HALTED').length;
  const ropNeededCount = forecasts.filter((f) => f.needsProcurement).length;
  const heldOrdersCount = salesOrders.filter((o) => o.allocationStatus === 'HELD_ANOMALY').length;
  const consolidatedCount = shipments.filter((s) => s.isConsolidated).length;

  let cards: KpiCardData[] = [];

  if (role === 'PROCUREMENT_MANAGER') {
    cards = [
      {
        title: 'Pemasok Aktif',
        val: `${suppliers.filter((s) => s.tierType === 'MAIN' && s.status === 'ACTIVE').length} / ${suppliers.filter((s) => s.tierType === 'MAIN').length}`,
        note: haltedSuppliers > 0 ? `${haltedSuppliers} pemasok utama berhenti` : 'Semua pemasok utama normal',
      },
      {
        title: 'Pemasok Cadangan Tier-2',
        val: rfqTriggered ? 'RFQ Aktif' : `${suppliers.filter((s) => s.tierType === 'BACKUP').length} Siaga`,
        note: rfqTriggered ? 'SUP-16 dipicu otomatis' : 'Siap multi-sourcing < 2 jam',
      },
      {
        title: 'Purchase Order Terbuka',
        val: `${purchaseOrders.length} PO`,
        note: `${purchaseOrders.filter((p) => p.isRfqFallback).length} RFQ fallback tercatat`,
      },
      {
        title: 'Material di Bawah ROP',
        val: `${ropNeededCount} SKU`,
        note: stressMode ? 'ROP disesuaikan lonjakan 300%' : 'Terhubung ke stok 3 pabrik',
      },
    ];
  } else if (role === 'WAREHOUSE_OPERATOR') {
    const discrepancy = wh04 ? Math.abs(wh04.rfidQty - wh04.physicalQty) : 0;
    cards = [
      {
        title: 'Konektivitas 8 Gudang',
        val: `${onlineCount} / ${totalWarehousesCount} Online`,
        note: wh04Offline ? 'Gudang #04 mode offline' : 'Semua node gudang terhubung',
      },
      {
        title: 'Antrean IndexedDB',
        val: `${offlineQueue.length} trx`,
        note: wh04Offline ? 'Store-and-Forward 48 jam aktif' : 'Siap sinkronisasi idempoten',
      },
      {
        title: 'Selisih Gudang #04',
        val: `${discrepancy} unit`,
        note: discrepancy > 0 ? `RFID ${wh04?.rfidQty} vs Fisik ${wh04?.physicalQty}` : 'Stok RFID & fisik seimbang',
      },
      {
        title: 'Total Karantina',
        val: `${wh04?.quarantineQty ?? 0} unit`,
        note: reconciled ? 'Tercatat di audit log permanen' : 'Menunggu cycle-count reconcile',
      },
    ];
  } else if (role === 'LOGISTICS_MANAGER') {
    const totalShippingCost = shipments.reduce(
      (sum, s) =>
        sum + (s.isConsolidated ? s.consolidatedCost : Math.round(s.baseCost * (stressMode ? 1.4 : 1))),
      0,
    );
    cards = [
      {
        title: 'Distributor Terpantau',
        val: '25 Mitra',
        note: `${salesOrders.length} order aktif dalam antrean`,
      },
      {
        title: 'Anomaly Guard',
        val: `${heldOrdersCount} Ditahan`,
        note: heldOrdersCount > 0 ? 'Pesanan fiktif >150% diblokir' : 'Belum ada order ditahan',
      },
      {
        title: 'Konsolidasi Muatan TMS',
        val: `${consolidatedCount} / ${shipments.length}`,
        note: consolidatedCount > 0 ? 'Hemat 28% biaya koridor' : 'Siap digabung searah',
      },
      {
        title: 'Total Estimasi Ongkos',
        val: `Rp ${(totalShippingCost / 1_000_000).toFixed(1)} jt`,
        note: stressMode ? 'Termasuk eskalasi tarif +40%' : 'Tarif distribusi standar',
      },
    ];
  } else if (role === 'PARTNER') {
    const entityCode = session.user.entityCode ?? '';
    if (entityCode.startsWith('SUP-')) {
      const myPos = purchaseOrders.filter((p) => p.supplierCode === entityCode);
      const supInfo = suppliers.find((s) => s.code === entityCode);
      cards = [
        { title: 'Entitas Pemasok', val: entityCode, note: session.user.name },
        { title: 'PO / RFQ Masuk', val: `${myPos.length} Dokumen`, note: 'Terbatas sesuai ID entitas' },
        { title: 'Status Kemitraan', val: supInfo?.status ?? 'ACTIVE', note: `Skor SLA tercatat ${supInfo?.slaScore ?? 92}%` },
        { title: 'Lead Time Kontrak', val: `${supInfo?.leadTimeDays ?? 4} hari`, note: 'Pengiriman ke 3 pabrik' },
      ];
    } else {
      const myOrders = salesOrders.filter((o) => o.distributorCode === entityCode);
      const myShipments = shipments.filter((s) =>
        myOrders.some((o) => o.orderNumber === s.orderNumber),
      );
      cards = [
        { title: 'Entitas Distributor', val: entityCode || 'DIST-01', note: session.user.name },
        { title: 'Kuota Bulanan', val: `${myOrders[0]?.monthlyQuota ?? 130} unit`, note: 'Batas aman bebas penahanan 150%' },
        { title: 'Pesanan Saya', val: `${myOrders.length} Order`, note: `${myOrders.filter((o) => o.allocationStatus === 'HELD_ANOMALY').length} ditahan verifikasi` },
        { title: 'Pengiriman Saya', val: `${myShipments.length} Resi`, note: 'Pelacakan jadwal TMS langsung' },
      ];
    }
  } else if (role === 'SYSTEM_ADMIN') {
    const activeUsers = managedUsers.filter((u) => u.isActive).length;
    const disabledUsers = managedUsers.length - activeUsers;
    const securityEvents = auditLogs.filter((l) => l.entityType === 'UserAccount').length;
    cards = [
      { title: 'Total Akun Terdaftar', val: `${managedUsers.length} Akun`, note: 'Mencakup 6 peran RBAC' },
      { title: 'Akun Aktif', val: `${activeUsers} Aktif`, note: `${disabledUsers} akun dinonaktifkan` },
      { title: 'Pemisahan Tugas (SoD)', val: 'Ketat', note: 'Akses transaksi bisnis diblokir' },
      { title: 'Audit Akses & Akun', val: `${securityEvents} Log`, note: 'Append-only immutable audit' },
    ];
  } else {
    // DIREKSI read-only strategic overview
    const rfidDiscrepancy = wh04 ? Math.abs(wh04.rfidQty - wh04.physicalQty) : 0;
    cards = [
      {
        title: 'Pemasok & Pabrik',
        val: stressMode ? (rfqTriggered ? '14 + Cadangan' : '14 / 15 Aktif') : '15 / 15',
        note: stressMode ? 'SUP-01 berhenti 14 hari' : '3 pabrik aktif normal',
      },
      {
        title: 'Konektivitas Gudang',
        val: `${onlineCount} / ${totalWarehousesCount} Online`,
        note: wh04Offline ? `Antrean lokal: ${offlineQueue.length} trx` : 'Sinkronisasi real-time',
      },
      {
        title: 'Akurasi Stok RFID',
        val: reconciled
          ? 'Terkarantina'
          : rfidDiscrepancy > 0
            ? `${((Math.min(wh04?.physicalQty ?? 320, wh04?.rfidQty ?? 500) / (wh04?.rfidQty || 1)) * 100).toFixed(1)}% (Selisih)`
            : '100.0%',
        note: reconciled
          ? `${wh04?.quarantineQty ?? 180} unit diaudit`
          : `RFID ${wh04?.rfidQty} vs Fisik ${wh04?.physicalQty}`,
      },
      {
        title: 'Kualitas Data Analitik',
        val: '66.7% (WMA)',
        note: stressMode ? 'Simulasi lonjakan +300% aktif' : '4 interval historis kosong',
      },
    ];
  }

  return (
    <section className="sc-kpi-grid" aria-label="Ringkasan metrik operasional peran">
      {cards.map((card) => (
        <PaperCard key={card.title}>
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 6 }}>
            {card.title}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 25,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              marginBottom: 4,
            }}
          >
            {card.val}
          </div>
          <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            {card.note}
          </div>
        </PaperCard>
      ))}
    </section>
  );
}
