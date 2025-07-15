import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { InsuranceRequest, Prisma } from '@prisma/client';

@Controller('insurance-requests')
export class InsuranceRequestsController {
  constructor(private readonly insuranceRequestsService: InsuranceRequestsService) {}

  @Post()
  create(@Body() createInsuranceRequestDto: CreateInsuranceRequestDto): Promise<InsuranceRequest> {
    return this.insuranceRequestsService.create(createInsuranceRequestDto);
  }

  // @Get()
  // findAll() {
  //   return this.insuranceRequestsService.findAll();
  // }

  @Get(':refNumber')
  findOne(@Param('refNumber') refNumber: string): Promise<InsuranceRequest | null> {
    return this.insuranceRequestsService.findOne({ refNumber });
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateInsuranceRequestDto: UpdateInsuranceRequestDto) {
  //   return this.insuranceRequestsService.update(+id, updateInsuranceRequestDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.insuranceRequestsService.remove(id);
  }
}
