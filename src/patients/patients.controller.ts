import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, BadRequestException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Patient, Prisma, Role } from '@prisma/client';
import { FindAllPatientDto } from './dto/find-all-patient.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

@ApiTags('Patients')
@ApiBearerAuth('access_token')
@Controller('patients')

export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Permissions(Permission.PATIENT_CREATE)
  @ApiOperation({ summary: 'Create a patient' })
  @ApiResponse({ status: 201, description: 'Patient created successfully' })
  create(
    @Request() req,
    @Body() createPatientDto: CreatePatientDto
  ): Promise<Patient> {
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = currentUserId
    else if(role===Role.HOSPITAL_MANAGER) {
      if(!hospitalId) throw new BadRequestException(`${role} should have hospitalId`)
      hospitalUserId = hospitalId
    }
    return this.patientsService.create(createPatientDto, hospitalUserId);
  }

  @Get('dropdown')
  @Permissions(Permission.PATIENT_LIST)
  @ApiOperation({ summary: 'Dropdown list of patients (id & name)' })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  findDropdown(
    @Request() req,
    @Query('search') search?: string
  ): Promise<{ id: string; name: string }[]> {
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = currentUserId
    else if(role===Role.HOSPITAL_MANAGER) {
      if(!hospitalId) throw new BadRequestException(`${role} should have hospitalId`)
      hospitalUserId = hospitalId
    }
    return this.patientsService.findDropdown(hospitalUserId, search);
  }

  @Get()
  @Permissions(Permission.PATIENT_LIST)
  @ApiOperation({ summary: 'Get paginated list of patients' })
  findAll(
    @Request() req,
    @Query() query: FindAllPatientDto
  ) {
    const { skip, take, sortBy, sortOrder, name, age } = query;
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = currentUserId
    else if(role===Role.HOSPITAL_MANAGER) {
      if(!hospitalId) throw new BadRequestException(`${role} should have hospitalId`)
      hospitalUserId = hospitalId
    }

    const where: Prisma.PatientWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (age) where.age = Number(age);
    where.hospitalUserId = hospitalUserId

    const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

    return this.patientsService.findAll({ skip, take, where, orderBy });
  }

  @Get(':id')
  @Permissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Get a patient by ID' })
  findOne(
    @Request() req,
    @Param('id') id: string
  ): Promise<Patient> {
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = currentUserId
    else if(role===Role.HOSPITAL_MANAGER) {
      if(!hospitalId) throw new BadRequestException(`${role} should have hospitalId`)
      hospitalUserId = hospitalId
    }
    return this.patientsService.findOne({ id, hospitalUserId });
  }

  @Patch(':id')
  @Permissions(Permission.PATIENT_UPDATE)
  @ApiOperation({ summary: 'Update a patient by ID, Refer CreatePatientDto; all fields are optional here.' })
  update(
    @Request() req,
    @Param('id') id: string, 
    @Body() updatePatientDto: UpdatePatientDto
  ): Promise<Patient> {
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = currentUserId
    else if(role===Role.HOSPITAL_MANAGER) {
      if(!hospitalId) throw new BadRequestException(`${role} should have hospitalId`)
      hospitalUserId = hospitalId
    }
    return this.patientsService.update({
      where: { id, hospitalUserId },
      data: updatePatientDto
    });
  }

  @Delete(':id')
  @Permissions(Permission.PATIENT_DELETE)
  @ApiOperation({ summary: 'Delete a patient by ID' })
  remove(
    @Request() req,
    @Param('id') id: string
  ): Promise<Patient> {
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId:string

    if(role===Role.HOSPITAL) hospitalUserId = currentUserId
    else if(role===Role.HOSPITAL_MANAGER) {
      if(!hospitalId) throw new BadRequestException(`${role} should have hospitalId`)
      hospitalUserId = hospitalId
    }
    return this.patientsService.remove({ id, hospitalUserId });
  }
}
