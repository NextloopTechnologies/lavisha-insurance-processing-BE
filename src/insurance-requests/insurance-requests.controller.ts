import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { InsuranceRequest, Prisma } from '@prisma/client';
import { FindAllInsuranceRequestDto } from './dto/find-all-insurance-request.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MutateResponseInsuranceRequestDto } from './dto/mutate-response-insurance-requests.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

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
    return this.insuranceRequestsService.create(createInsuranceRequestDto, uploadedBy);
  }

  @Get()
  @ApiOperation({ summary: 'Get all insurance requests (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of insurance requests' })
    findAll(@Query() query: FindAllInsuranceRequestDto): Promise<PaginatedResult<InsuranceRequest>> {
      const { skip, take, sortBy, sortOrder, 
        refNumber, doctorName, insuranceCompany, tpaName, assignedTo,
        patientName, status, createdFrom, createdTo
      } = query;
  
      const where: Prisma.InsuranceRequestWhereInput = {};
      if (refNumber) where.refNumber = { contains: refNumber, mode: 'insensitive' };
      if (doctorName) where.doctorName = { contains: doctorName, mode: 'insensitive' };
      if (insuranceCompany) where.insuranceCompany = { contains: insuranceCompany, mode: 'insensitive' };
      if (tpaName) where.tpaName = { contains: tpaName, mode: 'insensitive' };
      if (assignedTo) where.assignedTo = { contains: assignedTo, mode: 'insensitive' };
      if (patientName) where.patient = { name: { contains: patientName, mode: 'insensitive' } };
      if (status) where.status = status;
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
  findOne(@Param('refNumber') refNumber: string): Promise<InsuranceRequest | null> {
    return this.insuranceRequestsService.findOne({ refNumber });
  }

  @Patch(':refNumber')
  @ApiOperation({ summary: 'Update insurance request by ref number, consider Create schema with all fields as optional.' })
  @ApiResponse({ status: 201, type: MutateResponseInsuranceRequestDto })
  update(
    @Request() req,
    @Param('refNumber') refNumber: string, 
    @Body() updateInsuranceRequestDto: UpdateInsuranceRequestDto
  ): Promise<MutateResponseInsuranceRequestDto> {
    const uploadedBy = req.user.userId;
    return this.insuranceRequestsService.update({
      where: { refNumber }, 
      data: updateInsuranceRequestDto,
      uploadedBy
    });
  }

  @Delete(':refNumber')
   @ApiOperation({ summary: 'Delete insurance request by ref number' })
  @ApiParam({ name: 'refNumber', example: 'CLM-00001' })
  remove(@Param('refNumber') refNumber: string): Promise<InsuranceRequest> {
    return this.insuranceRequestsService.remove(refNumber);
  }
}
