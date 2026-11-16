'use client';

import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { WifiOffIcon } from '@/components/ui/Icons';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

export default function WmsPage() {
  const {
    warehouses,
    offlineQueue,
    lastSyncedBatch,
    auditLogs,
    toggleWh04Offline,
    scanWh04Rfid,
    syncOfflineQueue,
    replayLastBatchIdempotency,
    reconcileWh04,
  } = useSmartChainMode();

  const [selectedWhCode, setSelectedWhCode] = useState('WH-04');
  const [selectedSku, setSelectedSku] = useState('MAT-01');
  const [scanDirection, setScanDirection] = useState<'IN' | 'OUT' | 'CYCLE_COUNT'>('IN');
  const [scanQty, setScanQty] = useState('10');
  const [reconcileConfirmOpen, setReconcileConfirmOpen] = useState(false);

  const availableSkus = Array.from(new Set(warehouses.map((w) => w.materialSku)));
  const scopedWarehouses = warehouses.filter((w) => w.materialSku === selectedSku);
  const displayedWarehouses = scopedWarehouses.length > 0 ? scopedWarehouses : warehouses;

  const activeWh =
    displayedWarehouses.find((w) => w.warehouseCode === selectedWhCode) ?? displayedWarehouses[0]!;
  const isOffline = activeWh.networkStatus === 'OFFLINE';
  const discrepancy = Math.abs(activeWh.rfidQty - activeWh.physicalQty);
  const whQueueCount = offlineQueue.filter((q) => q.warehouseCode === activeWh.warehouseCode).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InteractiveBarChart
        title={`Akurasi Stok RFID vs Hitung Fisik — ${selectedSku} (8 Gudang)`}
        subtitle="Selisih antara angka RFID dan fisik disorot oranye dan harus dikarantina."
        primaryLabel="Stok RFID"
        secondaryLabel="Hitung Fisik"
        unitSuffix="unit"
        data={displayedWarehouses.map((w) => {
          const diff = Math.abs(w.rfidQty - w.physicalQty);
          return {
            id: w.stockId,
            label: w.warehouseCode,
            sublabel: w.warehouseName,
            primaryValue: w.rfidQty,
            secondaryValue: w.physicalQty,
            tone: diff > 0 ? 'accent' : 'ink',
            secondaryTone: 'ok',
            note:
              diff > 0
                ? `Selisih ${diff} unit terdeteksi (Karantina: ${w.quarantineQty})`
                : w.quarantineQty > 0
                  ? `Karantina diaudit: ${w.quarantineQty} unit`
                  : `${w.city} — Seimbang`,
          };
        })}
      />

      <div className="sc-split-grid">
        <TactileSheet>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              paddingBottom: 14,
              borderBottom: '1px solid var(--border)',
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <label
                htmlFor="wms-wh-select"
                style={{ display: 'block', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}
              >
                Pilih Terminal Gudang Aktif
              </label>
              <select
                id="wms-wh-select"
                className="sc-select"
                value={activeWh.warehouseCode}
                onChange={(e) => setSelectedWhCode(e.target.value)}
              >
                {displayedWarehouses.map((w) => (
                  <option key={w.warehouseCode} value={w.warehouseCode}>
                    {w.warehouseCode} — {w.warehouseName}
                  </option>
                ))}
              </select>
              {availableSkus.length > 1 && (
                <select
                  aria-label="Pilih SKU gudang"
                  className="sc-select"
                  style={{ marginLeft: 8 }}
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                >
                  {availableSkus.map((sku) => (
                    <option key={sku} value={sku}>
                      SKU: {sku}
                    </option>
                  ))}
                </select>
              )}
              <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
                {isOffline
                  ? 'Status: Putus koneksi — menulis ke IndexedDB lokal (Store-and-Forward)'
                  : 'Status: Terhubung ke server pusat'}
              </div>
            </div>
            <StatusPill variant={isOffline ? 'warn' : 'ok'}>
              {isOffline ? 'Offline (48 Jam)' : 'Online'}
            </StatusPill>
          </div>

          <div
            className="sc-mono"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Stok Tercatat RFID
              </span>
              <strong>{activeWh.rfidQty} unit</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Hasil Hitung Fisik
              </span>
              <strong>{activeWh.physicalQty} unit</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Antrean Offline ({activeWh.warehouseCode})
              </span>
              <strong>{whQueueCount} transaksi</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Stok Karantina
              </span>
              <strong>{activeWh.quarantineQty} unit</strong>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const qty = Number(scanQty);
              if (!Number.isFinite(qty) || qty <= 0) return;
              void scanWh04Rfid(Math.round(qty), scanDirection, activeWh.warehouseCode);
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
              gap: 8,
              alignItems: 'end',
              marginBottom: 14,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
              <span>Jenis Mutasi RFID</span>
              <select
                className="sc-select"
                value={scanDirection}
                onChange={(e) => setScanDirection(e.target.value as 'IN' | 'OUT' | 'CYCLE_COUNT')}
              >
                <option value="IN">Barang Masuk (IN)</option>
                <option value="OUT">Barang Keluar (OUT)</option>
                <option value="CYCLE_COUNT">Hitung Fisik (CYCLE_COUNT)</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
              <span>Jumlah (unit)</span>
              <input
                type="number"
                min={1}
                className="sc-input"
                value={scanQty}
                onChange={(e) => setScanQty(e.target.value)}
              />
            </label>

            <button type="submit" className="sc-btn-secondary">
              Pindai RFID
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className="sc-btn-secondary"
              onClick={() => toggleWh04Offline(activeWh.warehouseCode)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <WifiOffIcon size={15} />
                {isOffline ? 'Pulihkan Koneksi' : 'Simulasi Putus 48 Jam'}
              </span>
            </button>
            <button
              type="button"
              className="sc-btn-primary"
              onClick={() => void syncOfflineQueue(activeWh.warehouseCode)}
            >
              Sinkronkan Antrean ({offlineQueue.length})
            </button>
            {lastSyncedBatch.length > 0 && (
              <button
                type="button"
                className="sc-btn-secondary"
                onClick={() => void replayLastBatchIdempotency()}
              >
                Uji Replay Idempotency
              </button>
            )}
            <button
              type="button"
              className="sc-btn-accent"
              onClick={() => {
                if (discrepancy === 0) {
                  void reconcileWh04(activeWh.warehouseCode);
                } else {
                  setReconcileConfirmOpen(true);
                }
              }}
            >
              Rekonsiliasi Selisih ({discrepancy})
            </button>
          </div>
        </TactileSheet>

        <PaperCard>
          <h3 className="sc-section-head">Inspektur Antrean IndexedDB &amp; Audit Log</h3>
          <p className="sc-section-desc">
            Transaksi yang dicatat saat offline disimpan dengan{' '}
            <span className="sc-mono">idempotencyKey</span> dan <span className="sc-mono">offlineTimestamp</span>.
          </p>

          {offlineQueue.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Antrean Menunggu Sinkronisasi ({offlineQueue.length})
              </div>
              <div className="sc-mono" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                {offlineQueue.map((item) => (
                  <div
                    key={item.idempotencyKey}
                    style={{
                      padding: '7px 10px',
                      backgroundColor: 'var(--warn-soft)',
                      border: '1px solid var(--warn-border)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      [{item.warehouseCode}] {item.direction} {item.deltaQty} unit — {item.idempotencyKey}
                    </div>
                    <div style={{ color: 'var(--ink-muted)' }}>{item.offlineTimestamp}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className="sc-mono"
            style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}
          >
            {auditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-warm)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>{log.action}</div>
                <div style={{ color: 'var(--ink-muted)' }}>{log.reason ?? log.entityId}</div>
              </div>
            ))}
          </div>
        </PaperCard>
      </div>

      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Gudang (8 Lokasi)</th>
              <th>Kota</th>
              <th className="sc-num">RFID</th>
              <th className="sc-num">Fisik</th>
              <th className="sc-num">Karantina</th>
              <th>Status Jaringan</th>
            </tr>
          </thead>
          <tbody>
            {displayedWarehouses.map((w) => (
              <tr key={w.stockId}>
                <td className="sc-mono">{w.warehouseCode}</td>
                <td>
                  <strong>{w.warehouseName}</strong>
                </td>
                <td>{w.city}</td>
                <td className="sc-num">{w.rfidQty}</td>
                <td className="sc-num">{w.physicalQty}</td>
                <td className="sc-num">{w.quarantineQty}</td>
                <td>
                  <StatusPill variant={w.networkStatus === 'OFFLINE' ? 'warn' : 'ok'}>
                    {w.networkStatus === 'OFFLINE' ? 'Offline 48 Jam' : 'Online'}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={reconcileConfirmOpen}
        title={`Karantina Selisih Stok ${activeWh.warehouseCode}?`}
        description="Selisih antara pencatatan RFID dan hasil hitung fisik akan dipindahkan ke status Karantina dan dicatat permanen di Immutable Audit Log."
        detailNote={`RFID: ${activeWh.rfidQty} unit | Fisik: ${activeWh.physicalQty} unit | Selisih ke Karantina: ${discrepancy} unit`}
        confirmLabel={`Ya, Karantina ${discrepancy} Unit`}
        tone="accent"
        onCancel={() => setReconcileConfirmOpen(false)}
        onConfirm={() => {
          setReconcileConfirmOpen(false);
          void reconcileWh04(activeWh.warehouseCode);
        }}
      />
    </div>
  );
}
