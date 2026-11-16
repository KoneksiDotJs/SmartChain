'use client';

import React, { useState } from 'react';
import { InteractiveBarChart } from '@/components/charts/InteractiveBarChart';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaperCard, TactileSheet } from '@/components/ui/PaperCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSmartChainMode } from '@/hooks/useSmartChainMode';
import type { ManagedUserDto, SmartChainRole } from '@/lib/types';

const ALL_ROLES: Array<{ value: SmartChainRole; label: string; scope: string }> = [
  { value: 'DIREKSI', label: 'Direksi Perusahaan', scope: 'Hanya-baca Control Tower, Analitik WMA, & Audit Log' },
  { value: 'PROCUREMENT_MANAGER', label: 'Manajer Pengadaan', scope: 'Baca/tulis SRM, Auto-RFQ, & Purchase Order' },
  { value: 'WAREHOUSE_OPERATOR', label: 'Operator Gudang', scope: 'Baca/tulis WMS RFID, Antrean Offline, & Karantina' },
  { value: 'LOGISTICS_MANAGER', label: 'Manajer Logistik', scope: 'Baca/tulis Anomaly Guard, SLA, & Konsolidasi TMS' },
  { value: 'PARTNER', label: 'Mitra Eksternal', scope: 'Portal terisolasi per entityCode (SUP-* / DIST-*)' },
  { value: 'SYSTEM_ADMIN', label: 'Admin Sistem IT', scope: 'Manajemen akun & RBAC saja (tanpa transaksi bisnis)' },
];

