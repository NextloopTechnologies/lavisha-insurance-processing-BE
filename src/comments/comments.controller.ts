import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma, Role } from '@prisma/client';
import { FindAllCommentsDto } from './dto/find-all-comments.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

@ApiTags("Comments")
@Controller('comments')
@ApiBearerAuth('access_token')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Permissions(Permission.COMMENT_CREATE)
  @ApiOperation({ summary: 'Create a comment' })
  @ApiBody({ type: CreateCommentsDto })
  @ApiResponse({ status: 201, description: 'Comment created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  create(@Request() req, @Body() data: CreateCommentsDto): Promise<Comment> {
    const { userId:createdBy, role, hospitalId:loggedInUserHospitalId } = req.user;
    return this.commentsService.create(role, data, createdBy, loggedInUserHospitalId)
  }

  @Get()
  @Permissions(Permission.COMMENT_LIST)
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
    let hospitalIdForWhereClause:string
    const isHospitalIdInQuery = hospitalId ? true : false
    // const allowedTypes: Record<Role, CommentType[]> = {
    //   SUPER_ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE','SYSTEM'],
    //   ADMIN: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE', 'SYSTEM'],
    //   HOSPITAL_MANAGER: ['NOTE', 'QUERY', 'TPA_REPLY', 'HOSPITAL_NOTE', 'SYSTEM'],
    //   HOSPITAL: ['NOTE','QUERY', 'TPA_REPLY','SYSTEM'],
    // };
    // assign hospitalId wise filter
    if(role === Role.HOSPITAL) hospitalIdForWhereClause = currentUserId
    else if (role === Role.HOSPITAL_MANAGER) {
      if(!loggedInUserHospitalId) throw new BadRequestException(`Assign Hospital first for role ${role}`)
      hospitalIdForWhereClause = loggedInUserHospitalId
    }
    else if(role===Role.ADMIN||role===Role.SUPER_ADMIN) hospitalIdForWhereClause = hospitalId
    
    if(role===Role.HOSPITAL){
      if(!insuranceRequestId) {
        throw new BadRequestException(`insuranceRequestId/claim uuid is required in query param for Role ${role}`)
      }
      if(hospitalId) {
        throw new BadRequestException(`Role ${role} can only access claim comments`)
      }
    }

    const where: Prisma.CommentWhereInput = {
      ...(insuranceRequestId && { insuranceRequestId }),
      ...(createdBy && { createdBy }),
      ...(hospitalIdForWhereClause && { hospitalId: hospitalIdForWhereClause }) ,
      ...(isHospitalIdInQuery && { type: CommentType.HOSPITAL_NOTE })
      // type: { in: allowedTypes[role] },
    };

    return this.commentsService.findAll({ 
      take, cursor, where, 
      currentUserId, role, 
      loggedInUserHospitalId
    });
  }

  @Patch('markRead/:hospitalId')
  @Permissions(Permission.COMMENT_MARK_READ)
  @ApiOperation({ summary: 'Mark all unread comments from a hospital as read' })
  markRead(
    @Param('hospitalId') hospitalId: string,
    @Request() req
  ) {
    const { userId: currentUserId } = req.user;
    if(!hospitalId) throw new BadRequestException("hospitalId is required in query!");
    return this.commentsService.markRead(hospitalId, currentUserId);
  }

  @Get('/list_manager_comments')
  @Permissions(Permission.COMMENT_MANAGER_LIST)
  @ApiOperation({ summary: 'Get all active chats' })
  @ApiResponse({ status: 200, description: 'List of chats' })
  listHospitalsWithManagerComments() {
    return this.commentsService.listHospitalsWithManagerComments()
  }

}