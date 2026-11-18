import type { PrismaClient } from '@prisma/client';
import type { SmartChainRole } from '../../middleware/auth.js';

export interface ManagedUserRow {
  id: string;
  email: string;
  name: string;
  role: SmartChainRole;
  entityCode: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateManagedUserInput {
  email: string;
  name: string;
  role: SmartChainRole;
  entityCode: string | null;
  passwordHash: string;
}

export interface UsersRepository {
  listAll(): Promise<ManagedUserRow[]>;
  findById(id: string): Promise<ManagedUserRow | null>;
  findByEmail(email: string): Promise<ManagedUserRow | null>;
  create(input: CreateManagedUserInput): Promise<ManagedUserRow>;
  updateAccess(
    id: string,
    patch: { role?: SmartChainRole; entityCode?: string | null; isActive?: boolean },
  ): Promise<ManagedUserRow>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

function mapUser(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  entityCode: string | null;
  isActive: boolean;
  createdAt: Date;
}): ManagedUserRow {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as SmartChainRole,
    entityCode: row.entityCode,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export function createPrismaUsersRepository(prisma: PrismaClient): UsersRepository {
  return {
    async listAll(): Promise<ManagedUserRow[]> {
      const rows = await prisma.userAccount.findMany({
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      });
      return rows.map(mapUser);
    },

    async findById(id: string): Promise<ManagedUserRow | null> {
      const row = await prisma.userAccount.findUnique({ where: { id } });
      return row ? mapUser(row) : null;
    },

    async findByEmail(email: string): Promise<ManagedUserRow | null> {
      const row = await prisma.userAccount.findUnique({ where: { email } });
      return row ? mapUser(row) : null;
    },

    async create(input: CreateManagedUserInput): Promise<ManagedUserRow> {
      const created = await prisma.userAccount.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          entityCode: input.entityCode,
          passwordHash: input.passwordHash,
          isActive: true,
        },
      });
      return mapUser(created);
    },

    async updateAccess(id, patch): Promise<ManagedUserRow> {
      const updated = await prisma.userAccount.update({
        where: { id },
        data: {
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.entityCode !== undefined ? { entityCode: patch.entityCode } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
          tokenVersion: { increment: 1 },
        },
      });
      return mapUser(updated);
    },

    async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
      await prisma.userAccount.update({
        where: { id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });
    },
  };
}
