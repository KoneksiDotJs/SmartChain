'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { ShieldCheckIcon, SmartChainLogoIcon } from '@/components/ui/Icons';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import {
  DISTRIBUTOR_DIRECTORY,
  INITIAL_SUPPLIERS,
  getPartnerEmailForCode,
} from '@/lib/mockSnapshot';
import { ROLE_LOGIN_PORTALS } from '@/lib/rbac';

interface LoginScreenProps {
  portalSlug?: string;
}

export function LoginScreen({ portalSlug }: LoginScreenProps) {
  const router = useRouter();
  const { login } = useSmartChainMode();

  const activePortal = portalSlug
    ? ROLE_LOGIN_PORTALS.find((p) => p.slug === portalSlug)
    : undefined;

  const [email, setEmail] = useState(
    activePortal?.defaultEmail ?? ROLE_LOGIN_PORTALS[0]!.defaultEmail,
  );
  const [password, setPassword] = useState('smartchain123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activePortal) {
      setEmail(activePortal.defaultEmail);
      setPassword('smartchain123');
      setErrorMsg(null);
    }
  }, [activePortal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const result = await login(email, password, activePortal?.role);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.message ?? 'Autentikasi gagal');
      return;
    }
    router.push(result.homeRoute ?? '/');
  }

  return (
    <div style={{ paddingTop: 32, paddingBottom: 56 }}>
      <div className="sc-container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <StatusPill variant={activePortal ? 'warn' : 'ok'}>
              {activePortal ? activePortal.badge : 'Gerbang Autentikasi RBAC'}
            </StatusPill>
          </div>

          {activePortal && (
            <Link href="/login" className="sc-btn-secondary" style={{ textDecoration: 'none' }}>
              Pilih Portal Peran Lain
            </Link>
          )}
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
              {activePortal ? activePortal.title : 'Masuk ke Ruang Kerja SmartChain'}
            </h1>
            <p className="sc-section-desc">
              {activePortal
                ? `${activePortal.description} Portal ini mengunci autentikasi khusus peran ${activePortal.role}.`
                : 'Setiap peran memiliki halaman login khusus dengan verifikasi peran JWT ketat dan pembatasan akses RBAC.'}
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
                    {submitting
                      ? 'Memverifikasi...'
                      : activePortal
                        ? `Masuk ke ${activePortal.title}`
                        : 'Masuk dengan JWT'}
                  </span>
                </button>
                <span className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Sandi akun demo: smartchain123
                </span>
              </div>
            </form>

            {(!activePortal || activePortal.role === 'PARTNER') && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <label
                  htmlFor="partner-quick-picker"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}
                >
                  Pilih Akun dari 20 Pemasok &amp; 25 Distributor:
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
            )}
          </TactileSheet>

          <PaperCard>
            <h2 className="sc-section-head">Halaman Login Khusus per Peran</h2>
            <p className="sc-section-desc">
              Pilih portal login khusus sesuai peran Anda. Sistem menolak masuk jika akun tidak
              cocok dengan peran portal yang dipilih.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROLE_LOGIN_PORTALS.map((portal) => {
                const isCurrent = activePortal?.slug === portal.slug;
                return (
                  <Link
                    key={portal.slug}
                    href={`/login/${portal.slug}`}
                    onClick={() => {
                      setEmail(portal.defaultEmail);
                      setPassword('smartchain123');
                      setErrorMsg(null);
                    }}
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      backgroundColor: isCurrent ? 'var(--surface)' : 'var(--surface-warm)',
                      border: `1px solid ${isCurrent ? 'var(--ink)' : 'var(--border)'}`,
                      borderRadius: 12,
                      padding: '11px 14px',
                      boxShadow: isCurrent ? 'var(--shadow-pill)' : 'none',
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
                      <strong style={{ fontSize: 14 }}>{portal.title}</strong>
                      <StatusPill
                        variant={
                          portal.role === 'SYSTEM_ADMIN' || portal.role === 'PARTNER'
                            ? 'warn'
                            : 'neutral'
                        }
                      >
                        /login/{portal.slug}
                      </StatusPill>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 4 }}>
                      {portal.description}
                    </div>
                    <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      Default: {portal.defaultEmail} ({portal.role})
                    </div>
                  </Link>
                );
              })}
            </div>
          </PaperCard>
        </div>
      </div>
    </div>
  );
}
