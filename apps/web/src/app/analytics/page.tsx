'use client';

import React from 'react';
import { TrendChartIcon } from '@/components/ui/Icons';
import { PaperCard } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';

export default function AnalyticsPage() {
  const { forecasts, auditLogs, stressMode } = useSmartChainMode();

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
          <h3 className="sc-section-head">Immutable Audit Log (Append-Only)</h3>
          <p className="sc-section-desc">
            Seluruh mutasi stok, karantina selisih, auto-RFQ, dan penahanan order anomali tercatat
            permanen.
          </p>

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
            {auditLogs.map((log) => (
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
