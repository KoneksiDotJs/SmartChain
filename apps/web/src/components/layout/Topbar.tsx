'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SmartChainLogoIcon } from '@/components/ui/Icons';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import { getHomeRouteForRole, getNavItemsForRole, getRoleLabel } from '@/lib/rbac';

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, offlineQueue, logout } = useSmartChainMode();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  if (!session) return null;

  const navItems = getNavItemsForRole(session.user.role);
  const homeRoute = getHomeRouteForRole(session.user.role);

  return (
    <>
      <header className="sc-topbar">
        <div className="sc-container sc-topbar-inner">
          <Link href={homeRoute} className="sc-brand">
            <SmartChainLogoIcon size={22} />
            <span>SmartChain</span>
          </Link>

          <nav className="sc-nav" aria-label="Navigasi modul peran">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sc-nav-link ${active ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{session.user.name}</div>
              <div className="sc-mono" style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
                {getRoleLabel(session.user)}
              </div>
            </div>

            <StatusPill variant={session.authMode === 'jwt-api' ? 'ok' : 'warn'}>
              {session.authMode === 'jwt-api' ? 'Online' : 'Offline'}
            </StatusPill>

            <button
              type="button"
              className="sc-btn-secondary"
              onClick={() => setLogoutModalOpen(true)}
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <ConfirmModal
        open={logoutModalOpen}
        title="Konfirmasi Keluar dari SmartChain"
        description={`Anda akan mengakhiri sesi aktif untuk ${session.user.name} (${getRoleLabel(session.user)}).`}
        detailNote={
          offlineQueue.length > 0
            ? `Perhatian: masih ada ${offlineQueue.length} transaksi di antrean IndexedDB lokal yang belum disinkronkan.`
            : `Token sesi akan dihapus dan Anda diarahkan kembali ke halaman login.`
        }
        confirmLabel="Ya, Keluar Sekarang"
        cancelLabel="Tetap Masuk"
        tone={offlineQueue.length > 0 ? 'accent' : 'primary'}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={() => {
          setLogoutModalOpen(false);
          logout();
          router.push('/login');
        }}
      />
    </>
  );
}
