import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentsDto } from './dto/create-comments.dto';
import { Comment, CommentType, Prisma, Role } from '@prisma/client';
import { FindAllCommentsDto } from './dto/find-all-comments.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
    // only ADMIN and SUPERADMIN will have hospitalId else it can't be in same query with claimId 
    // hospitalId in query means they are requesting manager chats
    const isHospitalIdInQuery = hospitalId ? true : false
    if(role===Role.HOSPITAL){
      if(!insuranceRequestId) {
        throw new BadRequestException(`insuranceRequestId/claim uuid is required in query param for Role ${role}`)
      }
      if(hospitalId) {
        throw new BadRequestException(`Role ${role} can only access claim comments`)
      }
    }
    // assign hospitalId wise filter for claim based comments
    if(role === Role.HOSPITAL) hospitalIdForWhereClause = currentUserId
    else if (role === Role.HOSPITAL_MANAGER) {
      if(!loggedInUserHospitalId) throw new BadRequestException(`Assign Hospital first for role ${role}`)
      hospitalIdForWhereClause = loggedInUserHospitalId
    }
    else if(role===Role.ADMIN||role===Role.SUPER_ADMIN) hospitalIdForWhereClause = hospitalId
    // for claimId any role have to provide it to get claim based comments
    // for manager level hospitalId is needed for admin and superadmin, and type=HOSPITAL_NOTE for manager
    const where: Prisma.CommentWhereInput = {
      ...(insuranceRequestId && { insuranceRequestId }),
      ...(createdBy && { createdBy }),
      ...(hospitalIdForWhereClause && { hospitalId: hospitalIdForWhereClause }) ,
      ...(isHospitalIdInQuery && { type: CommentType.HOSPITAL_NOTE }),
      ...(type && { type })
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

  @Get('/manager_chats_unReadCount')
  @Permissions(Permission.COMMENT_MANAGER_CHAT_UNREAD_COUNT,)
  @ApiOperation({ summary: 'Get unread counts on manager chats' })
  @ApiResponse({ status: 200, description: 'count' })
  managerChatsUnReadCount(
    @Request() req
  ): Promise<{ count: number }> {
    const { userId , role, hospitalId } = req.user
    return this.commentsService.managerChatsUnReadCount({ role, userId, hospitalId })
  }

  @Get('/list_manager_comments')
  @Permissions(Permission.COMMENT_MANAGER_LIST)
  @ApiOperation({ summary: 'Get all active chats' })
  @ApiResponse({ status: 200, description: 'List of chats' })
  listHospitalsWithManagerComments() {
    return this.commentsService.listHospitalsWithManagerComments()
  }


  @Patch('mark_read')
  @ApiOperation({ summary: 'Mark comments as read based on user role and claim' })
  async markCommentsAsRead(
    @Request() req,
    @Body() body: { insuranceRequestId: string }
  ) {
    const { userId, role } = req.user;
    const { insuranceRequestId } = body;

    if (!insuranceRequestId) {
      throw new BadRequestException('insuranceRequestId is required');
    }

    return this.commentsService.markCommentsAsRead({ userId, role, insuranceRequestId });
  }



}