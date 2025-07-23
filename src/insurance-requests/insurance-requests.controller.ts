import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { InsuranceRequest, Prisma } from '@prisma/client';
import { FindAllInsuranceRequestDto } from './dto/find-all-insurance-request.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MutateResponseInsuranceRequestDto } from './dto/mutate-response-insurance-requests.dto';

@Controller('claims')
@UseGuards(JwtAuthGuard)
export class InsuranceRequestsController {
  constructor(private readonly insuranceRequestsService: InsuranceRequestsService) {}

  @Post()
  create(
    @Request() req,
    @Body() createInsuranceRequestDto: CreateInsuranceRequestDto
  ): Promise<MutateResponseInsuranceRequestDto> {
    const uploadedBy = req.user.userId;
    return this.insuranceRequestsService.create(createInsuranceRequestDto, uploadedBy);
  }

  @Get()
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
  findOne(@Param('refNumber') refNumber: string): Promise<InsuranceRequest | null> {
    return this.insuranceRequestsService.findOne({ refNumber });
  }

  @Patch(':refNumber')
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
  remove(@Param('refNumber') refNumber: string): Promise<InsuranceRequest> {
    return this.insuranceRequestsService.remove(refNumber);
  }
}
