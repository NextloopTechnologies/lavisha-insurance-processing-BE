import { Injectable } from '@nestjs/common';
import { CreateInsuranceRequestDto } from './dto/create-insurance-request.dto';
import { UpdateInsuranceRequestDto } from './dto/update-insurance-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { InsuranceRequest, Prisma } from '@prisma/client';

@Injectable()
export class InsuranceRequestsService {

  constructor(private prisma: PrismaService) {}

  private async generateClaimRefNumber(): Promise<string> {
    const lastClaim = await this.prisma.insuranceRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { refNumber: true },
      where: { refNumber: { startsWith: 'CLM-' } },
    });
    console.log("Last claim", lastClaim)
    const lastNumber = lastClaim?.refNumber?.split('-')[1];
    const next = lastNumber ? parseInt(lastNumber) + 1 : 1;

    return `CLM-${String(next).padStart(5, '0')}`;
  }

  async create(data: CreateInsuranceRequestDto) {
    const refNumber = await this.generateClaimRefNumber()
    return await this.prisma.insuranceRequest.create({ data : { ...data, refNumber } });
  }

  // async findAll(params: {
  //     skip?: number;
  //     take?: number;
  //     where?: Prisma.PatientWhereInput;
  //     orderBy?: Prisma.PatientOrderByWithRelationInput;
  //   }): Promise<InsuranceRequest[]> {
  //     const { skip, take, where, orderBy } = params;
  //     return await this.prisma.insuranceRequest.findMany({
  //       skip,
  //       take,
  //       where,
  //       orderBy,
  //     });
  //   }
  
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
    
    // async update(params: {
    //   where: Prisma.PatientWhereUniqueInput,
    //   data: Prisma.PatientUpdateInput
    // }): Promise<InsuranceRequest> {
    //   const { where, data } = params;
    //   return await this.prisma.insuranceRequest.update({ 
    //       data, 
    //       where
    //   })
    // }
  
    async remove(id: string): Promise<InsuranceRequest>{
      return await this.prisma.insuranceRequest.delete({
        where: { id }
      })
    }
}
