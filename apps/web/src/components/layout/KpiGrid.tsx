'use client';

import React from 'react';
import { PaperCard } from '@/components/ui/PaperCard';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

export function KpiGrid() {
  const { stressMode, rfqTriggered, wh04Offline, offlineQueue, reconciled, warehouses } =
    useSmartChainMode();

  const wh04 = warehouses.find((w) => w.warehouseCode === 'WH-04');
  const onlineCount = warehouses.filter((w) => w.networkStatus === 'ONLINE').length;

  const supplierVal = stressMode
    ? rfqTriggered
      ? '14 + Cadangan'
      : '14 / 15 Aktif'
    : '15 / 15';
  const supplierNote = stressMode
    ? rfqTriggered
      ? 'RFQ fallback aktif (SUP-16)'
      : 'SUP-01 berhenti 14 hari'
    : '3 pabrik aktif normal';

  const warehouseVal = `${onlineCount} / ${warehouses.length} Online`;
  const warehouseNote = wh04Offline
    ? `Antrean lokal: ${offlineQueue.length} trx`
    : stressMode
      ? 'Mode simulasi aktif'
      : 'Sinkronisasi real-time';

  const rfidDiscrepancy = wh04 ? Math.abs(wh04.rfidQty - wh04.physicalQty) : 0;
  const rfidVal = reconciled
    ? 'Terkarantina'
    : stressMode || rfidDiscrepancy > 0
      ? `${((Math.min(wh04?.physicalQty ?? 320, wh04?.rfidQty ?? 500) / (wh04?.rfidQty || 1)) * 100).toFixed(1)}% (Selisih)`
      : '100.0%';
  const rfidNote = reconciled
    ? `${wh04?.quarantineQty ?? 180} unit dikarantina & diaudit`
    : rfidDiscrepancy > 0
      ? `RFID ${wh04?.rfidQty} vs Fisik ${wh04?.physicalQty}`
      : '0 unit selisih tercatat';

  const dataVal = stressMode ? 'WMA Hibrida' : '66.7% (Hibrida)';
  const dataNote = stressMode
    ? 'Data 3 bulan bolong + lonjakan 300%'
    : '4 dari 12 interval historis kosong';

  const cards = [
    { title: 'Pemasok & Pabrik', val: supplierVal, note: supplierNote },
    { title: 'Konektivitas Gudang', val: warehouseVal, note: warehouseNote },
    { title: 'Akurasi Stok RFID', val: rfidVal, note: rfidNote },
    { title: 'Kualitas Data Analitik', val: dataVal, note: dataNote },
  ];

  return (
    <section className="sc-kpi-grid" aria-label="Ringkasan metrik operasional">
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
