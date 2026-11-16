'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { DISRUPTION_SCENARIOS } from '@/lib/mockSnapshot';
import { canAccessRoute, getHomeRouteForRole } from '@/lib/rbac';

const FACTORY_STATUS = [
  { code: 'FAC-01', name: 'Pabrik Cikarang (Utama)', city: 'Bekasi', capacity: 1200, loadNormal: 980, loadStress: 1180, lineStatus: 'Aktif' },
  { code: 'FAC-02', name: 'Pabrik Gresik', city: 'Gresik', capacity: 950, loadNormal: 790, loadStress: 940, lineStatus: 'Aktif' },
  { code: 'FAC-03', name: 'Pabrik Semarang', city: 'Semarang', capacity: 800, loadNormal: 640, loadStress: 785, lineStatus: 'Aktif' },
];

export default function RingkasanPage() {
  const router = useRouter();
  const { session, stressMode, rfqTriggered, showToast } = useSmartChainMode();
  const [selectedId, setSelectedId] = useState(DISRUPTION_SCENARIOS[0]!.id);

  useEffect(() => {
    if (session?.user.role === 'PARTNER') {
      router.replace('/partner');
    } else if (session?.user.role === 'SYSTEM_ADMIN') {
      router.replace('/admin');
    }
  }, [router, session?.user.role]);

  if (!session || session.user.role === 'PARTNER' || session.user.role === 'SYSTEM_ADMIN') {
    return null;
  }

  const role = session.user.role;
  const current =
    DISRUPTION_SCENARIOS.find((s) => s.id === selectedId) ?? DISRUPTION_SCENARIOS[0]!;
  const canOpenTarget = canAccessRoute(role, current.targetPath);
  const myHome = getHomeRouteForRole(role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section className="sc-split-grid">
        <div>
          <h2 className="sc-section-head">Skenario Gangguan &amp; Respons Sistem</h2>
          <p className="sc-section-desc">
            {role === 'DIREKSI'
              ? 'Tinjauan strategis bagaimana SmartChain merespons 6 gangguan ekstrem (mode hanya-baca Direksi).'
              : 'Pilih skenario untuk meninjau respons sistem dan membuka modul operasional yang menjadi wewenang peran Anda.'}
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
            {canOpenTarget ? (
              <button
                type="button"
                className="sc-btn-primary"
                onClick={() => {
                  showToast(`Membuka ${current.domain}`);
                  router.push(current.targetPath);
                }}
              >
                {current.ctaLabel}
              </button>
            ) : (
              <>
                <StatusPill variant="neutral">Dikelola unit operasional terkait</StatusPill>
                {myHome !== '/' && (
                  <button
                    type="button"
                    className="sc-btn-secondary"
                    onClick={() => router.push(myHome)}
                  >
                    Buka Ruang Kerja Peran Saya
                  </button>
                )}
              </>
            )}
          </div>
        </TactileSheet>
      </section>

      {role === 'DIREKSI' && (
        <div className="sc-split-grid">
          <InteractiveBarChart
            title="Kapasitas & Beban Produksi 3 Pabrik"
            subtitle="Perbandingan beban produksi harian terhadap kapasitas maksimum pabrik."
            primaryLabel="Beban Harian"
            secondaryLabel="Kapasitas Maks"
            unitSuffix="unit"
            data={FACTORY_STATUS.map((f) => ({
              id: f.code,
              label: f.code,
              sublabel: f.name,
              primaryValue: stressMode ? f.loadStress : f.loadNormal,
              secondaryValue: f.capacity,
              tone: stressMode && !rfqTriggered && f.code === 'FAC-01' ? 'accent' : 'ink',
              secondaryTone: 'ok',
              note: stressMode && f.code === 'FAC-01' ? 'Menunggu RFQ cadangan' : f.city,
            }))}
          />

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
                  Ringkasan Operasional 3 Pabrik
                </h3>
                <p className="sc-section-desc" style={{ marginBottom: 0 }}>
                  Akses hanya-baca Direksi untuk memantau status lini produksi.
                </p>
              </div>
              <button
                type="button"
                className="sc-btn-secondary"
                onClick={() => router.push('/analytics')}
              >
                Buka Analitik WMA &amp; Audit Log
              </button>
            </div>

            <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
              <table className="sc-table" style={{ minWidth: 440 }}>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Pabrik</th>
                    <th className="sc-num">Kapasitas</th>
                    <th>Status Lini</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTORY_STATUS.map((f) => (
                    <tr key={f.code}>
                      <td className="sc-mono">{f.code}</td>
                      <td>
                        <strong>{f.name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{f.city}</div>
                      </td>
                      <td className="sc-num">{f.capacity} / hari</td>
                      <td>
                        <StatusPill variant={stressMode && f.code === 'FAC-01' ? 'warn' : 'ok'}>
                          {stressMode && f.code === 'FAC-01'
                            ? rfqTriggered
                              ? 'Pasokan Cadangan Aktif'
                              : 'Siaga Pasokan Cadangan'
                            : f.lineStatus}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PaperCard>
        </div>
      )}
    </div>
  );
}
