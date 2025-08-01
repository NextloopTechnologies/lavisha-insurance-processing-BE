import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseNotificationDto } from './dto/response-notification.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Injectable()
export class NotificationsService {
 constructor(private prisma: PrismaService){}

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.NotificationWhereInput;
    orderBy?: Prisma.NotificationOrderByWithRelationInput;
  }): Promise<PaginatedResult<ResponseNotificationDto>> {
    const { skip, take, where, orderBy } = params;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        skip,
          take,
          where,
          orderBy,
          select: {
            id: true,
            userId: true,
            message: true,
            isRead: true,
            createdAt: true
          }
      })
    ])
    return { total, data }
  }

  async update(params: {
    where: Prisma.NotificationWhereUniqueInput, 
    data: Prisma.NotificationUpdateInput
  }): Promise<ResponseNotificationDto> {
    const { where, data } = params
    return this.prisma.notification.update({
      where,
      data
    });
  }
}
