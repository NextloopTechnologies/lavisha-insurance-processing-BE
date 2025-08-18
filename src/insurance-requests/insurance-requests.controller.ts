import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { InsuranceRequest, Prisma, Role } from '@prisma/client';
import { FindAllInsuranceRequestDto } from './dto/find-all-insurance-request.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MutateResponseInsuranceRequestDto } from './dto/mutate-response-insurance-requests.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AddAssigneeInsuranceRequestDto } from './dto/assign-insurance-requests.dto';

@Controller('claims')
@ApiTags('Claims')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access_token')
export class InsuranceRequestsController {
  constructor(private readonly insuranceRequestsService: InsuranceRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an insurance request' })
  @ApiBody({ type: CreateInsuranceRequestDto })
  @ApiResponse({ status: 201, type: MutateResponseInsuranceRequestDto })
  create(
    @Request() req,
    @Body() createInsuranceRequestDto: CreateInsuranceRequestDto
  ): Promise<MutateResponseInsuranceRequestDto> {
    const uploadedBy = req.user.userId;
    const userName = req.user.name;
    return this.insuranceRequestsService.create(createInsuranceRequestDto, uploadedBy, userName);
  }

  @Get()
  @ApiOperation({ summary: 'Get all insurance requests (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of insurance requests' })
  findAll(
    @Request() req,
    @Query() query: FindAllInsuranceRequestDto
  ): Promise<PaginatedResult<InsuranceRequest>> {
    const { userId, role, hospitalId } = req.user
    const { skip, take, sortBy, sortOrder, 
      refNumber, doctorName, insuranceCompany, tpaName, assigneeName,
      patientName, status, createdFrom, createdTo
    } = query;
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = userId
    else if(role===Role.HOSPITAL_MANAGER) hospitalUserId = hospitalId

    const where: Prisma.InsuranceRequestWhereInput = {};
    if(![Role.SUPER_ADMIN, Role.ADMIN].includes(role)) where.patient = { hospitalUserId }
    if (refNumber) where.refNumber = { contains: refNumber, mode: 'insensitive' };
    if (doctorName) where.doctorName = { contains: doctorName, mode: 'insensitive' };
    if (insuranceCompany) where.insuranceCompany = { contains: insuranceCompany, mode: 'insensitive' };
    if (tpaName) where.tpaName = { contains: tpaName, mode: 'insensitive' };
    if (assigneeName) where.user = { name: { contains: assigneeName, mode: 'insensitive' }};
    if (patientName) where.patient = { name: { contains: patientName, mode: 'insensitive' }};
    if (status  && status.length > 0) where.status = { in: status };
    if (createdFrom || createdTo) {
      where.createdAt = {
        ...(createdFrom && { gte: new Date(createdFrom) }),
        ...(createdTo && { lte: new Date(createdTo) }),
      };
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.insuranceRequestsService.findAll({ skip, take, where, orderBy });
  }
  

  @Get(':refNumber')
  @ApiOperation({ summary: 'Get one insurance request by ref number' })
  @ApiParam({ name: 'refNumber', example: 'CLM-00001' })
  @ApiResponse({ status: 200, description: 'Insurance request detail' })
  findOne(
    @Request() req,
    @Param('refNumber') refNumber: string
  ): Promise<InsuranceRequest | null> {
    const { userId:hospitalUserId, role } = req.user

    return this.insuranceRequestsService.findOne({
      refNumber,
      ...(![Role.SUPER_ADMIN, Role.ADMIN].includes(role) ? { patient: { hospitalUserId }} : undefined )
    })
  }

  @Patch('assign/:refNumber')
  @ApiOperation({ summary: 'Assign claim by ref number and assignee id' })
  @ApiResponse({ status: 200 })
  assignClaim(
    @Request() req,
    @Param('refNumber') refNumber: string, 
    @Body() addAssigneeInsuranceRequestDto: AddAssigneeInsuranceRequestDto
  ): Promise<Partial<InsuranceRequest>>| string{
    const { userId, role, name:userName } = req.user;
    if(![Role.SUPER_ADMIN, Role.ADMIN].includes(role)) return "Permission Denied!"
    return this.insuranceRequestsService.assignClaim({
      where: { 
        refNumber
      }, 
      data: addAssigneeInsuranceRequestDto,
      userId,
      userName
    });
  }

  @Patch(':refNumber')
  @ApiOperation({ summary: 'Update insurance request by ref number, consider Create schema with all fields as optional.' })
  @ApiResponse({ status: 200, type: MutateResponseInsuranceRequestDto })
  update(
    @Request() req,
    @Param('refNumber') refNumber: string, 
    @Body() updateInsuranceRequestDto: UpdateInsuranceRequestDto
  ): Promise<MutateResponseInsuranceRequestDto> {
    const { userId: uploadedBy, name: userName, role } = req.user;
    return this.insuranceRequestsService.update({
      where: { 
        refNumber,
        ...(![Role.SUPER_ADMIN, Role.ADMIN].includes(role) ? { patient: { hospitalUserId: uploadedBy }} : undefined )
      }, 
      data: updateInsuranceRequestDto,
      uploadedBy,
      userName,
    });
  }

  @Delete(':refNumber')
  @ApiOperation({ summary: 'Delete insurance request by ref number' })
  @ApiParam({ name: 'refNumber', example: 'CLM-00001' })
  remove(@Param('refNumber') refNumber: string) {
    return this.insuranceRequestsService.remove(refNumber);
  }
}
 