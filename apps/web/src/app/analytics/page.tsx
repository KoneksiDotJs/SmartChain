'use client';

import React, { useState } from 'react';
import { HybridWmaForecastChart } from '@/components/charts/HybridWmaForecastChart';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { TrendChartIcon } from '@/components/ui/Icons';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { DISTRIBUTOR_DIRECTORY } from '@/lib/mockSnapshot';

type AuditScope = 'ALL' | 'SRM_PO' | 'WMS' | 'ORDER_TMS';

export default function AnalyticsPage() {
  const { forecasts, auditLogs, suppliers, purchaseOrders, salesOrders, shipments, stressMode } =
    useSmartChainMode();
  const [auditScope, setAuditScope] = useState<AuditScope>('ALL');
  const [auditQuery, setAuditQuery] = useState('');

  const surgeFactor = stressMode ? 3 : 1;

  // Evaluate Supplier Performance Scorecard
  const supplierEval = suppliers.map((s) => {
    const onTimeRate =
      s.status === 'HALTED' ? Math.max(40, Math.round(s.slaScore - s.haltedDays * 2.5)) : s.slaScore;
    const leadEfficiency = Math.max(60, 100 - (s.leadTimeDays - 2) * 8);
    const composite = Number((s.slaScore * 0.55 + onTimeRate * 0.3 + leadEfficiency * 0.15).toFixed(1));
    const grade = composite >= 92 ? 'A' : composite >= 84 ? 'B' : 'C';
    const poCount = purchaseOrders.filter((p) => p.supplierCode === s.code).length;
    return { ...s, onTimeRate, composite, grade, poCount };
  });

  // Evaluate Distribution Corridor Performance
  const corridors = ['JAWA_BARAT', 'JAWA_TENGAH', 'JAWA_TIMUR', 'LUAR_JAWA'] as const;
  const distributionEval = corridors.map((rg) => {
    const distCount = DISTRIBUTOR_DIRECTORY.filter((d) => d.routeGroup === rg).length;
    const ordInRoute = salesOrders.filter((o) => o.routeGroup === rg);
    const shpInRoute = shipments.filter((sh) => sh.routeGroup === rg);
    const reqUnits = ordInRoute.reduce((sum, o) => sum + o.requestedQty, 0);
    const allocUnits = ordInRoute.reduce((sum, o) => sum + o.allocatedQty, 0);
    const fulfillmentPct = reqUnits <= 0 ? 100 : Number(((allocUnits / reqUnits) * 100).toFixed(1));
    const baseCost = shpInRoute.reduce((sum, sh) => sum + sh.baseCost, 0);
    const effCost = shpInRoute.reduce(
      (sum, sh) => sum + (sh.isConsolidated ? sh.consolidatedCost : sh.baseCost),
      0,
    );
    const savingsPct =
      baseCost <= 0 ? 0 : Number((((baseCost - effCost) / baseCost) * 100).toFixed(1));
    return {
      routeGroup: rg,
      distCount,
      ordersCount: ordInRoute.length,
      anomaliesCount: ordInRoute.filter((o) => o.anomalyFlag).length,
      fulfillmentPct,
      savingsPct,
    };
  });

  const filteredLogs = auditLogs.filter((log) => {
    const matchesScope =
      auditScope === 'ALL'
        ? true
        : auditScope === 'SRM_PO'
          ? log.entityType === 'Supplier' || log.entityType === 'PurchaseOrder'
          : auditScope === 'WMS'
            ? log.entityType === 'Warehouse' ||
              log.entityType === 'InventoryStock' ||
              log.entityType === 'RfidSyncLog'
            : log.entityType === 'SalesOrder' ||
              log.entityType === 'SalesOrderBatch' ||
              log.entityType === 'ShipmentBatch';
    const q = auditQuery.trim().toLowerCase();
    const matchesText =
      !q ||
      log.action.toLowerCase().includes(q) ||
      (log.reason ?? '').toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q);
    return matchesScope && matchesText;
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
          <h2 className="sc-section-head">
            Business Analytics: Kebutuhan Bahan, Forecasting &amp; Evaluasi Kinerja
          </h2>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Menghitung kebutuhan bahan baku, Safety Stock dinamis, ROP, proyeksi Hybrid WMA, serta
            rapor kinerja pemasok dan koridor distribusi.
          </p>
        </div>
        <StatusPill variant="warn">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TrendChartIcon size={14} />
            Kelengkapan Historis: 66.7% (WMA Hibrida)
          </span>
        </StatusPill>
      </div>

      <div className="sc-split-grid">
        <HybridWmaForecastChart materials={forecasts} surgeFactor={surgeFactor} />

        <InteractiveBarChart
          title="Stok Fisik vs Batas Reorder Point (ROP)"
          subtitle="Material dengan batang di bawah garis putus-putus wajib segera dibuatkan PO."
          primaryLabel="Stok Fisik"
          secondaryLabel="Safety Stock"
          thresholdLabel="Batas ROP"
          unitSuffix="unit"
          data={forecasts.map((item) => ({
            id: item.materialId,
            label: item.sku,
            sublabel: item.name,
            primaryValue: item.currentStock,
            secondaryValue: item.dynamicSafetyStock,
            thresholdValue: item.reorderPoint,
            tone: item.needsProcurement ? 'accent' : 'ink',
            secondaryTone: 'warn',
            note: item.needsProcurement
              ? `Di bawah ROP — rekomendasikan PO +${item.recommendedOrderQty}`
              : 'Aman di atas ROP',
          }))}
        />
      </div>

      <div className="sc-split-grid">
        <InteractiveBarChart
          title="Evaluasi Kinerja Pemasok (Skor Komposit)"
          subtitle="Gabungan SLA (55%), ketepatan kirim (30%), dan efisiensi lead time (15%)."
          primaryLabel="Skor Komposit"
          secondaryLabel="On-Time (%)"
          thresholdLabel="Standar Grade A (92)"
          data={supplierEval.slice(0, 10).map((s) => ({
            id: s.code,
            label: s.code,
            sublabel: `${s.name} (Grade ${s.grade})`,
            primaryValue: Math.round(s.composite),
            secondaryValue: s.onTimeRate,
            thresholdValue: 92,
            tone: s.status === 'HALTED' ? 'accent' : s.grade === 'A' ? 'ok' : 'ink',
            secondaryTone: 'warn',
            note: `${s.materialCategory} | PO: ${s.poCount} | Lead ${s.leadTimeDays} hr`,
          }))}
        />

        <InteractiveBarChart
          title="Evaluasi Kinerja Koridor Distribusi"
          subtitle="Tingkat pemenuhan order SLA (%) dan penghematan biaya konsolidasi TMS (%)."
          primaryLabel="Pemenuhan Order (%)"
          secondaryLabel="Hemat Ongkos TMS (%)"
          unitSuffix="%"
          data={distributionEval.map((c) => ({
            id: c.routeGroup,
            label: c.routeGroup.replace('_', ' '),
            sublabel: `${c.routeGroup} (${c.distCount} distributor)`,
            primaryValue: Math.round(c.fulfillmentPct),
            secondaryValue: Math.round(c.savingsPct),
            tone: c.anomaliesCount > 0 ? 'warn' : 'ok',
            secondaryTone: 'ink',
            note: `${c.ordersCount} order | ${c.anomaliesCount} anomali ditahan`,
          }))}
        />
      </div>

      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Material / Produk</th>
              <th className="sc-num">Stok Fisik</th>
              <th className="sc-num">Safety Stock</th>
              <th className="sc-num">ROP</th>
              <th className="sc-num">Prediksi WMA</th>
              <th>Status Pengadaan</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((item) => (
              <tr key={item.materialId}>
                <td className="sc-mono">{item.sku}</td>
                <td>
                  <strong>{item.name}</strong>
                  <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    Interval valid: {item.forecast.validIntervals}/{item.forecast.totalIntervals} (
                    {item.forecast.completenessPercent}%)
                  </div>
                </td>
                <td className="sc-num">{item.currentStock}</td>
                <td className="sc-num">{item.dynamicSafetyStock}</td>
                <td className="sc-num">{item.reorderPoint}</td>
                <td className="sc-num">{item.forecast.forecastNextPeriod}</td>
                <td>
                  <StatusPill variant={item.needsProcurement ? 'alert' : 'ok'}>
                    {item.needsProcurement
                      ? `Perlu PO (+${item.recommendedOrderQty})`
                      : 'Aman di atas ROP'}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sc-split-grid">
        <PaperCard>
          <h3 className="sc-section-head">Ringkasan Evaluasi Kinerja Pemasok &amp; Distribusi</h3>
          <div className="sc-table-wrap" style={{ boxShadow: 'none', maxHeight: 280, overflowY: 'auto' }}>
            <table className="sc-table" style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th>Entitas</th>
                  <th className="sc-num">Skor</th>
                  <th>Grade / Efisiensi</th>
                </tr>
              </thead>
              <tbody>
                {supplierEval.slice(0, 6).map((s) => (
                  <tr key={s.code}>
                    <td>
                      <strong className="sc-mono">{s.code}</strong> — {s.name}
                    </td>
                    <td className="sc-num">{s.composite}</td>
                    <td>
                      <StatusPill variant={s.grade === 'A' ? 'ok' : s.grade === 'B' ? 'warn' : 'alert'}>
                        Grade {s.grade}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaperCard>

        <PaperCard>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div>
              <h3 className="sc-section-head" style={{ marginBottom: 2 }}>
                Immutable Audit Log ({filteredLogs.length})
              </h3>
              <p className="sc-section-desc" style={{ marginBottom: 0 }}>
                Filter jejak audit permanen berdasarkan modul atau kata kunci.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <select
              className="sc-select"
              aria-label="Filter modul audit"
              value={auditScope}
              onChange={(e) => setAuditScope(e.target.value as AuditScope)}
            >
              <option value="ALL">Semua Modul</option>
              <option value="SRM_PO">SRM &amp; PO</option>
              <option value="WMS">WMS &amp; Offline</option>
              <option value="ORDER_TMS">Order &amp; TMS</option>
            </select>
            <input
              type="search"
              className="sc-input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder="Cari aksi atau alasan..."
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
            />
          </div>

          <div
            className="sc-mono"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-warm)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{log.action}</strong>
                  <span style={{ color: 'var(--ink-muted)' }}>{log.actorRole}</span>
                </div>
                <div style={{ color: 'var(--ink-muted)' }}>{log.reason ?? log.entityId}</div>
              </div>
            ))}
          </div>
        </PaperCard>
      </div>
    </div>
  );
}
