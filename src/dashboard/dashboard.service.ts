import { Injectable } from '@nestjs/common';
import { ClaimStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';
import { percent, subtractMonths } from 'src/common/utils/general.utils';
import { CLAIM_STAGES, CLAIM_STATUS_LABELS } from 'src/common/constants/claim-status.constants';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Claim counts per status and per stage (every status belongs to one stage).
   * percentageSettled / Enhancement / Pending are kept for older clients.
   */
  async statusBreakdown(claimWhere: Prisma.InsuranceRequestWhereInput) {
    const grouped = await this.prisma.insuranceRequest.groupBy({
      by: ['status'],
      where: claimWhere,
      _count: { _all: true },
    })
    const countOf = (status: ClaimStatus) => grouped.find((g) => g.status === status)?._count._all ?? 0
    const total = grouped.reduce((sum, g) => sum + g._count._all, 0)

    const claimsByStage = CLAIM_STAGES.map((stage) => {
      const statuses = stage.statuses.map((status) => ({
        status,
        label: CLAIM_STATUS_LABELS[status],
        count: countOf(status),
      }))
      const count = statuses.reduce((sum, s) => sum + s.count, 0)
      return { key: stage.key, label: stage.label, count, percentage: percent(total, count), statuses }
    })

    return {
      claimsByStage,
      claimsByStatus: Object.values(ClaimStatus).map((status) => ({
        status,
        label: CLAIM_STATUS_LABELS[status],
        count: countOf(status),
      })),
      percentageSettled: percent(total, countOf(ClaimStatus.SETTLED)),
      percentageEnhancement: percent(total, countOf(ClaimStatus.ENHANCEMENT)),
      percentagePending: percent(total, countOf(ClaimStatus.PENDING)),
    }
  }

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

    const breakdown = await this.statusBreakdown(claimWhere);

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
      totalClaims: monthlyClaims,
      ...breakdown,
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

    const breakdown = await this.statusBreakdown(claimWhere);

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
      totalClaims,
      ...breakdown,
      claimsByTPA: claimsByTPA.map((t) => ({ name: t.tpaName, count: t._count._all })),
      claimsByInsuranceCompany: claimsByInsurance.map((i) => ({
        name: i.insuranceCompany,
        count: i._count._all,
      })),
    };
  }
}
