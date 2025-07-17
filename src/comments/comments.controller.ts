import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FindAllCommentsDto } from './dto/find-all-comments.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Request() req, @Body() data: CreateCommentsDto): Promise<Comment> {
    const createdBy = req.user.userId;
    return this.commentsService.create(data, createdBy)
  }

  @Get()
  findAll(@Query() query: FindAllCommentsDto): Promise<PaginatedResult<Comment>> {
    const {
      skip, take, sortBy, sortOrder,
      type, insuranceRequestId, createdBy, role
    } = query;

    const allowedTypes: Record<Role, CommentType[]> = {
      SUPER_ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE'],
      ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE'],
      HOSPITAL_MANAGER: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE'],
      HOSPITAL: ['NOTE', 'QUERY', 'TPA_REPLY'],
    };

  const where: Prisma.CommentWhereInput = {
    ...(type && { type }),
    ...(insuranceRequestId && { insuranceRequestId }),
    ...(createdBy && { createdBy }),
    type: { in: allowedTypes[role] },
  };

  const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

  return this.commentsService.findAll({ skip, take, where, orderBy });
  }
}
