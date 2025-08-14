import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
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
    const { userId:createdBy, role } = req.user;
    return this.commentsService.create(role, data, createdBy)
  }

  @Get()
  @ApiOperation({ summary: 'Find all comments (with filters & pagination)' })
  @ApiResponse({ status: 200, description: 'List of filtered comments.' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  findAll(
    @Request() req,
    @Query() query: FindAllCommentsDto
  ): Promise<Comment[]> {
    const { userId:currentUserId, role, hospitalId:loggedInUserHospitalId } = req.user
    const {
      take, cursor, type, 
      insuranceRequestId, createdBy,
      hospitalId
    } = query;
    const allowedTypes: Record<Role, CommentType[]> = {
      SUPER_ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE','SYSTEM'],
      ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE', 'SYSTEM'],
      HOSPITAL_MANAGER: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE', 'SYSTEM'],
      HOSPITAL: ['NOTE','QUERY', 'TPA_REPLY','SYSTEM'],
    };

    if(hospitalId && role===Role.HOSPITAL) throw new BadRequestException(`Permission Denied for ${role}`)

    const where: Prisma.CommentWhereInput = {
      ...(insuranceRequestId && { insuranceRequestId }),
      ...(createdBy && { createdBy }),
      ...((hospitalId && role !== Role.HOSPITAL) && { hospitalId }) ,
      type: { in: allowedTypes[role] },
    };

    return this.commentsService.findAll({ take, cursor, where, currentUserId, role, loggedInUserHospitalId });
  }

  @Patch('mark-read/:hospitalId')
  @ApiOperation({ summary: 'Mark all unread comments from a hospital as read' })
  markRead(
    @Param('hospitalId') hospitalId: string,
    @Request() req
  ) {
    if(!hospitalId) throw new BadRequestException("hospitalId is required in query!");
    const { userId: currentUserId } = req.user;
    return this.commentsService.markRead(hospitalId, currentUserId);
  }

  @Get('/list_manager_comments')
  @ApiOperation({ summary: 'Get all active chats' })
  @ApiResponse({ status: 200, description: 'List of chats' })
  listHospitalsWithManagerComments() {
    return this.commentsService.listHospitalsWithManagerComments()
  }

}