import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { InsuranceRequest, Prisma } from '@prisma/client';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Injectable()
export class InsuranceRequestsService {

  constructor(private prisma: PrismaService) {}

  private async generateClaimRefNumber(): Promise<string> {
    const lastClaim = await this.prisma.insuranceRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { refNumber: true },
      where: { refNumber: { startsWith: 'CLM-' } },
    });
    const lastNumber = lastClaim?.refNumber?.split('-')[1];
    const next = lastNumber ? parseInt(lastNumber) + 1 : 1;
    return `CLM-${String(next).padStart(5, '0')}`;
  }

  async create(data: CreateInsuranceRequestDto): Promise<InsuranceRequest> {
    const { patientId, ...rest } = data;
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new BadRequestException('Invalid patient ID');

    const refNumber = await this.generateClaimRefNumber();
    return await this.prisma.insuranceRequest.create({ 
      data : { 
        ...rest, 
        patient: { connect: { id: patientId }}, 
        refNumber 
      }
    });
  }

  async findAll(params: {
      skip?: number;
      take?: number;
      where?: Prisma.InsuranceRequestWhereInput;
      orderBy?: Prisma.InsuranceRequestOrderByWithRelationInput;
    }): Promise<PaginatedResult<InsuranceRequest>> {
      const { skip, take, where, orderBy } = params;
      const [total, data] = await this.prisma.$transaction([
        this.prisma.insuranceRequest.count( { where}),
        this.prisma.insuranceRequest.findMany({
          skip,
          take,
          where,
          orderBy,
          include: {
            patient: { select: { id: true, name: true }},
            documents: true,
            enhancements: true,
            comments: true
          }
        })
      ])
      return { total, data } 
    }
  
    async findOne(
      insuranceRequestWhereUniqueInput: Prisma.InsuranceRequestWhereUniqueInput
    ) : Promise<InsuranceRequest | null> {
      return await this.prisma.insuranceRequest.findUniqueOrThrow({ 
        where: insuranceRequestWhereUniqueInput,
        include: {
          patient: { select: { id: true, name: true }},
          documents: true,
          enhancements: true,
          comments: true
        }
      });
    }
    
    async update(params: {
      where: Prisma.InsuranceRequestWhereUniqueInput,
      data: UpdateInsuranceRequestDto
    }): Promise<InsuranceRequest> {
  
      const { where, data } = params;
      const { patientId, ...rest } = data;
      const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new BadRequestException('Invalid patient ID');

      return await this.prisma.insuranceRequest.update({
        where,
        data: {
          ...rest,
          patient: { connect: { id: patientId }}
        },
      });
    }
  
    async remove(refNumber: string): Promise<InsuranceRequest>{
      return await this.prisma.insuranceRequest.delete({
        where: { refNumber }
      })
    }
}
