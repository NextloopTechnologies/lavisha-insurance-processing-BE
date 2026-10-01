import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController.update', () => {
  const usersService = { update: jest.fn().mockResolvedValue({}) };
  const controller = new UsersController(usersService as unknown as UsersService);

  beforeEach(() => usersService.update.mockClear());

  it('blocks a hospital user from updating another user', async () => {
    const req = { user: { userId: 'h1', role: Role.HOSPITAL } };
    expect(() => controller.update(req, 'other-user', { name: 'x' } as any)).toThrow(ForbiddenException);
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('strips role and hospitalId when a hospital user updates their own profile', async () => {
    const req = { user: { userId: 'h1', role: Role.HOSPITAL } };
    await controller.update(req, 'h1', { name: 'New', role: Role.ADMIN, hospitalId: 'h2' } as any);
    expect(usersService.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { name: 'New' } });
  });

  it('lets an admin change role and hospital of another user', async () => {
    const req = { user: { userId: 'a1', role: Role.ADMIN } };
    const body = { role: Role.HOSPITAL_MANAGER, hospitalId: 'h1' } as any;
    await controller.update(req, 'u2', body);
    expect(usersService.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: body });
  });
});
