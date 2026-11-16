import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/response.js';
import { signJwtToken, type AuthUser, type SmartChainRole } from '../../middleware/auth.js';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface DemoPersona {
  email: string;
  name: string;
  role: SmartChainRole;
  roleLabel: string;
  entityCode?: string;
  workspaceSummary: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: 'direksi@nusantara-mfg.co.id',
    name: 'Dewi Kartika',
    role: 'DIREKSI',
    roleLabel: 'Direksi Perusahaan',
    workspaceSummary: 'Control Tower eksekutif, Business Analytics WMA, dan Audit Log (hanya-baca).',
  },
  {
    email: 'pengadaan@nusantara-mfg.co.id',
    name: 'Budi Santoso',
    role: 'PROCUREMENT_MANAGER',
    roleLabel: 'Manajer Pengadaan & Produksi',
    workspaceSummary: 'Kelola 15+ pemasok, RFQ cadangan Tier-2, persetujuan PO, dan kalkulasi ROP.',
  },
  {
    email: 'gudang@nusantara-mfg.co.id',
    name: 'Rina Wijaya',
    role: 'WAREHOUSE_OPERATOR',
    roleLabel: 'Operator Gudang #04 (WMS)',
    workspaceSummary: 'Pemindaian Barcode/RFID, antrean offline IndexedDB 48 jam, dan karantina selisih.',
  },
  {
    email: 'logistik@nusantara-mfg.co.id',
    name: 'Hendra Pratama',
    role: 'LOGISTICS_MANAGER',
    roleLabel: 'Manajer Distribusi & Logistik',
    workspaceSummary: 'Validasi Anomaly Guard, alokasi prioritas SLA, dan konsolidasi rute TMS.',
  },
  {
    email: 'mitra@bajanusantara.co.id',
    name: 'PT Baja Nusantara',
    role: 'PARTNER',
    roleLabel: 'Mitra Pemasok (SUP-01)',
    entityCode: 'SUP-01',
    workspaceSummary: 'Portal eksternal pemasok: konfirmasi PO/RFQ dan status pengiriman bahan baku.',
  },
  {
    email: 'order@distribusitimur.co.id',
    name: 'PT Distribusi Timur',
    role: 'PARTNER',
    roleLabel: 'Mitra Distributor (DIST-01)',
    entityCode: 'DIST-01',
    workspaceSummary: 'Portal eksternal distributor: pengajuan pesanan kuota dan pelacakan resi TMS.',
  },
  {
    email: 'admin@nusantara-mfg.co.id',
    name: 'Irwan Hakim',
    role: 'SYSTEM_ADMIN',
    roleLabel: 'Admin Sistem & Akses IT',
    workspaceSummary: 'Kelola akun pengguna, peran RBAC, reset sandi, dan audit keamanan (tanpa akses transaksi bisnis).',
  },
];

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`smartchain:${plain}`).digest('hex');
}

function passwordCheckFailed(plain: string): boolean {
  return plain !== 'smartchain123';
}

export function createAuthService(prisma: PrismaClient) {
  return {
    async login(payload: LoginPayload): Promise<{ token: string; user: AuthUser }> {
      let account: {
        id: string;
        email: string;
        name: string;
        role: string;
        entityCode: string | null;
        isActive: boolean;
        passwordHash: string;
      } | null = null;

      try {
        account = await prisma.userAccount.findUnique({
          where: { email: payload.email },
        });
      } catch {
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
        if (account.passwordHash !== hashPassword(payload.password)) {
          throw new AppError('Email atau kata sandi tidak valid', 401, 'INVALID_CREDENTIALS');
        }
        const user: AuthUser = {
          id: account.id,
          email: account.email,
          name: account.name,
          role: account.role as SmartChainRole,
          entityCode: account.entityCode ?? undefined,
        };
        return { token: signJwtToken(user), user };
      }

      // Fallback against built-in demo accounts when DB is not yet seeded, still enforcing password check
      const normalized = payload.email.trim().toLowerCase();
      if (passwordCheckFailed(payload.password)) {
        throw new AppError('Email atau kata sandi tidak valid', 401, 'INVALID_CREDENTIALS');
      }

      const demo = DEMO_PERSONAS.find((p) => p.email.toLowerCase() === normalized);
      if (demo) {
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
      return DEMO_PERSONAS;
    },
  };
}
