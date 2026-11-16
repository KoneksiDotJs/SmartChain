'use client';

import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ShieldCheckIcon, TruckRouteIcon } from '@/components/ui/Icons';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { DISTRIBUTOR_DIRECTORY } from '@/lib/mockSnapshot';

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
    verifyAndApproveOrder,
    rejectOrder,
    runSlaSurgeAllocation,
    submitOrderValidation,
    consolidateTmsRoutes,
  } = useSmartChainMode();

  const [distributorCode, setDistributorCode] = useState('DIST-02');
  const [requestedQty, setRequestedQty] = useState('320');
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [surgeStockCap, setSurgeStockCap] = useState('280');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'TIER_1' | 'TIER_2' | 'TIER_3'>('ALL');
  const [pendingRejectOrder, setPendingRejectOrder] = useState<{
    id: string;
    orderNumber: string;
    distributorName: string;
    requestedQty: number;
  } | null>(null);

  const surgeFactor = stressMode ? 1.4 : 1;

  // Group shipping costs by routeGroup for the TMS cost comparison chart
  const routeGroups = ['JAWA_BARAT', 'JAWA_TIMUR'] as const;
  const routeCostData = routeGroups.map((rg) => {
    const groupShipments = shipments.filter((s) => s.routeGroup === rg);
    const originalTotal = groupShipments.reduce(
      (sum, s) => sum + Math.round(s.baseCost * surgeFactor),
      0,
    );
    const consolidatedTotal = groupShipments.reduce(
      (sum, s) => sum + (s.isConsolidated ? s.consolidatedCost : Math.round(s.baseCost * surgeFactor)),
      0,
    );
    return {
      id: rg,
      label: rg.replace('_', ' '),
      sublabel: `Koridor ${rg} (${groupShipments.length} muatan)`,
      primaryValue: originalTotal,
      secondaryValue: consolidatedTotal,
      tone: stressMode ? ('warn' as const) : ('ink' as const),
      secondaryTone: 'ok' as const,
      note: tmsConsolidated
        ? `Hemat ${formatIdr(originalTotal - consolidatedTotal)}`
        : 'Belum dikonsolidasikan',
    };
  });

  const visibleDistributors = DISTRIBUTOR_DIRECTORY.filter((d) =>
    tierFilter === 'ALL' ? true : d.slaTier === tierFilter,
  );

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
            Anomaly Guard menahan order fiktif &gt;150% kuota, alokasi memprioritaskan SLA Tier-1
            saat lonjakan +300%, dan TMS menggabungkan rute searah.
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

      <div className="sc-split-grid">
        <InteractiveBarChart
          title="Anomaly Guard: Volume Order vs Batas 150% Kuota"
          subtitle="Pesanan yang menembus garis putus-putus tanpa deposit ditahan otomatis."
          primaryLabel="Permintaan"
          secondaryLabel="Dialokasikan"
          thresholdLabel="Batas 150% Kuota"
          unitSuffix="unit"
          data={salesOrders.map((o) => {
            const limit150 = Math.round(o.monthlyQuota * 1.5);
            const overLimit = o.requestedQty > limit150 && !o.depositConfirmed;
            return {
              id: o.id,
              label: o.orderNumber,
              sublabel: `${o.distributorName} (${o.slaTier})`,
              primaryValue: o.requestedQty,
              secondaryValue: o.allocatedQty,
              thresholdValue: limit150,
              tone: overLimit ? 'accent' : 'ink',
              secondaryTone: 'ok',
              note: overLimit ? 'Melebihi 150% kuota tanpa deposit' : 'Dalam batas aman',
            };
          })}
        />

        <InteractiveBarChart
          title="Biaya Kirim TMS Sebelum vs Sesudah Konsolidasi"
          subtitle="Penggabungan muatan searah menekan lonjakan biaya ekspedisi +40%."
          primaryLabel="Biaya Sebelum"
          secondaryLabel="Setelah Konsolidasi"
          formatValue={formatIdr}
          data={routeCostData}
        />
      </div>

      <PaperCard>
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
            <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
              Simulasi Alokasi Prioritas SLA (Lonjakan Permintaan +300%)
            </h3>
            <p className="sc-section-desc" style={{ marginBottom: 0 }}>
              Saat pasokan terbatas, sistem memfilter anomali terlebih dahulu lalu mengunci stok
              untuk Tier-1 sebelum Tier-2/3.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={50}
              className="sc-input"
              style={{ width: 110 }}
              aria-label="Stok tersedia untuk simulasi SLA"
              value={surgeStockCap}
              onChange={(e) => setSurgeStockCap(e.target.value)}
            />
            <button
              type="button"
              className="sc-btn-primary"
              onClick={() => void runSlaSurgeAllocation(Number(surgeStockCap) || 280)}
            >
              Jalankan Alokasi SLA
            </button>
          </div>
        </div>
      </PaperCard>

      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>ID Order</th>
              <th>Distributor</th>
              <th>Tier SLA</th>
              <th className="sc-num">Permintaan</th>
              <th className="sc-num">Kuota</th>
              <th className="sc-num">Rasio</th>
              <th className="sc-num">Alokasi</th>
              <th>Status Validasi</th>
              <th>Aksi Logistik</th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.map((order) => {
              const isHeld = order.allocationStatus === 'HELD_ANOMALY';
              const isPending = order.allocationStatus === 'PENDING';
              const isPartial = order.allocationStatus === 'PARTIAL_ALLOCATED';
              const variant = isHeld ? 'alert' : isPending || isPartial ? 'warn' : 'ok';
              const label = isHeld
                ? 'Ditahan (Anomali)'
                : isPending
                  ? 'Antre Manual'
                  : isPartial
                    ? 'Alokasi Parsial'
                    : 'Lolos SLA';
              const ratioPct = Math.round((order.requestedQty / Math.max(1, order.monthlyQuota)) * 100);

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
                  <td className="sc-num">{order.requestedQty}</td>
                  <td className="sc-num">{order.monthlyQuota}</td>
                  <td className="sc-num">{ratioPct}%</td>
                  <td className="sc-num">{order.allocatedQty}</td>
                  <td>
                    <StatusPill variant={variant}>{label}</StatusPill>
                  </td>
                  <td>
                    {(isHeld || isPending) && !order.depositConfirmed ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="sc-btn-secondary"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => void verifyAndApproveOrder(order.id)}
                        >
                          Verifikasi Deposit
                        </button>
                        <button
                          type="button"
                          className="sc-btn-accent"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() =>
                            setPendingRejectOrder({
                              id: order.id,
                              orderNumber: order.orderNumber,
                              distributorName: order.distributorName,
                              requestedQty: order.requestedQty,
                            })
                          }
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        Terverifikasi
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
              void submitOrderValidation(distributorCode, Math.round(qty), depositConfirmed);
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
                {DISTRIBUTOR_DIRECTORY.slice(0, 8).map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name} (Kuota {d.monthlyQuota})
                  </option>
                ))}
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
                      <td className="sc-mono">
                        <div>{shp.shipmentNumber}</div>
                        {shp.consolidationBatchId && (
                          <div style={{ fontSize: 11, color: 'var(--ok)' }}>
                            {shp.consolidationBatchId}
                          </div>
                        )}
                      </td>
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

      <PaperCard>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
              Direktori 25 Distributor &amp; Peringkat SLA
            </h3>
            <p className="sc-section-desc" style={{ marginBottom: 0 }}>
              Acuan kuota historis, batas kredit, dan prioritas alokasi per mitra penyaluran.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['ALL', 'TIER_1', 'TIER_2', 'TIER_3'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                className={tierFilter === tier ? 'sc-btn-primary' : 'sc-btn-secondary'}
                style={{ padding: '5px 12px', fontSize: 12.5 }}
                onClick={() => setTierFilter(tier)}
              >
                {tier === 'ALL' ? 'Semua (25)' : tier}
              </button>
            ))}
          </div>
        </div>

        <div className="sc-table-wrap" style={{ boxShadow: 'none', maxHeight: 280, overflowY: 'auto' }}>
          <table className="sc-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Distributor</th>
                <th>Koridor</th>
                <th>Tier</th>
                <th className="sc-num">Skor SLA</th>
                <th className="sc-num">Kuota/Bln</th>
                <th className="sc-num">Sisa Kredit</th>
              </tr>
            </thead>
            <tbody>
              {visibleDistributors.map((d) => (
                <tr key={d.code}>
                  <td className="sc-mono">{d.code}</td>
                  <td>
                    <strong>{d.name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{d.city}</div>
                  </td>
                  <td className="sc-mono" style={{ fontSize: 12 }}>{d.routeGroup}</td>
                  <td>
                    <StatusPill
                      variant={
                        d.slaTier === 'TIER_1' ? 'ok' : d.slaTier === 'TIER_2' ? 'warn' : 'neutral'
                      }
                    >
                      {d.slaTier}
                    </StatusPill>
                  </td>
                  <td className="sc-num">{d.slaScore}%</td>
                  <td className="sc-num">{d.monthlyQuota} unit</td>
                  <td className="sc-num">{formatIdr(d.creditLimit - d.usedCredit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PaperCard>

      <ConfirmModal
        open={pendingRejectOrder !== null}
        title={`Tolak Permanen ${pendingRejectOrder?.orderNumber}?`}
        description={`Pesanan dari ${pendingRejectOrder?.distributorName} (${pendingRejectOrder?.requestedQty} unit) akan ditahan permanen dengan alokasi 0 unit dan dicatat di Audit Log.`}
        confirmLabel="Ya, Tolak Permanen"
        tone="accent"
        onCancel={() => setPendingRejectOrder(null)}
        onConfirm={() => {
          const target = pendingRejectOrder;
          setPendingRejectOrder(null);
          if (target) rejectOrder(target.id);
        }}
      />
    </div>
  );
}
