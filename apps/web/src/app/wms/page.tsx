'use client';

import React from 'react';
import { WifiOffIcon } from '@/components/ui/Icons';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

export default function WmsPage() {
  const {
    warehouses,
    offlineQueue,
    wh04Offline,
    auditLogs,
    toggleWh04Offline,
    scanWh04Rfid,
    syncOfflineQueue,
    reconcileWh04,
  } = useSmartChainMode();

  const wh04 = warehouses.find((w) => w.warehouseCode === 'WH-04') ?? warehouses[0]!;
  const discrepancy = Math.abs(wh04.rfidQty - wh04.physicalQty);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {wh04.warehouseName} — WMS Edge
              </h2>
              <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                {wh04Offline
                  ? 'Status: Koneksi terputus — menyimpan ke antrean IndexedDB lokal'
                  : 'Status: Terhubung ke Pusat'}
              </span>
            </div>
            <StatusPill variant={wh04Offline ? 'warn' : 'ok'}>
              {wh04Offline ? 'Offline (48 Jam)' : 'Online'}
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
              <strong>{wh04.rfidQty} unit</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Hasil Hitung Fisik
              </span>
              <strong>{wh04.physicalQty} unit</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Antrean Offline (IndexedDB)
              </span>
              <strong>{offlineQueue.length} transaksi</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 12 }}>
                Stok Karantina
              </span>
              <strong>{wh04.quarantineQty} unit</strong>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button type="button" className="sc-btn-secondary" onClick={toggleWh04Offline}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <WifiOffIcon size={15} />
                {wh04Offline ? 'Pulihkan Koneksi' : 'Simulasi Putus 48 Jam'}
              </span>
            </button>
            <button type="button" className="sc-btn-secondary" onClick={() => void scanWh04Rfid(10)}>
              Pindai RFID (+10 unit)
            </button>
            <button type="button" className="sc-btn-primary" onClick={() => void syncOfflineQueue()}>
              Sinkronkan Antrean
            </button>
            <button type="button" className="sc-btn-accent" onClick={() => void reconcileWh04()}>
              Rekonsiliasi Selisih ({discrepancy})
            </button>
          </div>
        </TactileSheet>

        <PaperCard>
          <h3 className="sc-section-head">Log Audit &amp; Sinkronisasi Idempoten</h3>
          <p className="sc-section-desc">
            Setiap pemindaian offline dan rekonsiliasi cycle count memakai{' '}
            <em>idempotency key</em> agar bebas duplikasi (NFR-02).
          </p>

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
            {warehouses.map((w) => (
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
    </div>
  );
}
