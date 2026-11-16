'use client';

import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { DISTRIBUTOR_DIRECTORY } from '@/lib/mockSnapshot';

export default function PartnerPortalPage() {
  const {
    session,
    purchaseOrders,
    salesOrders,
    shipments,
    updatePoStatus,
    submitOrderValidation,
  } = useSmartChainMode();

  const [orderQty, setOrderQty] = useState('100');
  const [depositConfirmed, setDepositConfirmed] = useState(false);

  if (!session) return null;

  const entityCode = session.user.entityCode ?? 'SUP-01';
  const isSupplierPartner = entityCode.startsWith('SUP-');

  if (isSupplierPartner) {
    const myPurchaseOrders = purchaseOrders.filter((po) => po.supplierCode === entityCode);
    const slaHistory = [
      { id: 'm1', label: 'Jun', sublabel: 'Pengiriman Juni', primaryValue: 94, thresholdValue: 90, tone: 'ink' as const, note: 'Tepat waktu' },
      { id: 'm2', label: 'Jul', sublabel: 'Pengiriman Juli', primaryValue: 97, thresholdValue: 90, tone: 'ok' as const, note: 'Melampaui target SLA' },
      { id: 'm3', label: 'Agu', sublabel: 'Pengiriman Agustus', primaryValue: 95, thresholdValue: 90, tone: 'ink' as const, note: 'Tepat waktu' },
      { id: 'm4', label: 'Sep', sublabel: 'Pengiriman September', primaryValue: 96, thresholdValue: 90, tone: 'ok' as const, note: 'Melampaui target SLA' },
      { id: 'm5', label: 'Okt', sublabel: 'Pengiriman Oktober', primaryValue: 92, thresholdValue: 90, tone: 'ink' as const, note: 'Tepat waktu' },
      { id: 'm6', label: 'Nov', sublabel: 'Bulan Berjalan', primaryValue: 96, thresholdValue: 90, tone: 'ok' as const, note: 'Skor kontrak aktif' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <InteractiveBarChart
          title={`Rapor Kinerja SLA Pemasok (${entityCode})`}
          subtitle="Riwayat ketepatan pengiriman 6 bulan terakhir dibanding target minimal 90%."
          primaryLabel="Skor SLA (%)"
          thresholdLabel="Batas Minimal SLA"
          unitSuffix="%"
          data={slaHistory}
        />

        <TactileSheet>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <h2 className="sc-section-head" style={{ marginBottom: 2 }}>
                Daftar Purchase Order &amp; RFQ Khusus {entityCode}
              </h2>
              <p className="sc-section-desc" style={{ marginBottom: 0 }}>
                Anda hanya dapat melihat dan mengonfirmasi PO/RFQ yang ditujukan ke entitas pemasok
                Anda.
              </p>
            </div>
            <StatusPill variant="ok">Portal Pemasok Terisolasi</StatusPill>
          </div>

          <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="sc-table">
              <thead>
                <tr>
                  <th>No. Dokumen</th>
                  <th>Material</th>
                  <th>Pabrik Tujuan</th>
                  <th className="sc-num">Kuantitas</th>
                  <th>Tipe</th>
                  <th>Status</th>
                  <th>Konfirmasi Mitra</th>
                </tr>
              </thead>
              <tbody>
                {myPurchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: 'var(--ink-muted)' }}>
                      Belum ada PO atau RFQ aktif untuk entitas {entityCode}.
                    </td>
                  </tr>
                ) : (
                  myPurchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="sc-mono">{po.poNumber}</td>
                      <td>{po.materialName}</td>
                      <td>{po.factoryName}</td>
                      <td className="sc-num">{po.quantity} unit</td>
                      <td>
                        <StatusPill variant={po.isRfqFallback ? 'warn' : 'neutral'}>
                          {po.isRfqFallback ? 'RFQ Cadangan' : 'PO Reguler'}
                        </StatusPill>
                      </td>
                      <td>
                        <StatusPill variant={po.status === 'IN_TRANSIT' || po.status === 'APPROVED' ? 'ok' : 'warn'}>
                          {po.status}
                        </StatusPill>
                      </td>
                      <td>
                        {po.status === 'DRAFT_RFQ' || po.status === 'PENDING_APPROVAL' ? (
                          <button
                            type="button"
                            className="sc-btn-primary"
                            style={{ padding: '5px 12px', fontSize: 12.5 }}
                            onClick={() => void updatePoStatus(po.id, 'APPROVED')}
                          >
                            Konfirmasi Kesanggupan
                          </button>
                        ) : po.status === 'APPROVED' ? (
                          <button
                            type="button"
                            className="sc-btn-accent"
                            style={{ padding: '5px 12px', fontSize: 12.5 }}
                            onClick={() => void updatePoStatus(po.id, 'IN_TRANSIT')}
                          >
                            Kirim Bahan (In-Transit)
                          </button>
                        ) : (
                          <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                            Terkonfirmasi
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TactileSheet>
      </div>
    );
  }

  // Distributor Partner View (strictly scoped to entityCode, e.g. DIST-01)
  const myOrders = salesOrders.filter((o) => o.distributorCode === entityCode);
  const myShipments = shipments.filter((s) =>
    myOrders.some((o) => o.orderNumber === s.orderNumber),
  );
  const directoryDist = DISTRIBUTOR_DIRECTORY.find((d) => d.code === entityCode);
  const quota = myOrders[0]?.monthlyQuota ?? directoryDist?.monthlyQuota ?? 130;
  const anomalyThreshold = Math.round(quota * 1.5);
  const draftQty = Math.max(0, Number(orderQty) || 0);
  const willTriggerGuard = draftQty > anomalyThreshold && !depositConfirmed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InteractiveBarChart
        title={`Simulasi Kuota & Ambang Anomaly Guard (${entityCode})`}
        subtitle="Grafik ini bergerak otomatis saat Anda mengetik jumlah pesanan di bawah."
        primaryLabel="Volume Order"
        secondaryLabel="Kuota Normal"
        thresholdLabel="Batas 150% Anomaly Guard"
        unitSuffix="unit"
        data={[
          {
            id: 'draft-preview',
            label: 'Draf Baru',
            sublabel: 'Pesanan yang sedang Anda ketik',
            primaryValue: draftQty,
            secondaryValue: quota,
            thresholdValue: anomalyThreshold,
            tone: willTriggerGuard ? 'accent' : 'ok',
            secondaryTone: 'ink',
            note: willTriggerGuard
              ? 'Melebihi 150% kuota tanpa deposit (akan ditahan)'
              : 'Lolos ambang batas Anomaly Guard',
          },
          ...myOrders.slice(0, 4).map((o) => ({
            id: o.id,
            label: o.orderNumber,
            sublabel: `Status: ${o.allocationStatus}`,
            primaryValue: o.requestedQty,
            secondaryValue: o.allocatedQty,
            thresholdValue: anomalyThreshold,
            tone: o.allocationStatus === 'HELD_ANOMALY' ? ('accent' as const) : ('ink' as const),
            secondaryTone: 'ok' as const,
            note: `${o.requestedQty} diminta vs ${o.allocatedQty} dialokasikan`,
          })),
        ]}
      />

      <div className="sc-split-grid">
        <TactileSheet>
          <h2 className="sc-section-head">Ajukan Pesanan Pengisian Stok ({entityCode})</h2>
          <p className="sc-section-desc">
            Kuota historis bulanan Anda adalah <strong>{quota} unit</strong> (ambang bebas penahanan{' '}
            <strong>{anomalyThreshold} unit</strong>).
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const qty = Number(orderQty);
              if (!Number.isFinite(qty) || qty <= 0) return;
              void submitOrderValidation(entityCode, Math.round(qty), depositConfirmed);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Jumlah Pesanan (unit)</span>
              <input
                type="number"
                min={1}
                className="sc-input"
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
              />
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={depositConfirmed}
                onChange={(e) => setDepositConfirmed(e.target.checked)}
              />
              <span>Sertakan bukti konfirmasi deposit (untuk order besar)</span>
            </label>

            {willTriggerGuard && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 10,
                  backgroundColor: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--accent)',
                  fontSize: 12.5,
                }}
              >
                Peringatan: Jumlah {draftQty} unit melebihi 150% kuota ({anomalyThreshold} unit).
                Centang bukti deposit atau kurangi jumlah agar tidak ditahan Anomaly Guard.
              </div>
            )}

            <button type="submit" className="sc-btn-primary" style={{ alignSelf: 'flex-start' }}>
              Kirim Pesanan Saya
            </button>
          </form>
        </TactileSheet>

        <PaperCard>
          <h3 className="sc-section-head">Pelacakan Pengiriman Saya ({entityCode})</h3>
          <p className="sc-section-desc">
            Menampilkan resi TMS milik entitas Anda secara terisolasi.
          </p>

          <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="sc-table" style={{ minWidth: 440 }}>
              <thead>
                <tr>
                  <th>No. Resi</th>
                  <th>No. Order</th>
                  <th>Ekspedisi</th>
                  <th>Status TMS</th>
                </tr>
              </thead>
              <tbody>
                {myShipments.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: 'var(--ink-muted)' }}>
                      Belum ada pengiriman aktif untuk {entityCode}.
                    </td>
                  </tr>
                ) : (
                  myShipments.map((s) => (
                    <tr key={s.id}>
                      <td className="sc-mono">{s.shipmentNumber}</td>
                      <td className="sc-mono">{s.orderNumber}</td>
                      <td>{s.carrierName}</td>
                      <td>
                        <StatusPill variant={s.isConsolidated ? 'ok' : 'warn'}>
                          {s.trackingStatus}
                        </StatusPill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PaperCard>
      </div>

      <PaperCard>
        <h3 className="sc-section-head">Riwayat Pesanan Saya ({entityCode})</h3>
        <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="sc-table">
            <thead>
              <tr>
                <th>No. Order</th>
                <th className="sc-num">Diminta</th>
                <th className="sc-num">Dialokasikan</th>
                <th>Status Validasi</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {myOrders.map((o) => (
                <tr key={o.id}>
                  <td className="sc-mono">{o.orderNumber}</td>
                  <td className="sc-num">{o.requestedQty} unit</td>
                  <td className="sc-num">{o.allocatedQty} unit</td>
                  <td>
                    <StatusPill
                      variant={
                        o.allocationStatus === 'HELD_ANOMALY'
                          ? 'alert'
                          : o.allocationStatus === 'APPROVED_SLA'
                            ? 'ok'
                            : 'warn'
                      }
                    >
                      {o.allocationStatus}
                    </StatusPill>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                    {o.anomalyReason ?? 'Lolos validasi kuota & prioritas SLA'}
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
