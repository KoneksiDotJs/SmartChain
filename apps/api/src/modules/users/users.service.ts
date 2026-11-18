import type { AuditWriter } from '../../lib/audit.js';
import { AppError } from '../../lib/response.js';
import type { SmartChainRole } from '../../middleware/auth.js';
import { hashPassword } from '../auth/auth.service.js';
import type { ManagedUserRow, UsersRepository } from './users.repository.js';

export function createUsersService(repo: UsersRepository, audit: AuditWriter) {
  return {
    async listUsers(): Promise<ManagedUserRow[]> {
      return repo.listAll();
    },

    async createUser(
      input: {
        email: string;
        name: string;
        role: SmartChainRole;
        entityCode?: string;
        password: string;
      },
      actor: { id: string; role: string },
    ): Promise<ManagedUserRow> {
      const normalizedEmail = input.email.trim().toLowerCase();
      const existing = await repo.findByEmail(normalizedEmail);
      if (existing) {
        throw new AppError(`Email ${normalizedEmail} sudah terdaftar`, 409, 'EMAIL_EXISTS');
      }

      const trimmedEntity = input.entityCode?.trim().toUpperCase();
      if (input.role === 'PARTNER' && !trimmedEntity) {
        throw new AppError(
          'Peran PARTNER wajib menyertakan kode entitas (mis. SUP-01 atau DIST-01)',
          400,
          'ENTITY_CODE_REQUIRED',
        );
      }

      const created = await repo.create({
        email: normalizedEmail,
        name: input.name.trim(),
        role: input.role,
        entityCode: input.role === 'PARTNER' ? trimmedEntity ?? null : null,
        passwordHash: hashPassword(input.password),
      });

      await audit.append({
        entityType: 'UserAccount',
        entityId: created.id,
        action: 'USER_ACCOUNT_CREATED',
        actorId: actor.id,
        actorRole: actor.role,
        newState: {
          email: created.email,
          role: created.role,
          entityCode: created.entityCode,
        },
        reason: `Admin Sistem membuat akun ${created.email} dengan peran ${created.role}.`,
      });

      return created;
    },

    async updateUserAccess(
      targetId: string,
      patch: { role?: SmartChainRole; entityCode?: string | null; isActive?: boolean },
      actor: { id: string; role: string },
    ): Promise<ManagedUserRow> {
      const existing = await repo.findById(targetId);
      if (!existing) {
        throw new AppError('Akun pengguna tidak ditemukan', 404, 'USER_NOT_FOUND');
      }

      if (existing.id === actor.id && patch.isActive === false) {
        throw new AppError(
          'Admin Sistem tidak dapat menonaktifkan akunnya sendiri',
          400,
          'SELF_DEACTIVATION_FORBIDDEN',
        );
      }

      if (existing.id === actor.id && patch.role && patch.role !== 'SYSTEM_ADMIN') {
        throw new AppError(
          'Admin Sistem tidak dapat menurunkan perannya sendiri saat aktif',
          400,
          'SELF_DEMOTION_FORBIDDEN',
        );
      }

      const nextRole = patch.role ?? existing.role;
      const candidateEntityCode =
        patch.entityCode !== undefined
          ? patch.entityCode?.trim().toUpperCase() || null
          : existing.entityCode;

      if (nextRole === 'PARTNER' && !candidateEntityCode) {
        throw new AppError(
          'Peran PARTNER wajib memiliki kode entitas yang valid (mis. SUP-01 atau DIST-01)',
          400,
          'ENTITY_CODE_REQUIRED',
        );
      }

      const normalizedPatch: { role?: SmartChainRole; entityCode?: string | null; isActive?: boolean } = {
        ...patch,
        entityCode: nextRole === 'PARTNER' ? candidateEntityCode : null,
      };

      const updated = await repo.updateAccess(targetId, normalizedPatch);

      await audit.append({
        entityType: 'UserAccount',
        entityId: updated.id,
        action: 'USER_ACCESS_UPDATED',
        actorId: actor.id,
        actorRole: actor.role,
        previousState: {
          role: existing.role,
          isActive: existing.isActive,
          entityCode: existing.entityCode,
        },
        newState: {
          role: updated.role,
          isActive: updated.isActive,
          entityCode: updated.entityCode,
        },
        reason: `Perubahan akses RBAC untuk ${updated.email}.`,
      });

      return updated;
    },

    async resetPassword(
      targetId: string,
      newPassword: string,
      actor: { id: string; role: string },
    ): Promise<{ id: string; email: string }> {
      const existing = await repo.findById(targetId);
      if (!existing) {
        throw new AppError('Akun pengguna tidak ditemukan', 404, 'USER_NOT_FOUND');
      }

      await repo.updatePasswordHash(targetId, hashPassword(newPassword));

      await audit.append({
        entityType: 'UserAccount',
        entityId: existing.id,
        action: 'USER_PASSWORD_RESET',
        actorId: actor.id,
        actorRole: actor.role,
        newState: { email: existing.email },
        reason: `Admin Sistem mereset kata sandi akun ${existing.email}.`,
      });

      return { id: existing.id, email: existing.email };
    },
  };
}
