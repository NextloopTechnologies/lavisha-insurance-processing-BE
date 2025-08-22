import { Controller, Get, Body, Patch, Param, Request, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindAllNotificationsDto } from './dto/find-all-notification.dto';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { ResponseNotificationDto } from './dto/response-notification.dto';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

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

    const { skip, take, sortBy, sortOrder, isRead } = query
    if (typeof isRead !== 'undefined') {
      where.isRead = isRead === 'true';
    }
    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.notificationsService.findAll({ skip, take, where, orderBy });
  }

  @Patch(':id')
  @Permissions(Permission.NOTIFICATION_MARK_READ)
  @ApiOperation({ summary: 'Update notification by isRead' })
  @ApiResponse({ status: 200, type: ResponseNotificationDto })
  update(
    @Param('id') id: string
  ): Promise<ResponseNotificationDto> {

    return this.notificationsService.update({
      where: { id },
      data: { isRead: true }
    });
  }

}
