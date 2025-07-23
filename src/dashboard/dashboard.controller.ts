import { Controller, Get, Query,  Request,  UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FilterDashboardDto } from './dto/filter-dashboard.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('hospital')
  async getHospitalDashboard(
    @Request() req,
    @Query() query: FilterDashboardDto 
  ) {
    console.log(req.user)
    const user = req.user.userId;
    // if (req.user.role !== 'HOSPITAL') {
    //   return { message: 'Forbidden', statusCode: 403 };
    // }

    return this.dashboardService.getHospitalDashboard(user.id, query);
  }
}
