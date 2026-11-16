'use client';

import React, { useState } from 'react';
import { ShieldCheckIcon, TruckRouteIcon } from '@/components/ui/Icons';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export default function TmsPage() {
  const {
    salesOrders,
    shipments,
    stressMode,
    anomalyFilterActive,
    tmsConsolidated,
    toggleAnomalyFilter,
    submitOrderValidation,
    consolidateTmsRoutes,
  } = useSmartChainMode();

  const [distributorCode, setDistributorCode] = useState('DIST-02');
  const [requestedQty, setRequestedQty] = useState('320');
  const [depositConfirmed, setDepositConfirmed] = useState(false);

  const surgeFactor = stressMode ? 1.4 : 1;

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
          <h2 className="sc-section-head">Validasi Pesanan Distributor &amp; Optimasi TMS</h2>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Anomaly Guard menahan pesanan fiktif sebelum penguncian stok dan TMS menggabungkan
            rute searah untuk meredam lonjakan ongkos +40%.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="sc-btn-accent"
            onClick={() => void toggleAnomalyFilter()}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheckIcon size={15} />
              {anomalyFilterActive ? 'Filter Anomali Aktif' : 'Aktifkan Filter Anomali'}
            </span>
          </button>
          <button
            type="button"
            className="sc-btn-primary"
            onClick={() => void consolidateTmsRoutes()}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <TruckRouteIcon size={15} />
              {tmsConsolidated ? 'Rute Terkonsolidasi (-28%)' : 'Konsolidasi Rute TMS'}
            </span>
          </button>
        </div>
      </div>

      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>ID Order</th>
              <th>Distributor</th>
              <th>Tier SLA</th>
              <th className="sc-num">Permintaan</th>
              <th className="sc-num">Kuota Normal</th>
              <th className="sc-num">Alokasi</th>
              <th>Status Validasi</th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.map((order) => {
              const isHeld = order.allocationStatus === 'HELD_ANOMALY';
              const isPending = order.allocationStatus === 'PENDING';
              const variant = isHeld ? 'alert' : isPending ? 'warn' : 'ok';
              const label = isHeld
                ? 'Ditahan (Anomali)'
                : isPending
                  ? 'Antre Manual'
                  : 'Lolos SLA';

              return (
                <tr key={order.id}>
                  <td className="sc-mono">{order.orderNumber}</td>
                  <td>
                    <strong>{order.distributorName}</strong>
                    <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {order.distributorCode} ({order.routeGroup})
                    </div>
                  </td>
                  <td>{order.slaTier}</td>
                  <td className="sc-num">{order.requestedQty} unit</td>
                  <td className="sc-num">{order.monthlyQuota} unit</td>
                  <td className="sc-num">{order.allocatedQty} unit</td>
                  <td>
                    <StatusPill variant={variant}>{label}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sc-split-grid">
        <PaperCard>
          <h3 className="sc-section-head">Uji Order Baru lewat Anomaly Guard</h3>
          <p className="sc-section-desc">
            Pesanan melebihi 150% kuota bulanan tanpa konfirmasi deposit otomatis ditahan sebelum
            mengunci stok.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const qty = Number(requestedQty);
              if (!Number.isFinite(qty) || qty <= 0) return;
              submitOrderValidation(distributorCode, Math.round(qty), depositConfirmed);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Distributor</span>
              <select
                className="sc-select"
                value={distributorCode}
                onChange={(e) => setDistributorCode(e.target.value)}
              >
                <option value="DIST-01">DIST-01 — PT Distribusi Timur (Kuota 130)</option>
                <option value="DIST-02">DIST-02 — CV Sentosa Jaya (Kuota 150)</option>
                <option value="DIST-03">DIST-03 — PT Surya Mandiri (Kuota 110)</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Jumlah Permintaan (unit)</span>
              <input
                type="number"
                min={1}
                className="sc-input"
                value={requestedQty}
                onChange={(e) => setRequestedQty(e.target.value)}
              />
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={depositConfirmed}
                onChange={(e) => setDepositConfirmed(e.target.checked)}
              />
              <span>Konfirmasi deposit terverifikasi</span>
            </label>

            <button type="submit" className="sc-btn-primary" style={{ alignSelf: 'flex-start' }}>
              Validasi &amp; Alokasikan Order
            </button>
          </form>
        </PaperCard>

        <PaperCard>
          <h3 className="sc-section-head">Jadwal Muatan &amp; Konsolidasi Rute TMS</h3>
          <p className="sc-section-desc">
            {stressMode
              ? 'Mode simulasi aktif (+40% tarif ekspedisi diterapkan sebelum konsolidasi).'
              : 'Menggabungkan pengiriman searah per koridor distribusi.'}
          </p>

          <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="sc-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Resi</th>
                  <th>Koridor</th>
                  <th>Status</th>
                  <th className="sc-num">Biaya Kirim</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shp) => {
                  const displayedCost = shp.isConsolidated
                    ? shp.consolidatedCost
                    : Math.round(shp.baseCost * surgeFactor);
                  return (
                    <tr key={shp.id}>
                      <td className="sc-mono">{shp.shipmentNumber}</td>
                      <td>
                        <div>{shp.routeGroup}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                          {shp.distributorName}
                        </div>
                      </td>
                      <td>
                        <StatusPill variant={shp.isConsolidated ? 'ok' : 'warn'}>
                          {shp.isConsolidated ? 'Terkonsolidasi' : 'Terjadwal'}
                        </StatusPill>
                      </td>
                      <td className="sc-num">{formatIdr(displayedCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PaperCard>
      </div>
    </div>
  );
}
