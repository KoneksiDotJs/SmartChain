'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

const FACTORY_NEEDS = [
  { code: 'FAC-01', name: 'Pabrik Cikarang (Utama)', dailyMaterialNeed: 420, stockCoverageDays: 6.9 },
  { code: 'FAC-02', name: 'Pabrik Gresik', dailyMaterialNeed: 310, stockCoverageDays: 5.4 },
  { code: 'FAC-03', name: 'Pabrik Semarang', dailyMaterialNeed: 265, stockCoverageDays: 4.8 },
];

export default function ProcurementPoPage() {
  const {
    suppliers,
    purchaseOrders,
    forecasts,
    stressMode,
    createPurchaseOrder,
    updatePoStatus,
  } = useSmartChainMode();

  const [supplierCode, setSupplierCode] = useState('SUP-04');
  const [materialSku, setMaterialSku] = useState('MAT-02');
  const [factoryName, setFactoryName] = useState('Pabrik Cikarang (Utama)');
  const [quantity, setQuantity] = useState('300');
  const [notes, setNotes] = useState('Pengisian stok berdasarkan ambang batas ROP');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'APPROVED' | 'COMPLETED'>('ALL');

  const ropShortages = forecasts.filter((f) => f.needsProcurement);
  const visibleOrders = purchaseOrders.filter((po) => {
    if (statusFilter === 'OPEN') return po.status === 'DRAFT_RFQ' || po.status === 'PENDING_APPROVAL';
    if (statusFilter === 'APPROVED') return po.status === 'APPROVED' || po.status === 'IN_TRANSIT';
    if (statusFilter === 'COMPLETED') return po.status === 'RECEIVED';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 className="sc-section-head">Procurement Management &amp; Purchase Order (PO)</h2>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Kelola pengadaan bahan baku untuk 3 pabrik yang terhubung langsung dengan ambang batas
            Reorder Point (ROP) dan pemasok di modul SRM.
          </p>
        </div>

        <Link href="/srm" className="sc-btn-secondary" style={{ textDecoration: 'none' }}>
          Lihat Pemasok (SRM)
        </Link>
      </div>

      {ropShortages.length > 0 && (
        <PaperCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <strong style={{ color: 'var(--accent)' }}>
                Pemicu ROP Aktif ({ropShortages.length} material di bawah Reorder Point)
              </strong>
              <div style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>
                {ropShortages
                  .map((m) => `${m.sku} (stok ${m.currentStock} vs ROP ${m.reorderPoint})`)
                  .join(', ')}
              </div>
            </div>
            <button
              type="button"
              className="sc-btn-primary"
              onClick={() => {
                const top = ropShortages[0]!;
                setMaterialSku(top.sku);
                setQuantity(String(Math.max(100, top.recommendedOrderQty)));
                setNotes(`Auto-PO dari peringatan ROP ${top.sku}`);
              }}
            >
              Isi Form PO dari ROP ({ropShortages[0]!.sku})
            </button>
          </div>
        </PaperCard>
      )}

      <InteractiveBarChart
        title="Kebutuhan Bahan Baku Harian 3 Pabrik"
        subtitle="Estimasi konsumsi bahan baku harian per pabrik (naik saat simulasi lonjakan permintaan)."
        primaryLabel="Kebutuhan Harian"
        unitSuffix="unit"
        data={FACTORY_NEEDS.map((f) => ({
          id: f.code,
          label: f.code,
          sublabel: f.name,
          primaryValue: Math.round(f.dailyMaterialNeed * (stressMode ? 2.2 : 1)),
          tone: stressMode ? 'accent' : 'ink',
          note: `Cakupan stok estimasi: ${f.stockCoverageDays} hari`,
        }))}
      />

      <div className="sc-split-grid">
        <PaperCard>
          <h3 className="sc-section-head">Terbitkan Purchase Order Baru</h3>
          <p className="sc-section-desc">
            PO baru otomatis menautkan pemasok, material, pabrik tujuan, dan status ROP.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const qty = Number(quantity);
              if (!Number.isFinite(qty) || qty <= 0) return;
              void createPurchaseOrder({
                supplierCode,
                materialSku,
                factoryName,
                quantity: Math.round(qty),
                notes,
              });
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Pemasok Tujuan</span>
              <select
                className="sc-select"
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
              >
                {suppliers.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name} ({s.tierType} / {s.status})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Material Bahan Baku</span>
              <select
                className="sc-select"
                value={materialSku}
                onChange={(e) => setMaterialSku(e.target.value)}
              >
                {forecasts.map((m) => (
                  <option key={m.sku} value={m.sku}>
                    {m.sku} — {m.name} (ROP {m.reorderPoint})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Pabrik Penerima</span>
              <select
                className="sc-select"
                value={factoryName}
                onChange={(e) => setFactoryName(e.target.value)}
              >
                {FACTORY_NEEDS.map((f) => (
                  <option key={f.code} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Kuantitas Order (unit)</span>
              <input
                type="number"
                min={1}
                className="sc-input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Catatan Pengadaan</span>
              <input
                type="text"
                className="sc-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <button type="submit" className="sc-btn-primary" style={{ alignSelf: 'flex-start' }}>
              Terbitkan Purchase Order
            </button>
          </form>
        </PaperCard>

        <PaperCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div>
              <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
                Persetujuan &amp; Pelacakan PO ({visibleOrders.length})
              </h3>
              <p className="sc-section-desc" style={{ marginBottom: 0 }}>
                Setujui draf PO / RFQ cadangan atau catat penerimaan barang di pabrik.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'OPEN', label: 'Menunggu' },
                  { id: 'APPROVED', label: 'Disetujui / Kirim' },
                  { id: 'COMPLETED', label: 'Diterima' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={statusFilter === tab.id ? 'sc-btn-primary' : 'sc-btn-secondary'}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="sc-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>No. PO / RFQ</th>
                  <th>Pemasok &amp; Pabrik</th>
                  <th className="sc-num">Qty</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="sc-mono">
                      <div>{po.poNumber}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                        {po.materialSku} {po.isRfqFallback ? '(RFQ)' : ''}
                      </div>
                    </td>
                    <td>
                      <strong>{po.supplierName}</strong>
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{po.factoryName}</div>
                    </td>
                    <td className="sc-num">{po.quantity}</td>
                    <td>
                      <StatusPill
                        variant={
                          po.status === 'RECEIVED' || po.status === 'APPROVED' ? 'ok' : 'warn'
                        }
                      >
                        {po.status}
                      </StatusPill>
                    </td>
                    <td>
                      {(po.status === 'DRAFT_RFQ' || po.status === 'PENDING_APPROVAL') && (
                        <button
                          type="button"
                          className="sc-btn-primary"
                          style={{ padding: '5px 11px', fontSize: 12 }}
                          onClick={() => void updatePoStatus(po.id, 'APPROVED')}
                        >
                          Setujui
                        </button>
                      )}
                      {po.status === 'IN_TRANSIT' && (
                        <button
                          type="button"
                          className="sc-btn-secondary"
                          style={{ padding: '5px 11px', fontSize: 12 }}
                          onClick={() => void updatePoStatus(po.id, 'RECEIVED')}
                        >
                          Terima
                        </button>
                      )}
                      {(po.status === 'APPROVED' || po.status === 'RECEIVED') && (
                        <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                          {po.status === 'APPROVED' ? 'Menunggu kirim' : 'Selesai'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaperCard>
      </div>
    </div>
  );
}
