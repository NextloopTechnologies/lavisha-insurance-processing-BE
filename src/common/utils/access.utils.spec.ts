import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { getHospitalScope, isAdminRole } from './access.utils';

describe('access.utils', () => {
  it('treats SUPER_ADMIN and ADMIN as unscoped', () => {
    expect(isAdminRole(Role.SUPER_ADMIN)).toBe(true);
    expect(isAdminRole(Role.ADMIN)).toBe(true);
    expect(getHospitalScope({ userId: 'a', role: Role.ADMIN })).toBeUndefined();
    expect(getHospitalScope({ userId: 's', role: Role.SUPER_ADMIN })).toBeUndefined();
  });

  it('scopes a HOSPITAL user to their own id', () => {
    expect(getHospitalScope({ userId: 'h1', role: Role.HOSPITAL })).toBe('h1');
  });

  it('scopes a HOSPITAL_MANAGER to their hospital', () => {
    expect(getHospitalScope({ userId: 'm1', role: Role.HOSPITAL_MANAGER, hospitalId: 'h1' })).toBe('h1');
  });

  it('rejects a HOSPITAL_MANAGER without a hospital instead of returning an empty scope', () => {
    expect(() => getHospitalScope({ userId: 'm1', role: Role.HOSPITAL_MANAGER })).toThrow(ForbiddenException);
  });
});
