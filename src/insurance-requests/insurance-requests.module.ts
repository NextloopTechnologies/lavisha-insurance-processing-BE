import { Module } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { InsuranceRequestsController } from './insurance-requests.controller';
import { FileModule } from 'src/file/file.module';

@Module({
  imports: [FileModule],
  controllers: [InsuranceRequestsController],
  providers: [InsuranceRequestsService],
})
export class InsuranceRequestsModule {}
