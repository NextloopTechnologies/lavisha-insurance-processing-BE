import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Patient, Prisma } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.PatientCreateInput) {
    return await this.prisma.patient.create({ data });
  }

  async findDropdown(nameFilter?: string): Promise<{ id: string; name: string }[]> {
    return this.prisma.patient.findMany({
      where: nameFilter ? {
        name: { contains: nameFilter, mode: 'insensitive' }
      } : undefined,
      select: {
        id: true,
        name: true
      },
      take: 20,
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PatientWhereInput;
    orderBy?: Prisma.PatientOrderByWithRelationInput;
  }): Promise<Patient[]> {
    const { skip, take, where, orderBy } = params;
    return await this.prisma.patient.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }

  async findOne(id: string) : Promise<Patient>{
    return await this.prisma.patient.findUniqueOrThrow({ 
      where: { id } 
    });
  }

  async update(params: {
    where: Prisma.PatientWhereUniqueInput,
    data: Prisma.PatientUpdateInput
  }): Promise<Patient> {
    const { where, data } = params;
    return await this.prisma.patient.update({ 
        data, 
        where
    })
  }

  async remove(id: string): Promise<Patient>{
    return await this.prisma.patient.delete({
      where: { id }
    })
  }
}
