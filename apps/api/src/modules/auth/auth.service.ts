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
  entityCode?: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { email: 'direksi@nusantara-mfg.co.id', name: 'Dewi Kartika (Direksi)', role: 'DIREKSI' },
  { email: 'pengadaan@nusantara-mfg.co.id', name: 'Budi Santoso (Manajer Pengadaan)', role: 'PROCUREMENT_MANAGER' },
  { email: 'gudang@nusantara-mfg.co.id', name: 'Rina Wijaya (Operator Gudang #04)', role: 'WAREHOUSE_OPERATOR' },
  { email: 'logistik@nusantara-mfg.co.id', name: 'Hendra Pratama (Manajer Logistik)', role: 'LOGISTICS_MANAGER' },
  { email: 'mitra@bajanusantara.co.id', name: 'PT Baja Nusantara (Mitra Eksternal)', role: 'PARTNER', entityCode: 'SUP-01' },
];

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`smartchain:${plain}`).digest('hex');
}

export function createAuthService(prisma: PrismaClient) {
  return {
    async login(payload: LoginPayload): Promise<{ token: string; user: AuthUser }> {
      const account = await prisma.userAccount.findUnique({
        where: { email: payload.email },
      });

      if (!account || account.passwordHash !== hashPassword(payload.password)) {
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
    },

    issueDemoToken(role: SmartChainRole): { token: string; user: AuthUser } {
      const persona = DEMO_PERSONAS.find((item) => item.role === role) ?? DEMO_PERSONAS[0]!;
      const user: AuthUser = {
        id: `demo-${persona.role.toLowerCase()}`,
        email: persona.email,
        name: persona.name,
        role: persona.role,
        entityCode: persona.entityCode,
      };
      return { token: signJwtToken(user), user };
    },
  };
}
