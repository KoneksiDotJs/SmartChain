'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { DISRUPTION_SCENARIOS } from '@/lib/mockSnapshot';

export default function RingkasanPage() {
  const router = useRouter();
  const { stressMode, showToast } = useSmartChainMode();
  const [selectedId, setSelectedId] = useState(DISRUPTION_SCENARIOS[0]!.id);

  const current =
    DISRUPTION_SCENARIOS.find((s) => s.id === selectedId) ?? DISRUPTION_SCENARIOS[0]!;

  return (
    <section className="sc-split-grid">
      <div>
        <h2 className="sc-section-head">Skenario Gangguan &amp; Respons Sistem</h2>
        <p className="sc-section-desc">
          Pilih salah satu gangguan di bawah ini untuk melihat mekanisme ketahanan otomatis
          SmartChain.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DISRUPTION_SCENARIOS.map((item) => {
            const isActive = item.id === current.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  backgroundColor: isActive ? 'var(--surface)' : 'var(--surface-warm)',
                  border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: isActive ? 'var(--shadow-paper)' : 'none',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, display: 'block' }}>
                    {item.title}
                  </span>
                  <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {item.domain}
                  </span>
                </div>
                <StatusPill variant={item.badgeVariant}>{item.badge}</StatusPill>
              </button>
            );
          })}
        </div>
      </div>

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
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                margin: 0,
              }}
            >
              {current.title}
            </h3>
            <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              Modul terkait: {current.domain}
            </span>
          </div>
          <StatusPill variant={current.badgeVariant}>{current.badge}</StatusPill>
        </div>

        <div
          className="sc-mono"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
            marginBottom: 16,
            fontSize: 12.5,
          }}
        >
          <div>
            <span
              style={{
                color: 'var(--ink-muted)',
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              {current.metricLabel}
            </span>
            <strong>{current.metricVal}</strong>
          </div>
          <div>
            <span
              style={{
                color: 'var(--ink-muted)',
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              Mode Operasi
            </span>
            <strong>{stressMode ? 'Simulasi Gangguan' : 'Normal'}</strong>
          </div>
        </div>

        <p style={{ margin: '0 0 10px 0' }}>
          <strong>Masalah:</strong> {current.cause}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Respons SmartChain:</strong> {current.action}
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            className="sc-btn-primary"
            onClick={() => {
              showToast(`Membuka modul ${current.domain}`);
              router.push(current.targetPath);
            }}
          >
            {current.ctaLabel}
          </button>
        </div>
      </TactileSheet>
    </section>
  );
}
