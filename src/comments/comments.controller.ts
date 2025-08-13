import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FindAllCommentsDto } from './dto/find-all-comments.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags("Comments")
@Controller('comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
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
  @ApiResponse({ status: 200, description: 'List of filtered comments.' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  findAll(
    @Request() req,
    @Query() query: FindAllCommentsDto
  ): Promise<Comment[]> {
    const { role } = req.user
    const {
      take, cursor, type, 
      insuranceRequestId, createdBy,
      hospitalId
    } = query;
    // let commentType = type ?? undefined
    const allowedTypes: Record<Role, CommentType[]> = {
      SUPER_ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE','SYSTEM'],
      ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE', 'SYSTEM'],
      HOSPITAL_MANAGER: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE', 'SYSTEM'],
      HOSPITAL: ['NOTE','QUERY', 'TPA_REPLY','SYSTEM'],
    };

    // if(commentType===CommentType.HOSPITAL_NOTE && role===Role.HOSPITAL) {
    //   commentType= undefined
    // }

    const where: Prisma.CommentWhereInput = {
      ...(type && { type }),
      ...(insuranceRequestId && { insuranceRequestId }),
      ...(createdBy && { createdBy }),
      ...((hospitalId && role !== Role.HOSPITAL) && { hospitalId }) ,
      type: { in: allowedTypes[role] },
    };

    return this.commentsService.findAll({ take, cursor, where });
  }

  @Get('/list_manager_comments')
  @ApiOperation({ summary: 'Get all active chats' })
  @ApiResponse({ status: 200, description: 'List of chats' })
  listHospitalsWithManagerComments() {
    return this.commentsService.listHospitalsWithManagerComments()
  }
}
