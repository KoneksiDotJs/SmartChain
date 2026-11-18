import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, sendSuccess } from '../../lib/response.js';
import { parseWithSchema } from '../../lib/validation.js';
import type { SmartChainRole } from '../../middleware/auth.js';
import type { createUsersService } from './users.service.js';

const roleEnum = z.enum([
  'DIREKSI',
  'PROCUREMENT_MANAGER',
  'WAREHOUSE_OPERATOR',
  'LOGISTICS_MANAGER',
  'PARTNER',
  'SYSTEM_ADMIN',
]);

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: roleEnum,
  entityCode: z.string().max(24).optional(),
  password: z.string().min(6).max(64),
});

const updateAccessSchema = z.object({
  role: roleEnum.optional(),
  entityCode: z.string().trim().max(24).nullable().optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(64),
});

function requireActor(req: Request): { id: string; role: string } {
  if (!req.user) {
    throw new AppError('Pengguna belum terautentikasi', 401, 'UNAUTHORIZED');
  }
  return { id: req.user.id, role: req.user.role };
}

export function createUsersController(service: ReturnType<typeof createUsersService>) {
  return {
    async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const users = await service.listUsers();
        sendSuccess(res, { users });
      } catch (err) {
        next(err);
      }
    },

    async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(createUserSchema, req.body);
        const user = await service.createUser(
          {
            ...body,
            role: body.role as SmartChainRole,
          },
          actor,
        );
        sendSuccess(res, { user }, 201);
      } catch (err) {
        next(err);
      }
    },

    async updateAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(updateAccessSchema, req.body);
        const userId = String(req.params.id ?? '');
        const user = await service.updateUserAccess(
          userId,
          {
            ...body,
            role: body.role as SmartChainRole | undefined,
          },
          actor,
        );
        sendSuccess(res, { user });
      } catch (err) {
        next(err);
      }
    },

    async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const actor = requireActor(req);
        const body = parseWithSchema(resetPasswordSchema, req.body);
        const userId = String(req.params.id ?? '');
        const result = await service.resetPassword(userId, body.newPassword, actor);
        sendSuccess(res, result);
      } catch (err) {
        next(err);
      }
    },
  };
}
