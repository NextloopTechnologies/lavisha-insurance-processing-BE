import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClaimStatus, Patient, Prisma, Role } from '@prisma/client';

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
  }) {
    const { skip, take, where, orderBy } = params;
    const [total, patients] = await this.prisma.$transaction([
      this.prisma.patient.count({ where}),
      this.prisma.patient.findMany({
        skip,
        take,
        where,
        orderBy,
        include: {
          insuranceRequests: { select: { refNumber: true , status: true }}
        }
      })
    ])
    const data = patients.map((patient) => {
      const requestCount = patient.insuranceRequests.length;
      const singleClaim = requestCount === 1 ? patient.insuranceRequests[0] : null;

      return {
        ...patient,
        insuranceRequests: undefined,
        claimCount: requestCount,
        singleClaimRefNumber: singleClaim?.refNumber ?? null,
        isClaimStatusDraft: singleClaim?.status === ClaimStatus.DRAFT
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
