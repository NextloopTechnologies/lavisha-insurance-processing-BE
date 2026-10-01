import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

// shape of req.user as built by JwtStrategy.validate
export interface RequestUser {
  userId: string;
  email?: string;
  name?: string;
  role: Role;
  hospitalId?: string;
}

export const isAdminRole = (role: Role): boolean =>
  role === Role.SUPER_ADMIN || role === Role.ADMIN;

/**
 * Returns the hospital user id the caller's data is restricted to.
 * undefined means no restriction (SUPER_ADMIN / ADMIN).
 * Throws if a hospital-level user has no hospital, so an unscoped
 * `{ hospitalUserId: undefined }` filter can never match every row.
 */
export function getHospitalScope(user: RequestUser): string | undefined {
  if (isAdminRole(user.role)) return undefined;
  if (user.role === Role.HOSPITAL) return user.userId;
  if (user.role === Role.HOSPITAL_MANAGER && user.hospitalId) return user.hospitalId;
  throw new ForbiddenException('No hospital assigned to this user');
}
