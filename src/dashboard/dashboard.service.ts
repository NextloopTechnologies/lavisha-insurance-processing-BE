import { Injectable } from '@nestjs/common';
import { ClaimStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';
import { percent, subtractMonths } from 'src/common/utils/general.utils';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async adminDashboard(
    filter: FilterDashboardDto
  ) {
    const { fromDate, toDate, hospitalUserId } = filter

    const claimWhere: Prisma.InsuranceRequestWhereInput= {
      ...(hospitalUserId ? { patient: { hospitalUserId } }: undefined),
      createdAt: {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      }
    }

    const [monthlyClaims, totalSettlements, totalPatients ] = await Promise.all([
      this.prisma.insuranceRequest.count({ where: claimWhere }),
      this.prisma.insuranceRequest.count({
        where: {
          ...claimWhere,
          status: ClaimStatus.SETTLED
        },
      }),
      this.prisma.patient.count({
        where: {
          ...(hospitalUserId ? { hospitalUserId } : undefined),
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

    const [threeMonths, sixMonths, nineMonths, oneYear] = await Promise.all([
      await this.prisma.user.count({
        where: { 
          role: Role.HOSPITAL,
          createdAt: {
            gte: subtractMonths(toDate, 3),
            lte: new Date(toDate) 
          } 
        }
      }),
      await this.prisma.user.count({
        where: { role: Role.HOSPITAL,
          createdAt: {
            gte: subtractMonths(toDate, 6),
            lte: new Date(toDate) 
          }  
        }
      }),
      await this.prisma.user.count({
        where: { role: Role.HOSPITAL,
          createdAt: {
            gte: subtractMonths(toDate, 9),
            lte: new Date(toDate) 
          }  
        }
      }),
      await this.prisma.user.count({
        where: { role: Role.HOSPITAL,
          createdAt: {
            gte: subtractMonths(toDate, 12),
            lte: new Date(toDate) 
          }  
        }
      }) 
    ])
    
    return {
      monthlyClaims,
      totalSettlements,
      totalPatients,
      percentageSettled: percent(monthlyClaims, settledCount),
      percentageEnhancement: percent(monthlyClaims, enhancementCount),
      percentagePending: percent(monthlyClaims, pendingCount),
      threeMonths,
      sixMonths,
      nineMonths,
      oneYear
    }
  }

  async hospitalDashboard(
    hospitalUserId: string, 
    filter: FilterDashboardDto
  ) {
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
        ...claimWhere,
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

    const averageSettlementPercentage = validPercentages.length 
    ? (validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length).toFixed(2)
    : "0.00";

    return {
      activeClaims,
      totalPatients,
      averageSettlementPercentage,
      percentageSettled: percent(totalClaims, settledCount),
      percentageEnhancement: percent(totalClaims, enhancementCount),
      percentagePending: percent(totalClaims, pendingCount),
      totalClaims,
      claimsByTPA: claimsByTPA.map((t) => ({ name: t.tpaName, count: t._count._all })),
      claimsByInsuranceCompany: claimsByInsurance.map((i) => ({
        name: i.insuranceCompany,
        count: i._count._all,
      })),
    };
  }
}
