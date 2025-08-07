import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Patient, Prisma } from '@prisma/client';
import { FindAllPatientDto } from './dto/find-all-patient.dto';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiProperty, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Patients')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients')

export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  create(@Body() createPatientDto: CreatePatientDto): Promise<Patient> {
    return this.patientsService.create(createPatientDto);
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Dropdown list of patients (id & name)' })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  findDropdown(@Query('search') search?: string): Promise<{ id: string; name: string }[]> {
    return this.patientsService.findDropdown(search);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of patients' })
  findAll(@Query() query: FindAllPatientDto) {
    const { skip, take, sortBy, sortOrder, name, age } = query;

    const where: Prisma.PatientWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (age) where.age = Number(age);

    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.patientsService.findAll({ skip, take, where, orderBy });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a patient by ID' })
  findOne(@Param('id') id: string): Promise<Patient> {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a patient by ID, Refer CreatePatientDto; all fields are optional here.' })
  update(@Param('id') id: string, @Body() updatePatientDto: UpdatePatientDto): Promise<Patient> {
    return this.patientsService.update({
      where: { id },
      data: updatePatientDto
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a patient by ID' })
  remove(@Param('id') id: string): Promise<Patient> {
    return this.patientsService.remove(id);
  }
}
