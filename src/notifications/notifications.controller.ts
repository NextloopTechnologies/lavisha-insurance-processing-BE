import { Controller, Get, Body, Patch, Request, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindAllNotificationsDto } from './dto/find-all-notification.dto';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { ResponseNotificationDto } from './dto/response-notification.dto';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth('access_token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions(Permission.NOTIFICATION_READ_LIST)
  @ApiOperation({ summary: 'Get paginated list of notifications' })
  @ApiResponse({ status: 200, type: ResponseNotificationDto })
  findAll(
    @Request() req,
    @Query() query: FindAllNotificationsDto,
  ): Promise<PaginatedResult<ResponseNotificationDto>> {
    const userId = req.user.userId;
    const where: Prisma.NotificationWhereInput = { userId }

    const { sortBy, sortOrder, isRead } = query
    if (typeof isRead !== 'undefined') {
      where.isRead = isRead === 'true';
    }
    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.notificationsService.findAll({ where, orderBy });
  }

  @Patch()
  @Permissions(Permission.NOTIFICATION_MARK_READ)
  @ApiOperation({ summary: 'Update notification by isRead' })
  @ApiResponse({ status: 200, type: ResponseNotificationDto })
  update(
    @Request() req,
    @Body() data: UpdateNotificationDto
  ): Promise<{ count:number }> {
    const { userId } = req.user
    const { markAllRead, batchRead } = data

    const where: Prisma.NotificationWhereInput = markAllRead
    ? { userId, isRead: false }
    : { 
      userId, 
      isRead: false,  
      ...((batchRead && batchRead.length > 0) && { id: { in: batchRead } })
    };
    
    return this.notificationsService.update({
      where,
      data: { isRead: true }
    });
  }

}
