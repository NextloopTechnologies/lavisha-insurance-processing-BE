import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClaimStatus, Patient, Prisma, Role } from '@prisma/client';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async create(
    data: CreatePatientDto,
    hospitalUserId: string
  ): Promise<Patient> {
    return await this.prisma.patient.create({ 
      data: {
        ...data,
        hospital: { connect: { id: hospitalUserId }}
      }
   });
  }

  async findDropdown(
    hospitalUserId: string,
    nameFilter?: string
  ): Promise<{ id: string; name: string }[]> {
    return this.prisma.patient.findMany({
      where: {
        hospitalUserId,
        ...(nameFilter && {
          name: { contains: nameFilter, mode: 'insensitive' },
        }),
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { createdAt: 'desc' },
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

  async findOne(where: { 
    id: string; 
    hospitalUserId: string 
  }) : Promise<Patient>{
    return await this.prisma.patient.findUniqueOrThrow({ 
      where
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

  async remove(where: { 
    id: string; 
    hospitalUserId: string 
  }): Promise<Patient>{
    const claimsCount = await this.prisma.insuranceRequest.count({ where: { patientId: where.id } });
    if (claimsCount>0) throw new BadRequestException("Cannot delete patient with existing claims");
    return await this.prisma.patient.delete({
      where
    })
  }
}
