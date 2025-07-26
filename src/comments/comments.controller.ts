import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FindAllCommentsDto } from './dto/find-all-comments.dto';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags("Comments")
@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a comment' })
  @ApiBody({ type: CreateCommentsDto })
  @ApiResponse({ status: 201, description: 'Comment created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  create(@Request() req, @Body() data: CreateCommentsDto): Promise<Comment> {
    const createdBy = req.user.userId;
    return this.commentsService.create(data, createdBy)
  }

  @Get()
  @ApiOperation({ summary: 'Find all comments (with filters & pagination)' })
  @ApiQuery({ name: 'type', enum: CommentType, required: false })
  @ApiQuery({ name: 'insuranceRequestId', required: false })
  @ApiQuery({ name: 'createdBy', required: false })
  @ApiQuery({ name: 'role', enum: Role, required: true })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiResponse({ status: 200, description: 'List of filtered comments.' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  findAll(@Query() query: FindAllCommentsDto): Promise<Comment[]> {
    const {
      take, cursor, type, 
      insuranceRequestId, createdBy, role
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

    return this.commentsService.findAll({ take, cursor, where });
  }
}
