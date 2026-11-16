'use client';

import React from 'react';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

export default function SrmPage() {
  const { suppliers, purchaseOrders, rfqTriggered, triggerRfqFallback } = useSmartChainMode();

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
            Pengalihan otomatis ke pemasok cadangan Tier-2 saat pemasok utama berhenti 14 hari
            beserta penyesuaian Reorder Point (ROP).
          </p>
        </div>

        <button
          type="button"
          className="sc-btn-accent"
          onClick={() => void triggerRfqFallback()}
        >
          {rfqTriggered ? 'RFQ Cadangan Aktif' : 'Picu RFQ Pemasok Cadangan'}
        </button>
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
            </tr>
          </thead>
          <tbody>
            {suppliers.map((sup) => {
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaperCard>
        <h3 className="sc-section-head">Daftar Purchase Order &amp; Auto-RFQ</h3>
        <p className="sc-section-desc">
          PO terhubung langsung dengan ambang batas ROP bahan baku untuk 3 pabrik PT Nusantara
          Manufacturing.
        </p>

        <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="sc-table">
            <thead>
              <tr>
                <th>No. PO / RFQ</th>
                <th>Pemasok</th>
                <th>Material</th>
                <th>Pabrik Tujuan</th>
                <th className="sc-num">Kuantitas</th>
                <th>Tipe</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td className="sc-mono">{po.poNumber}</td>
                  <td>
                    <strong>{po.supplierName}</strong>
                    <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {po.supplierCode}
                    </div>
                  </td>
                  <td>{po.materialName}</td>
                  <td>{po.factoryName}</td>
                  <td className="sc-num">{po.quantity} unit</td>
                  <td>
                    <StatusPill variant={po.isRfqFallback ? 'warn' : 'neutral'}>
                      {po.isRfqFallback ? 'RFQ Fallback' : 'PO Reguler'}
                    </StatusPill>
                  </td>
                  <td>
                    <StatusPill variant={po.status === 'APPROVED' ? 'ok' : 'warn'}>
                      {po.status}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PaperCard>
    </div>
  );
}
