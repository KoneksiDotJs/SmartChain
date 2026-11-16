'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { ShieldCheckIcon, SmartChainLogoIcon } from '@/components/ui/Icons';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import {
  DISTRIBUTOR_DIRECTORY,
  INITIAL_SUPPLIERS,
  getPartnerEmailForCode,
} from '@/lib/mockSnapshot';
import { DEMO_ACCOUNT_PRESETS, type DemoAccountPreset } from '@/lib/rbac';

export function LoginScreen() {
  const router = useRouter();
  const { login } = useSmartChainMode();

  const [email, setEmail] = useState(DEMO_ACCOUNT_PRESETS[0]!.email);
  const [password, setPassword] = useState('smartchain123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.message ?? 'Autentikasi gagal');
      return;
    }
    router.push(result.homeRoute ?? '/');
  }

  function applyPreset(preset: DemoAccountPreset) {
    setEmail(preset.email);
    setPassword('smartchain123');
    setErrorMsg(null);
  }

  return (
    <div style={{ paddingTop: 32, paddingBottom: 56 }}>
      <div className="sc-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <SmartChainLogoIcon size={24} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 21,
              letterSpacing: '-0.02em',
            }}
          >
            SmartChain
          </span>
          <StatusPill variant="ok">Autentikasi RBAC</StatusPill>
        </div>

        <div className="sc-split-grid">
          <TactileSheet>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: '0 0 6px 0',
              }}
            >
              Masuk ke Ruang Kerja Peran Anda
            </h1>
            <p className="sc-section-desc">
              Setiap akun memiliki antarmuka, hak akses API JWT, dan ruang lingkup data yang
              berbeda sesuai matriks otorisasi PT Nusantara Manufacturing.
            </p>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5 }}>
                <span>Email Akun</span>
                <input
                  type="email"
                  required
                  className="sc-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@nusantara-mfg.co.id"
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5 }}>
                <span>Kata Sandi</span>
                <input
                  type="password"
                  required
                  className="sc-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                />
              </label>

              {errorMsg && (
                <div
                  role="alert"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    backgroundColor: 'var(--accent-soft)',
                    border: '1px solid var(--accent-border)',
                    color: 'var(--accent)',
                    fontSize: 13.5,
                    fontWeight: 500,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="submit" className="sc-btn-primary" disabled={submitting}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheckIcon size={16} />
                    {submitting ? 'Memverifikasi...' : 'Masuk dengan JWT'}
                  </span>
                </button>
                <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Kata sandi akun demo: smartchain123
                </span>
              </div>
            </form>
          </TactileSheet>

          <PaperCard>
            <h2 className="sc-section-head">Pilih Profil Peran untuk Uji RBAC</h2>
            <p className="sc-section-desc">
              Klik salah satu kartu peran untuk mengisi email kredensial, lalu tekan tombol Masuk.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_ACCOUNT_PRESETS.map((preset) => {
                const selected = email.toLowerCase() === preset.email.toLowerCase();
                return (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      backgroundColor: selected ? 'var(--surface)' : 'var(--surface-warm)',
                      border: `1px solid ${selected ? 'var(--ink)' : 'var(--border)'}`,
                      borderRadius: 12,
                      padding: '11px 14px',
                      cursor: 'pointer',
                      boxShadow: selected ? 'var(--shadow-pill)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>{preset.roleLabel}</strong>
                      <StatusPill variant={preset.role === 'PARTNER' ? 'warn' : 'neutral'}>
                        {preset.entityCode ?? preset.role}
                      </StatusPill>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
                      {preset.workspaceSummary}
                    </div>
                    <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {preset.email}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <label
                htmlFor="partner-quick-picker"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}
              >
                Atau pilih dari seluruh 20 Pemasok &amp; 25 Distributor:
              </label>
              <select
                id="partner-quick-picker"
                className="sc-select"
                style={{ width: '100%' }}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setPassword('smartchain123');
                  setErrorMsg(null);
                }}
              >
                <optgroup label="20 Mitra Pemasok (SUP-01 s.d. SUP-20)">
                  {INITIAL_SUPPLIERS.map((sup) => {
                    const supEmail = getPartnerEmailForCode(sup.code);
                    return (
                      <option key={sup.code} value={supEmail}>
                        {sup.code} — {sup.name} ({sup.tierType}) [{supEmail}]
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="25 Mitra Distributor (DIST-01 s.d. DIST-25)">
                  {DISTRIBUTOR_DIRECTORY.map((dist) => {
                    const distEmail = getPartnerEmailForCode(dist.code);
                    return (
                      <option key={dist.code} value={distEmail}>
                        {dist.code} — {dist.name} ({dist.slaTier}) [{distEmail}]
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>
          </PaperCard>
        </div>
      </div>
    </div>
  );
}
