'use client';

import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { HeroBand } from '@/components/layout/HeroBand';
import { KpiGrid } from '@/components/layout/KpiGrid';
import { Topbar } from '@/components/layout/Topbar';
import { TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { canAccessRoute, getHomeRouteForRole, getRoleLabel } from '@/lib/rbac';

export function RoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, authReady } = useSmartChainMode();

  if (!authReady) {
    return (
      <div className="sc-container" style={{ paddingTop: 48 }}>
        <TactileSheet>
          <span className="sc-mono" style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Memuat sesi otorisasi SmartChain...
          </span>
        </TactileSheet>
      </div>
    );
  }

  if (!session || pathname === '/login') {
    return <LoginScreen />;
  }

  const allowed = canAccessRoute(session.user.role, pathname);
  const homeRoute = getHomeRouteForRole(session.user.role);

  return (
    <>
      <Topbar />
      <HeroBand />
      <main className="sc-container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        {!allowed ? (
          <TactileSheet>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <h2 className="sc-section-head" style={{ marginBottom: 0 }}>
                Akses Modul Dibatasi (RBAC 403)
              </h2>
              <StatusPill variant="alert">{getRoleLabel(session.user)}</StatusPill>
            </div>
            <p style={{ margin: '0 0 16px 0', color: 'var(--ink-muted)' }}>
              Akun <strong>{session.user.name}</strong> dengan peran{' '}
              <strong>{getRoleLabel(session.user)}</strong> tidak memiliki hak akses ke halaman{' '}
              <span className="sc-mono">{pathname}</span>.
            </p>
            <button
              type="button"
              className="sc-btn-primary"
              onClick={() => router.push(homeRoute)}
            >
              Kembali ke Ruang Kerja Saya
            </button>
          </TactileSheet>
        ) : (
          <>
            <KpiGrid />
            {children}
          </>
        )}
      </main>
    </>
  );
}
