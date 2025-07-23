import { Injectable } from '@nestjs/common';
import { ClaimStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';

@Injectable()
export class DashboardService {
    constructor(private prisma: PrismaService) {}


    async getHospitalDashboard(hospitalUserId: string, filter: FilterDashboardDto) {
    const { fromDate, toDate } = filter;

    // Find all patients and claims created by this hospital
    const patientWhere: any = {};
    const claimWhere: any = {
      patient: {
        // patients who belong to this hospital user
        documents: {
          some: {
            uploaderId: hospitalUserId,
          },
        },
      },
    };

    if (fromDate && toDate) {
      claimWhere.createdAt = {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      };
    }

    // 1. Total claims
    const totalClaims = await this.prisma.insuranceRequest.count({
      where: claimWhere,
    });

    // 2. Active claims (not settled, denied, or discharged)
    const activeClaims = await this.prisma.insuranceRequest.count({
      where: {
        ...claimWhere,
        status: {
          in: [
            ClaimStatus.PENDING,
            ClaimStatus.QUERIED,
            ClaimStatus.SENT_TO_TPA,
            ClaimStatus.ENHANCEMENT,
          ],
        },
      },
    });

    // 3. Total patients
    const totalPatients = await this.prisma.patient.count({
      where: {
        insuranceRequests: {
          some: claimWhere,
        },
      },
    });

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

    // 5. Claims by TPA
    const claimsByTPA = await this.prisma.insuranceRequest.groupBy({
      by: ['tpaName'],
      where: claimWhere,
      _count: { _all: true },
    });

    // 6. Claims by Insurance Company
    const claimsByInsurance = await this.prisma.insuranceRequest.groupBy({
      by: ['insuranceCompany'],
      where: claimWhere,
      _count: { _all: true },
    });

    return {
      totalClaims,
      activeClaims,
      totalPatients,
      percentageSettled: percent(settledCount),
      percentageEnhancement: percent(enhancementCount),
      percentagePending: percent(pendingCount),
      claimsByTPA: claimsByTPA.map((t) => ({ name: t.tpaName, count: t._count._all })),
      claimsByInsuranceCompany: claimsByInsurance.map((i) => ({
        name: i.insuranceCompany,
        count: i._count._all,
      })),
    };
}
}
