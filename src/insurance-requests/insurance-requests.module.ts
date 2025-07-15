import { Module } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { InsuranceRequestsController } from './insurance-requests.controller';

@Module({
  controllers: [InsuranceRequestsController],
  providers: [InsuranceRequestsService],
})
export class InsuranceRequestsModule {}
