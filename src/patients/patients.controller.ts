import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Prisma } from '@prisma/client';
import { FindAllPatientDto } from './dto/find-all-patient.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(createPatientDto);
  }

  @Get('dropdown')
  findDropdown(@Query('search') search?: string) {
    return this.patientsService.findDropdown(search);
  }

  @Get()
  findAll(@Query() query: FindAllPatientDto  ) {
    const { skip, take, sortBy, sortOrder, name, age } = query;

    const where: Prisma.PatientWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (age) where.age = Number(age);

    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.patientsService.findAll({ skip, take, where, orderBy });
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePatientDto: UpdatePatientDto) {
    return this.patientsService.update({
      where: { id },
      data: updatePatientDto
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patientsService.remove(id);
  }
}
