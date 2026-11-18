import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { loadEnv } from '../../config/env.js';
import { AppError } from '../../lib/response.js';
import { signJwtToken, type AuthUser, type SmartChainRole } from '../../middleware/auth.js';

export interface LoginPayload {
  email: string;
  password: string;
  expectedRole?: SmartChainRole;
}

export interface DemoPersona {
  email: string;
  name: string;
  role: SmartChainRole;
  entityCode?: string;
  roleLabel: string;
  workspaceSummary: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: 'direksi@nusantara-mfg.co.id',
    name: 'Dewi Kartika (Direksi)',
    role: 'DIREKSI',
    roleLabel: 'Direksi / Eksekutif (Hanya Baca)',
    workspaceSummary: 'Memantau KPI control tower, proyeksi Hybrid WMA, dan audit log lintas 6 modul.',
  },
  {
    email: 'pengadaan@nusantara-mfg.co.id',
    name: 'Budi Santoso (Manajer Pengadaan)',
    role: 'PROCUREMENT_MANAGER',
    roleLabel: 'Manajer Pengadaan & Produksi',
    workspaceSummary: 'Mengelola pemasok utama/cadangan (SRM), memicu Auto-RFQ Tier-2, dan menerbitkan PO berbasis ROP.',
  },
  {
    email: 'gudang@nusantara-mfg.co.id',
    name: 'Rina Wijaya (Operator Gudang #04)',
    role: 'WAREHOUSE_OPERATOR',
    roleLabel: 'Operator Gudang & WMS',
    workspaceSummary: 'Menjalankan pindai Barcode/RFID, generator label, sinkronisasi offline IndexedDB, dan karantina selisih stok.',
  },
  {
    email: 'logistik@nusantara-mfg.co.id',
    name: 'Hendra Kusuma (Manajer Logistik)',
    role: 'LOGISTICS_MANAGER',
    roleLabel: 'Manajer Distribusi & Logistik',
    workspaceSummary: 'Memverifikasi Anomaly Guard pesanan, alokasi prioritas SLA Tier-1, dan konsolidasi rute TMS.',
  },
  {
    email: 'mitra@bajanusantara.co.id',
    name: 'PT Baja Nusantara (SUP-01)',
    role: 'PARTNER',
    entityCode: 'SUP-01',
    roleLabel: 'Portal Mitra Pemasok (SUP-01)',
    workspaceSummary: 'Mengonfirmasi Purchase Order masuk dan memperbarui status pengiriman ke pabrik.',
  },
  {
    email: 'order@distribusitimur.co.id',
    name: 'PT Distribusi Timur (DIST-01)',
    role: 'PARTNER',
    entityCode: 'DIST-01',
    roleLabel: 'Portal Mitra Distributor (DIST-01)',
    workspaceSummary: 'Mengajukan Sales Order terproteksi Anomaly Guard dan memantau jadwal pengiriman.',
  },
  {
    email: 'admin@nusantara-mfg.co.id',
    name: 'Arif Pratama (Admin Sistem)',
    role: 'SYSTEM_ADMIN',
    roleLabel: 'Admin Sistem & Akses IT',
    workspaceSummary: 'Kelola akun pengguna, peran RBAC, reset sandi, dan audit keamanan (tanpa akses transaksi bisnis).',
  },
];

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function hashPassword(plain: string): string {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, saltHex, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${saltHex}$${derived.toString('hex')}`;
}

export function verifyPassword(plain: string, storedHash: string): boolean {
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false;
    const expectedBuf = Buffer.from(parts[2], 'hex');
    const actualBuf = crypto.scryptSync(plain, parts[1], expectedBuf.length, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    });
    return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf);
  }

  // Constant-time support for legacy static-salted SHA-256 digests during rotation
  const legacyDigest = crypto.createHash('sha256').update(`smartchain:${plain}`).digest('hex');
  const expectedBuf = Buffer.from(storedHash, 'utf8');
  const actualBuf = Buffer.from(legacyDigest, 'utf8');
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function assertExpectedPortalRole(
  actualRole: SmartChainRole,
  expectedRole?: SmartChainRole,
): void {
  if (expectedRole && actualRole !== expectedRole) {
    throw new AppError(
      `Akun berstatus ${actualRole} tidak diizinkan masuk melalui portal login ${expectedRole}. Silakan gunakan portal login peran Anda.`,
      403,
      'PORTAL_ROLE_MISMATCH',
    );
  }
}

export function createAuthService(prisma: PrismaClient) {
  return {
    async login(payload: LoginPayload): Promise<{ token: string; user: AuthUser }> {
      const normalized = payload.email.trim().toLowerCase();
      const env = loadEnv();

      let account: {
        id: string;
        email: string;
        name: string;
        role: string;
        entityCode: string | null;
        isActive: boolean;
        tokenVersion: number;
        passwordHash: string;
      } | null = null;

      try {
        account = await prisma.userAccount.findUnique({
          where: { email: normalized },
        });
      } catch {
        // Fail closed on database errors in production and by default; dev sandbox fallback requires explicit opt-in
        if (!env.demoAuthEnabled || process.env.ALLOW_DEMO_DB_FALLBACK !== 'true') {
          throw new AppError(
            'Layanan autentikasi basis data sedang tidak tersedia',
            503,
            'AUTH_STORE_UNAVAILABLE',
          );
        }
        account = null;
      }

      if (account) {
        if (!account.isActive) {
          throw new AppError(
            'Akun dinonaktifkan oleh Admin Sistem. Hubungi tim IT untuk aktivasi ulang.',
            403,
            'ACCOUNT_DISABLED',
          );
        }
        if (!verifyPassword(payload.password, account.passwordHash)) {
          throw new AppError('Email atau kata sandi tidak valid', 401, 'INVALID_CREDENTIALS');
        }
        const user: AuthUser = {
          id: account.id,
          email: account.email,
          name: account.name,
          role: account.role as SmartChainRole,
          entityCode: account.entityCode ?? undefined,
          tokenVersion: account.tokenVersion,
        };
        assertExpectedPortalRole(user.role, payload.expectedRole);
        return { token: signJwtToken(user), user };
      }

      // Demo fallback is disabled completely in production
      if (!env.demoAuthEnabled) {
        throw new AppError('Email atau kata sandi tidak valid', 401, 'INVALID_CREDENTIALS');
      }

      const devDemoPass = process.env.DEV_DEMO_PASSWORD ?? 'smartchain123';
      const passBuf = Buffer.from(payload.password, 'utf8');
      const expectedDemoBuf = Buffer.from(devDemoPass, 'utf8');
      if (passBuf.length !== expectedDemoBuf.length || !crypto.timingSafeEqual(passBuf, expectedDemoBuf)) {
        throw new AppError('Email atau kata sandi tidak valid', 401, 'INVALID_CREDENTIALS');
      }

      const demo = DEMO_PERSONAS.find((p) => p.email.toLowerCase() === normalized);
      if (demo) {
        assertExpectedPortalRole(demo.role, payload.expectedRole);
        const user: AuthUser = {
          id: `demo-${demo.role.toLowerCase()}-${demo.entityCode ?? 'hq'}`,
          email: demo.email,
          name: demo.name,
          role: demo.role,
          entityCode: demo.entityCode,
        };
        return { token: signJwtToken(user), user };
      }

      const partnerMatch = /^(sup|dist)-(\d{2})@mitra\.nusantara-mfg\.co\.id$/.exec(normalized);
      if (partnerMatch) {
        assertExpectedPortalRole('PARTNER', payload.expectedRole);
        const entityCode = `${partnerMatch[1]!.toUpperCase()}-${partnerMatch[2]!}`;
        const user: AuthUser = {
          id: `demo-partner-${entityCode.toLowerCase()}`,
          email: normalized,
          name: `Mitra ${entityCode}`,
          role: 'PARTNER',
          entityCode,
        };
        return { token: signJwtToken(user), user };
      }

      throw new AppError('Email atau kata sandi tidak valid', 401, 'INVALID_CREDENTIALS');
    },

    listPersonas(): DemoPersona[] {
      const { demoAuthEnabled } = loadEnv();
      return demoAuthEnabled ? DEMO_PERSONAS : [];
    },
  };
}
