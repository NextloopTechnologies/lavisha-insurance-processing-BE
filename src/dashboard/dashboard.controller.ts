import { BadRequestException, Controller, ForbiddenException, Get, Query,  Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/permissions/permissions.decorator';
import { Permission } from 'src/auth/permissions/permissions.enum';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth('access_token')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Permissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'Get dashboard data based on user role and date range' })
  @ApiQuery({ name: 'fromDate', type: String, example: '2024-01-01', required: true })
  @ApiQuery({ name: 'toDate', type: String, example: '2024-01-31', required: true })
  @ApiResponse({ status: 200, description: 'Dashboard data response' })
  async getDashboard(
    @Request() req,
    @Query() query: FilterDashboardDto 
  ) {
    const { userId: currentUserId, role, hospitalId } = req.user
    let hospitalUserId;
    switch (role) {
      case Role.SUPER_ADMIN:
        return this.dashboardService.adminDashboard(query)
      case Role.ADMIN:
        return this.dashboardService.adminDashboard(query)
      case Role.HOSPITAL_MANAGER: 
        hospitalUserId = hospitalId
        if(!hospitalUserId) throw new BadRequestException("Invalid HospitalID!")
        return this.dashboardService.hospitalDashboard(hospitalUserId, query)
      case Role.HOSPITAL: 
        hospitalUserId = currentUserId
        return this.dashboardService.hospitalDashboard(hospitalUserId, query)
      default:
        throw new ForbiddenException("Roles not allowed")
    }
  }
}