export default function AdminAccessPage() {
  const {
    session,
    managedUsers,
    auditLogs,
    createManagedUser,
    updateManagedUserAccess,
    resetManagedUserPassword,
  } = useSmartChainMode();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SmartChainRole>('WAREHOUSE_OPERATOR');
  const [entityCode, setEntityCode] = useState('SUP-02');
  const [password, setPassword] = useState('smartchain123');

  const [pendingStatusUser, setPendingStatusUser] = useState<ManagedUserDto | null>(null);
  const [pendingResetUser, setPendingResetUser] = useState<ManagedUserDto | null>(null);
  const [resetPwdInput, setResetPwdInput] = useState('smartchain123');

  const roleCounts = ALL_ROLES.map((r) => {
    const activeCount = managedUsers.filter((u) => u.role === r.value && u.isActive).length;
    const totalCount = managedUsers.filter((u) => u.role === r.value).length;
    return {
      id: r.value,
      label: r.value.replace('_MANAGER', '').replace('_OPERATOR', ''),
      sublabel: r.label,
      primaryValue: activeCount,
      secondaryValue: totalCount,
      tone: r.value === 'SYSTEM_ADMIN' ? ('warn' as const) : ('ink' as const),
      secondaryTone: 'ok' as const,
      note: r.scope,
    };
  });

  const accessAuditLogs = auditLogs.filter(
    (log) => log.entityType === 'UserAccount' || log.actorRole === 'SYSTEM_ADMIN',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="sc-split-grid">
        <InteractiveBarChart
          title="Distribusi Akun per Peran RBAC"
          subtitle="Memantau sebaran hak akses aktif berdasarkan prinsip Least Privilege."
          primaryLabel="Akun Aktif"
          secondaryLabel="Total Akun"
          unitSuffix="akun"
          data={roleCounts}
        />

        <PaperCard>
          <h2 className="sc-section-head">Matriks Pemisahan Tugas (Separation of Duties)</h2>
          <p className="sc-section-desc">
            Admin Sistem IT menjaga keamanan akses, namun diblokir dari transaksi rantai pasok agar
            tidak menjadi Superadmin tunggal.
          </p>

          <div className="sc-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="sc-table" style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th>Peran</th>
                  <th>Wewenang Utama</th>
                  <th>Status Bisnis</th>
                </tr>
              </thead>
              <tbody>
                {ALL_ROLES.map((r) => (
                  <tr key={r.value}>
                    <td className="sc-mono" style={{ fontSize: 12 }}>
                      {r.value}
                    </td>
                    <td style={{ fontSize: 13 }}>{r.scope}</td>
                    <td>
                      <StatusPill
                        variant={
                          r.value === 'SYSTEM_ADMIN'
                            ? 'warn'
                            : r.value === 'DIREKSI'
                              ? 'neutral'
                              : 'ok'
                        }
                      >
                        {r.value === 'SYSTEM_ADMIN'
                          ? 'Non-Transaksional'
                          : r.value === 'DIREKSI'
                            ? 'Hanya-Baca'
                            : 'Operasional'}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaperCard>
      </div>

      <div className="sc-split-grid">
        <TactileSheet>
          <h2 className="sc-section-head">Daftarkan Akun Pengguna Baru</h2>
          <p className="sc-section-desc">
            Setiap pembuatan akun otomatis dicatat ke Immutable Audit Log.
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await createManagedUser({
                name,
                email,
                role,
                entityCode: role === 'PARTNER' ? entityCode : undefined,
                password,
              });
              if (ok) {
                setName('');
                setEmail('');
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Nama Lengkap / Nama Mitra</span>
              <input
                type="text"
                required
                className="sc-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Sari Wulandari"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Email Perusahaan / Mitra</span>
              <input
                type="email"
                required
                className="sc-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@nusantara-mfg.co.id"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Peran RBAC</span>
              <select
                className="sc-select"
                value={role}
                onChange={(e) => setRole(e.target.value as SmartChainRole)}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} ({r.value})
                  </option>
                ))}
              </select>
            </label>

            {role === 'PARTNER' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span>Kode Entitas Mitra (Wajib untuk PARTNER)</span>
                <input
                  type="text"
                  required
                  className="sc-input"
                  value={entityCode}
                  onChange={(e) => setEntityCode(e.target.value)}
                  placeholder="SUP-01 atau DIST-01"
                />
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span>Kata Sandi Awal (min. 6 karakter)</span>
              <input
                type="password"
                required
                minLength={6}
                className="sc-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button type="submit" className="sc-btn-primary" style={{ alignSelf: 'flex-start' }}>
              Buat Akun RBAC
            </button>
          </form>
        </TactileSheet>

        <PaperCard>
          <h3 className="sc-section-head">Log Audit Keamanan &amp; Akses</h3>
          <p className="sc-section-desc">
            Rekaman permanen pembuatan akun, pergantian peran, penonaktifan, dan reset kata sandi.
          </p>

          <div
            className="sc-mono"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
              maxHeight: 330,
              overflowY: 'auto',
            }}
          >
            {accessAuditLogs.length === 0 ? (
              <div style={{ color: 'var(--ink-muted)' }}>
                Belum ada perubahan akun pada sesi ini. Buat atau ubah akses pengguna untuk melihat
                jejak audit.
              </div>
            ) : (
              accessAuditLogs.map((log) => (
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
              ))
            )}
          </div>
        </PaperCard>
      </div>

      <div className="sc-table-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Nama &amp; Email</th>
              <th>Ubah Peran RBAC</th>
              <th>Entitas</th>
              <th>Status Akun</th>
              <th>Aksi Keamanan</th>
            </tr>
          </thead>
          <tbody>
            {managedUsers.map((u) => {
              const isSelf = u.email === session?.user.email;
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="sc-mono" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {u.email}
                    </div>
                  </td>
                  <td>
                    <select
                      aria-label={`Peran untuk ${u.email}`}
                      className="sc-select"
                      disabled={isSelf}
                      value={u.role}
                      onChange={(e) =>
                        void updateManagedUserAccess(u.id, {
                          role: e.target.value as SmartChainRole,
                        })
                      }
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="sc-mono">{u.entityCode ?? 'Internal'}</td>
                  <td>
                    <StatusPill variant={u.isActive ? 'ok' : 'alert'}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </StatusPill>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="sc-btn-secondary"
                        style={{ padding: '5px 10px', fontSize: 12 }}
                        onClick={() => {
                          setResetPwdInput('smartchain123');
                          setPendingResetUser(u);
                        }}
                      >
                        Reset Sandi
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          className={u.isActive ? 'sc-btn-accent' : 'sc-btn-primary'}
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => setPendingStatusUser(u)}
                        >
                          {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={pendingStatusUser !== null}
        title={
          pendingStatusUser?.isActive
            ? `Nonaktifkan Akun ${pendingStatusUser.email}?`
            : `Aktifkan Kembali ${pendingStatusUser?.email}?`
        }
        description={
          pendingStatusUser?.isActive
            ? 'Pengguna tidak akan bisa masuk ke SmartChain hingga diaktifkan kembali. Jejak audit historis tetap terjaga.'
            : 'Pengguna akan diizinkan kembali masuk sesuai peran RBAC yang ditetapkan.'
        }
        confirmLabel={pendingStatusUser?.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
        tone={pendingStatusUser?.isActive ? 'accent' : 'primary'}
        onCancel={() => setPendingStatusUser(null)}
        onConfirm={() => {
          const target = pendingStatusUser;
          setPendingStatusUser(null);
          if (target) {
            void updateManagedUserAccess(target.id, { isActive: !target.isActive });
          }
        }}
      />

      <ConfirmModal
        open={pendingResetUser !== null}
        title={`Reset Kata Sandi ${pendingResetUser?.email}?`}
        description="Kata sandi akan diatur ulang ke kata sandi sementara default dan tercatat di Audit Log."
        detailNote={`Sandi baru: ${resetPwdInput}`}
        confirmLabel="Ya, Reset Sandi"
        tone="primary"
        onCancel={() => setPendingResetUser(null)}
        onConfirm={() => {
          const target = pendingResetUser;
          setPendingResetUser(null);
          if (target) {
            void resetManagedUserPassword(target.id, resetPwdInput);
          }
        }}
      />
    </div>
  );
}
