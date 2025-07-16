import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { InsuranceRequest, Prisma } from '@prisma/client';
import { FindAllInsuranceRequestDto } from './dto/find-all-insurance-request.dto';

@Controller('claims')
export class InsuranceRequestsController {
  constructor(private readonly insuranceRequestsService: InsuranceRequestsService) {}

  @Post()
  create(@Body() createInsuranceRequestDto: CreateInsuranceRequestDto): Promise<InsuranceRequest> {
    return this.insuranceRequestsService.create(createInsuranceRequestDto);
  }

  @Get()
    findAll(@Query() query: FindAllInsuranceRequestDto  ) {
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
    @Param('refNumber') refNumber: string, 
    @Body() updateInsuranceRequestDto: UpdateInsuranceRequestDto
  ): Promise<InsuranceRequest|null> {
    return this.insuranceRequestsService.update({
      where: { refNumber }, 
      data: updateInsuranceRequestDto
    });
  }

  @Delete(':refNumber')
  remove(@Param('refNumber') refNumber: string) {
    return this.insuranceRequestsService.remove(refNumber);
  }
}
