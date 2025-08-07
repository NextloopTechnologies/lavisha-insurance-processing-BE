import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Patient, Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.PatientCreateInput): Promise<Patient> {
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
  }): Promise<PaginatedResult<Patient>> {
    const { skip, take, where, orderBy } = params;
    const [total, patients] = await this.prisma.$transaction([
      this.prisma.patient.count({ where}),
      this.prisma.patient.findMany({
        skip,
        take,
        where,
        orderBy,
        include: {
          insuranceRequests: { select: { refNumber: true }}
        }
      })
    ])
    const data = patients.map((patient) => {
      const requestCount = patient.insuranceRequests.length;
      return {
        ...patient,
        insuranceRequests: undefined,
        claimCount: requestCount,
        singleClaimRefNumber: requestCount === 1 ? patient.insuranceRequests[0].refNumber : null,
      };
    });

    return { total, data }
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
