import type { PrismaClient } from '@prisma/client';

export interface AuditEntryInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorRole: string;
  previousState?: Record<string, unknown> | null;
  newState: Record<string, unknown>;
  reason?: string;
  idempotencyKey?: string;
}

export interface AuditRecord extends AuditEntryInput {
  id: string;
  createdAt: Date;
}

/**
 * Append-only audit writer contract (NFR-02).
 * Implementations must only support append/read; UPDATE and DELETE are forbidden.
 */
export interface AuditWriter {
  append(entry: AuditEntryInput): Promise<AuditRecord>;
  listRecent(limit?: number): Promise<AuditRecord[]>;
}

export function createPrismaAuditWriter(prisma: PrismaClient): AuditWriter {
  return {
    async append(entry: AuditEntryInput): Promise<AuditRecord> {
      const created = await prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          actorId: entry.actorId,
          actorRole: entry.actorRole,
          previousState: entry.previousState ? JSON.parse(JSON.stringify(entry.previousState)) : undefined,
          newState: JSON.parse(JSON.stringify(entry.newState)),
          reason: entry.reason,
          idempotencyKey: entry.idempotencyKey,
        },
      });

      return {
        id: created.id,
        entityType: created.entityType,
        entityId: created.entityId,
        action: created.action,
        actorId: created.actorId,
        actorRole: created.actorRole,
        previousState: (created.previousState as Record<string, unknown> | null) ?? null,
        newState: created.newState as Record<string, unknown>,
        reason: created.reason ?? undefined,
        idempotencyKey: created.idempotencyKey ?? undefined,
        createdAt: created.createdAt,
      };
    },

    async listRecent(limit = 30): Promise<AuditRecord[]> {
      const rows = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        actorId: row.actorId,
        actorRole: row.actorRole,
        previousState: (row.previousState as Record<string, unknown> | null) ?? null,
        newState: row.newState as Record<string, unknown>,
        reason: row.reason ?? undefined,
        idempotencyKey: row.idempotencyKey ?? undefined,
        createdAt: row.createdAt,
      }));
    },
  };
}
