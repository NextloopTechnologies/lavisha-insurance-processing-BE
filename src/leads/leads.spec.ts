import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsKeyGuard } from './leads-key.guard';
import { LeadsService } from './leads.service';

const contextWith = (headers: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

const guardWith = (key?: string) =>
  new LeadsKeyGuard({ get: () => key } as unknown as ConfigService);

describe('LeadsKeyGuard', () => {
  it('accepts the configured key', () => {
    expect(
      guardWith('s3cret').canActivate(contextWith({ 'x-leads-key': 's3cret' })),
    ).toBe(true);
  });

  it.each([
    ['missing header', {}],
    ['wrong key', { 'x-leads-key': 'nope' }],
    ['prefix of the key', { 'x-leads-key': 's3cre' }],
    ['array header', { 'x-leads-key': ['s3cret'] }],
  ])('rejects %s', (_label, headers) => {
    expect(() => guardWith('s3cret').canActivate(contextWith(headers))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses everything when LEADS_API_KEY is not set', () => {
    expect(() =>
      guardWith(undefined).canActivate(contextWith({ 'x-leads-key': '' })),
    ).toThrow(ServiceUnavailableException);
  });
});

describe('CreateLeadDto', () => {
  const errorsFor = (body: object) =>
    validateSync(plainToInstance(CreateLeadDto, body)).map((e) => e.property);
  const valid = {
    name: 'Asha',
    hospital: 'City Care',
    phone: '+91 98765 43210',
  };

  it('accepts the minimum required fields', () => {
    expect(errorsFor(valid)).toEqual([]);
  });

  it('trims values and drops empty optional fields', () => {
    const dto = plainToInstance(CreateLeadDto, {
      ...valid,
      name: '  Asha  ',
      email: '',
      city: '   ',
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.name).toBe('Asha');
    expect(dto.email).toBeUndefined();
    expect(dto.city).toBeUndefined();
  });

  it('rejects missing required fields and bad formats', () => {
    expect(errorsFor({})).toEqual(
      expect.arrayContaining(['name', 'hospital', 'phone']),
    );
    expect(errorsFor({ ...valid, phone: 'call me' })).toEqual(['phone']);
    expect(errorsFor({ ...valid, email: 'not-an-email' })).toEqual(['email']);
    expect(errorsFor({ ...valid, name: ' ' })).toEqual(['name']);
    expect(errorsFor({ ...valid, message: 'x'.repeat(2001) })).toEqual([
      'message',
    ]);
  });
});

describe('LeadsService.create', () => {
  const dto = {
    name: 'Asha',
    hospital: 'City Care',
    phone: '+91 98765 43210',
  } as CreateLeadDto;

  const setup = (admins: { id: string }[]) => {
    const tx = {
      lead: { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
      user: { findMany: jest.fn().mockResolvedValue(admins) },
      notification: { createMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { tx, service: new LeadsService(prisma as any) };
  };

  it('stores the lead and notifies every admin', async () => {
    const { tx, service } = setup([{ id: 'u1' }, { id: 'u2' }]);

    await expect(service.create(dto)).resolves.toEqual({ id: 'lead-1' });

    expect(tx.lead.create).toHaveBeenCalledWith({
      data: dto,
      select: { id: true },
    });
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
      select: { id: true },
    });
    const { data } = tx.notification.createMany.mock.calls[0][0];
    expect(data.map((n: { userId: string }) => n.userId)).toEqual(['u1', 'u2']);
    expect(data[0].message).toContain('City Care');
  });

  it('skips notifications when there are no admins', async () => {
    const { tx, service } = setup([]);
    await service.create(dto);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});
