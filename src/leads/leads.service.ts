import { Injectable } from '@nestjs/common';
import { Lead, LeadStatus, Prisma, Role } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

// Roles that get an in-app notification for every new website enquiry.
const NOTIFY_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeadDto): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({ data: dto, select: { id: true } });

      const admins = await tx.user.findMany({
        where: { role: { in: NOTIFY_ROLES } },
        select: { id: true },
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map(({ id }) => ({
            userId: id,
            message: `New website enquiry: ${dto.name} (${dto.hospital}) — ${dto.phone}`,
          })),
        });
      }

      return lead;
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.LeadWhereInput;
    orderBy?: Prisma.LeadOrderByWithRelationInput;
  }): Promise<PaginatedResult<Lead>> {
    const { skip, take, where, orderBy } = params;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({ skip, take, where, orderBy }),
    ]);
    return { total, data };
  }

  updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }
}
