import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Request } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Patient, Prisma } from '@prisma/client';
import { FindAllPatientDto } from './dto/find-all-patient.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Patients')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients')

export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  create(
    @Request() req,
    @Body() createPatientDto: CreatePatientDto
  ): Promise<Patient> {
    const hospitalUserId = req.user.userId;
    return this.patientsService.create(createPatientDto, hospitalUserId);
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Dropdown list of patients (id & name)' })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  findDropdown(
    @Request() req,
    @Query('search') search?: string
  ): Promise<{ id: string; name: string }[]> {
    const hospitalUserId = req.user.userId;
    return this.patientsService.findDropdown(hospitalUserId, search);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of patients' })
  findAll(
    @Request() req,
    @Query() query: FindAllPatientDto
  ) {
    const { skip, take, sortBy, sortOrder, name, age } = query;
    const hospitalUserId = req.user.userId;

    const where: Prisma.PatientWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (age) where.age = Number(age);
    where.hospitalUserId = hospitalUserId

    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.patientsService.findAll({ skip, take, where, orderBy });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a patient by ID' })
  findOne(
    @Request() req,
    @Param('id') id: string
  ): Promise<Patient> {
    const hospitalUserId = req.user.userId;
    return this.patientsService.findOne({ id, hospitalUserId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a patient by ID, Refer CreatePatientDto; all fields are optional here.' })
  update(
    @Request() req,
    @Param('id') id: string, 
    @Body() updatePatientDto: UpdatePatientDto
  ): Promise<Patient> {
    const hospitalUserId = req.user.userId;
    return this.patientsService.update({
      where: { id, hospitalUserId },
      data: updatePatientDto
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a patient by ID' })
  remove(
    @Request() req,
    @Param('id') id: string
  ): Promise<Patient> {
    const hospitalUserId = req.user.userId;
    return this.patientsService.remove({ id, hospitalUserId });
  }
}
