import { Injectable } from '@nestjs/common';
import { ClaimStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getHospitalDashboard(hospitalUserId: string, filter: FilterDashboardDto) {
    const { fromDate, toDate } = filter;

    // Find all patients and claims created by this hospital
    const claimWhere: Prisma.InsuranceRequestWhereInput= {}
    // const claimWhere: any = {
    //   patient: {
    //     // patients who belong to this hospital user
    //     documents: {
    //       some: {
    //         uploaderId: hospitalUserId,
    //       },
    //     },
    //   },
    // };

    claimWhere.createdAt = {
      gte: new Date(fromDate),
      lte: new Date(toDate),
    };

    // 1. Total claims, active claims and total Patients
    const [totalClaims, activeClaims, totalPatients ] = await Promise.all([
      this.prisma.insuranceRequest.count({ where: claimWhere }),
      this.prisma.insuranceRequest.count({
        where: {
          ...claimWhere,
          status: {
            notIn: [
              ClaimStatus.DRAFT,
              ClaimStatus.DENIED,
              ClaimStatus.SETTLED
            ]
          },
        },
      }),
      this.prisma.patient.count({
        where: {
          insuranceRequests: {
            some: claimWhere,
          },
        },
      })
    ])

    // 4. Status-based % counts
    const [settledCount, enhancementCount, pendingCount] = await Promise.all([
      this.prisma.insuranceRequest.count({
        where: {
          ...claimWhere,
          status: ClaimStatus.SETTLED,
        },
      }),
      this.prisma.insuranceRequest.count({
        where: {
          ...claimWhere,
          status: ClaimStatus.ENHANCEMENT,
        },
      }),
      this.prisma.insuranceRequest.count({
        where: {
          ...claimWhere,
          status: ClaimStatus.PENDING,
        },
      }),
    ]);

    const percent = (count: number) =>
      totalClaims > 0 ? ((count / totalClaims) * 100).toFixed(2) : '0.00';

    const claimsByTPA = await this.prisma.insuranceRequest.groupBy({
      by: ['tpaName'],
      where: claimWhere,
      _count: { _all: true },
    });

    const claimsByInsurance = await this.prisma.insuranceRequest.groupBy({
      by: ['insuranceCompany'],
      where: claimWhere,
      _count: { _all: true },
    });

    return {
      activeClaims,
      totalPatients,
      percentageSettled: percent(settledCount),
      percentageEnhancement: percent(enhancementCount),
      percentagePending: percent(pendingCount),
      totalClaims,
      claimsByTPA: claimsByTPA.map((t) => ({ name: t.tpaName, count: t._count._all })),
      claimsByInsuranceCompany: claimsByInsurance.map((i) => ({
        name: i.insuranceCompany,
        count: i._count._all,
      })),
    };
  }
}
