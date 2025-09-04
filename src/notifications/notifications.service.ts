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
    const [totalUnRead, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ 
        where: {
          userId: where.userId,
          isRead: false 
        } 
      }),
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
    return { total: totalUnRead,  data }
  }

  async update(params: {
    where: Prisma.NotificationWhereInput, 
    data: Prisma.NotificationUpdateInput
  }): Promise<{ count: number }> {
    const { where, data } = params
    return this.prisma.notification.updateMany({
      where,
      data
    });
  }
}
