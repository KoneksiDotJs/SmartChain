'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

type SupplierFilter = 'ALL' | 'MAIN' | 'BACKUP' | 'HALTED';

export default function SrmPage() {
  const {
    suppliers,
    purchaseOrders,
    forecasts,
    rfqTriggered,
    toggleSupplierHalt,
    triggerRfqFallback,
    createPurchaseOrder,
    updatePoStatus,
  } = useSmartChainMode();

  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('ALL');
  const [pendingAction, setPendingAction] = useState<
    | { type: 'rfq' }
    | { type: 'halt'; supplierCode: string; supplierName: string; currentlyHalted: boolean }
    | null
  >(null);
  const [supplierCode, setSupplierCode] = useState('SUP-04');
  const [materialSku, setMaterialSku] = useState('MAT-02');
  const [factoryName, setFactoryName] = useState('Pabrik Cikarang (Utama)');
  const [quantity, setQuantity] = useState('300');
  const [notes, setNotes] = useState('Pengisian stok berdasarkan ambang batas ROP');

  const visibleSuppliers = suppliers.filter((s) => {
    if (supplierFilter === 'MAIN') return s.tierType === 'MAIN';
    if (supplierFilter === 'BACKUP') return s.tierType === 'BACKUP';
    if (supplierFilter === 'HALTED') return s.status === 'HALTED';
    return true;
  });

  const ropShortages = forecasts.filter((f) => f.needsProcurement);

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
          <h2 className="sc-section-head">Manajemen Pemasok &amp; Multi-Sourcing (SRM)</h2>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Simulasikan penghentian pemasok 14 hari, picu RFQ cadangan Tier-2, dan terbitkan PO
            berbasis ROP untuk 3 pabrik.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/po" className="sc-btn-secondary" style={{ textDecoration: 'none' }}>
            Buka Procurement &amp; PO ({purchaseOrders.length})
          </Link>
          <button
            type="button"
            className="sc-btn-accent"
            onClick={() => setPendingAction({ type: 'rfq' })}
          >
            {rfqTriggered ? 'RFQ Cadangan Aktif' : 'Picu RFQ Pemasok Cadangan'}
          </button>
        </div>
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
                Peringatan ROP ({ropShortages.length} material di bawah batas minimum)
              </strong>
              <div style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>
                {ropShortages.map((m) => `${m.sku} (stok ${m.currentStock} vs ROP ${m.reorderPoint})`).join(', ')}
              </div>
            </div>
            <button
              type="button"
              className="sc-btn-secondary"
              onClick={() => {
                const top = ropShortages[0]!;
                setMaterialSku(top.sku);
                setQuantity(String(Math.max(100, top.recommendedOrderQty)));
                setNotes(`Auto-isi dari rekomendasi ROP ${top.sku}`);
              }}
            >
              Isi Form PO dari ROP ({ropShortages[0]!.sku})
            </button>
          </div>
        </PaperCard>
      )}

      <InteractiveBarChart
        title="Perbandingan Skor SLA &amp; Lead Time Pemasok"
        subtitle="Pemasok yang berhenti ditandai oranye; klik batang untuk melihat kategori material."
        primaryLabel="Skor SLA (%)"
        secondaryLabel="Lead Time (hari)"
        thresholdLabel="Target SLA 90%"
        data={visibleSuppliers.map((sup) => ({
          id: sup.id,
          label: sup.code,
          sublabel: `${sup.name} (${sup.tierType === 'MAIN' ? 'Utama' : 'Cadangan'})`,
          primaryValue: sup.slaScore,
          secondaryValue: sup.leadTimeDays,
          thresholdValue: 90,
          tone: sup.status === 'HALTED' ? 'accent' : sup.tierType === 'BACKUP' ? 'warn' : 'ink',
          secondaryTone: 'ok',
          note: `${sup.materialCategory} — ${sup.city}`,
        }))}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Filter Pemasok:</span>
        {(
          [
            { key: 'ALL', label: `Semua (${suppliers.length})` },
            { key: 'MAIN', label: 'Pemasok Utama' },
            { key: 'BACKUP', label: 'Cadangan Tier-2' },
            { key: 'HALTED', label: 'Berhenti / Terdampak' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={supplierFilter === tab.key ? 'sc-btn-primary' : 'sc-btn-secondary'}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setSupplierFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Pemasok</th>
              <th>Peran</th>
              <th>Kategori</th>
              <th className="sc-num">Lead Time</th>
              <th className="sc-num">Skor SLA</th>
              <th>Status Pasokan</th>
              <th>Aksi Pengadaan</th>
            </tr>
          </thead>
          <tbody>
            {visibleSuppliers.map((sup) => {
              const statusLabel =
                sup.status === 'HALTED'
                  ? `Berhenti (${sup.haltedDays || 14} hari)`
                  : sup.tierType === 'BACKUP' && rfqTriggered && sup.code === 'SUP-16'
                    ? 'RFQ Terkirim'
                    : sup.status === 'STANDBY'
                      ? 'Siaga'
                      : 'Aktif';
              const variant =
                sup.status === 'HALTED'
                  ? 'alert'
                  : sup.status === 'STANDBY'
                    ? 'warn'
                    : 'ok';

              return (
                <tr key={sup.id}>
                  <td className="sc-mono">{sup.code}</td>
                  <td>
                    <strong>{sup.name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{sup.city}</div>
                  </td>
                  <td>{sup.tierType === 'MAIN' ? 'Pemasok Utama' : 'Cadangan Tier-2'}</td>
                  <td>{sup.materialCategory}</td>
                  <td className="sc-num">{sup.leadTimeDays} hari</td>
                  <td className="sc-num">{sup.slaScore}%</td>
                  <td>
                    <StatusPill variant={variant}>{statusLabel}</StatusPill>
                  </td>
                  <td>
                    {sup.tierType === 'MAIN' ? (
                      <button
                        type="button"
                        className="sc-btn-secondary"
                        style={{ padding: '5px 12px', fontSize: 12.5 }}
                        onClick={() =>
                          setPendingAction({
                            type: 'halt',
                            supplierCode: sup.code,
                            supplierName: sup.name,
                            currentlyHalted: sup.status === 'HALTED',
                          })
                        }
                      >
                        {sup.status === 'HALTED' ? 'Pulihkan' : 'Hentikan 14 Hari'}
                      </button>
                    ) : (
                      <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        Pool Cadangan
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sc-split-grid">
        <PaperCard>
          <h3 className="sc-section-head">Terbitkan Purchase Order (Terhubung ROP)</h3>
          <p className="sc-section-desc">
            Buat PO baru saat stok material menyentuh Reorder Point untuk menjaga kelancaran 3
            pabrik.
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
                    {s.code} — {s.name} ({s.tierType})
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
                <option value="Pabrik Cikarang (Utama)">Pabrik Cikarang (Utama)</option>
                <option value="Pabrik Gresik">Pabrik Gresik</option>
                <option value="Pabrik Semarang">Pabrik Semarang</option>
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
          <h3 className="sc-section-head">Persetujuan &amp; Pelacakan Purchase Order</h3>
          <p className="sc-section-desc">
            Setujui draf PO / RFQ cadangan atau tandai penerimaan barang di pabrik.
          </p>

          <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="sc-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>No. PO / RFQ</th>
                  <th>Pemasok</th>
                  <th className="sc-num">Qty</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="sc-mono">
                      <div>{po.poNumber}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                        {po.materialSku}
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

      <ConfirmModal
        open={pendingAction !== null}
        title={
          pendingAction?.type === 'rfq'
            ? 'Picu RFQ Pemasok Cadangan Tier-2?'
            : pendingAction?.currentlyHalted
              ? `Pulihkan Status ${pendingAction.supplierCode}?`
              : `Tandai ${pendingAction?.supplierCode} Berhenti 14 Hari?`
        }
        description={
          pendingAction?.type === 'rfq'
            ? 'Sistem akan memilih pemasok cadangan Tier-2 dengan skor SLA tertinggi, menerbitkan draf RFQ, dan menyesuaikan Reorder Point.'
            : pendingAction?.currentlyHalted
              ? `Pemasok ${pendingAction.supplierName} akan dikembalikan ke status Aktif.`
              : `Pemasok ${pendingAction?.supplierName} akan ditandai berhenti pasokan 14 hari dan tercatat di Audit Log.`
        }
        confirmLabel={pendingAction?.type === 'rfq' ? 'Ya, Kirim RFQ' : 'Ya, Ubah Status'}
        tone="accent"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const act = pendingAction;
          setPendingAction(null);
          if (!act) return;
          if (act.type === 'rfq') {
            void triggerRfqFallback();
          } else {
            void toggleSupplierHalt(act.supplierCode);
          }
        }}
      />
    </div>
  );
}
