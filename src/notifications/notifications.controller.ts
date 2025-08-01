import { Controller, Get, Body, Patch, Param, UseGuards, Request, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FindAllNotificationsDto } from './dto/find-all-notification.dto';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { ResponseNotificationDto } from './dto/response-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Controller('notifications')
@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
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
  @ApiOperation({ summary: 'Update notification by isRead' })
  @ApiResponse({ status: 200, type: ResponseNotificationDto })
  update(
    @Param('id') id: string, 
    @Body() updateNotificationDto: UpdateNotificationDto
  ): Promise<ResponseNotificationDto> {
    return this.notificationsService.update({
      where: { id },
      data: updateNotificationDto
    });
  }

}
