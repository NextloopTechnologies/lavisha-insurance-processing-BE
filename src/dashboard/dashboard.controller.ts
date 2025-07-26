import { Controller, ForbiddenException, Get, Query,  Request,  UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';
import { Role } from '@prisma/client';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard data based on user role and date range' })
  @ApiQuery({ name: 'fromDate', type: String, example: '2024-01-01', required: true })
  @ApiQuery({ name: 'toDate', type: String, example: '2024-01-31', required: true })
  @ApiResponse({ status: 200, description: 'Dashboard data response' })
  async getDashboard(
    @Request() req,
    @Query() query: FilterDashboardDto 
  ) {
    const { userId, role } = req.user
    switch (role) {
      case Role.SUPER_ADMIN:
        return "this is super admin dashboard"
      case Role.ADMIN:
        return "this admin dashboard"
      case Role.HOSPITAL_MANAGER: 
        return this.dashboardService.getHospitalDashboard(userId, query)
      case Role.HOSPITAL: 
        return this.dashboardService.getHospitalDashboard(userId, query)
      default:
        throw new ForbiddenException("Roles not allowed")
    }
  }
}
