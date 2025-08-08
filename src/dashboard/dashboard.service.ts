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
    const claimWhere: Prisma.InsuranceRequestWhereInput= {
      patient: {
        hospitalUserId
      },
      createdAt: {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      }
    }
  
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
          hospitalUserId,
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
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

    // average settlement amount based on percentage
    const allSettlementAmounts = await this.prisma.insuranceRequest.findMany({
      where: {
        status: ClaimStatus.SETTLED,
        settlementAmount: { not: null },
        actualQuotedAmount: { not: null },
      },
      select: {
        settlementAmount: true,
        actualQuotedAmount: true
      },
    });

    const validPercentages = allSettlementAmounts
      .map(r => {
        const settled = parseFloat(r.settlementAmount);
        const quoted = parseFloat(r.actualQuotedAmount);
        if (isNaN(settled) || isNaN(quoted) || quoted === 0) return null;
        return (settled / quoted) * 100;
      })
      .filter(p => p !== null);

    const averageSettlementPercentage =
      validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length;  
      
    return {
      activeClaims,
      totalPatients,
      averageSettlementPercentage,
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
