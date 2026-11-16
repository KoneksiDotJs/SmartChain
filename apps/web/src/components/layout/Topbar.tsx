'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { SmartChainLogoIcon } from '@/components/ui/Icons';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import type { SmartChainRole } from '@/lib/types';

const NAV_ITEMS = [
  { href: '/', label: 'Ringkasan' },
  { href: '/srm', label: 'SRM & PO' },
  { href: '/wms', label: 'WMS & Offline' },
  { href: '/tms', label: 'Order & TMS' },
  { href: '/analytics', label: 'Analitik & Audit' },
];

const ROLE_OPTIONS: Array<{ value: SmartChainRole; label: string }> = [
  { value: 'DIREKSI', label: 'Peran: Direksi' },
  { value: 'PROCUREMENT_MANAGER', label: 'Peran: Pengadaan' },
  { value: 'WAREHOUSE_OPERATOR', label: 'Peran: Gudang' },
  { value: 'LOGISTICS_MANAGER', label: 'Peran: Logistik' },
  { value: 'PARTNER', label: 'Peran: Mitra' },
];

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, setStressMode } = useSmartChainMode();

  return (
    <header className="sc-topbar">
      <div className="sc-container sc-topbar-inner">
        <Link href="/" className="sc-brand">
          <SmartChainLogoIcon size={22} />
          <span>SmartChain</span>
        </Link>

        <nav className="sc-nav" aria-label="Navigasi modul">
          {NAV_ITEMS.map((item) => {
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="rbac-role-select" className="sr-only">
            Pilih peran pengguna RBAC
          </label>
          <select
            id="rbac-role-select"
            className="sc-select"
            value={role}
            onChange={(e) => setRole(e.target.value as SmartChainRole)}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="sc-btn-primary"
            onClick={() => {
              setStressMode(true);
              router.push('/');
            }}
          >
            Uji Gangguan
          </button>
        </div>
      </div>
    </header>
  );
}
