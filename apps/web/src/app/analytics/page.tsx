'use client';

import React, { useState } from 'react';
import { HybridWmaForecastChart } from '@/components/charts/HybridWmaForecastChart';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { TrendChartIcon } from '@/components/ui/Icons';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

type AuditScope = 'ALL' | 'SRM_PO' | 'WMS' | 'ORDER_TMS';

export default function AnalyticsPage() {
  const { forecasts, auditLogs, stressMode } = useSmartChainMode();
  const [auditScope, setAuditScope] = useState<AuditScope>('ALL');
  const [auditQuery, setAuditQuery] = useState('');

  const surgeFactor = stressMode ? 3 : 1;

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
            Business Analytics: Hybrid WMA Forecasting &amp; Audit Trail
          </h2>
          <p className="sc-section-desc" style={{ marginBottom: 0 }}>
            Menghitung Safety Stock dinamis, Reorder Point (ROP), serta prediksi permintaan adaptif
            saat data historis 3 bulan terakhir tidak lengkap.
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
          <h3 className="sc-section-head">Kelayakan AI Forecasting pada Data Tidak Sempurna</h3>
          <p style={{ margin: '0 0 10px 0' }}>
            Data historis 3 bulan terakhir memiliki 4 interval kosong (
            <span className="sc-mono">M1-W3, M2-W2, M3-W1, M3-W4</span>). Dalam kondisi ini, model
            pembelajaran mesin kompleks berisiko menghasilkan bias tinggi.
          </p>
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>
            SmartChain menerapkan <strong>Weighted Moving Average (WMA) hibrida</strong> dengan
            renormalisasi bobot pada interval valid dan penyesuaian{' '}
            {stressMode ? 'lonjakan permintaan 300%' : 'operasi standar'}.
          </p>
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
