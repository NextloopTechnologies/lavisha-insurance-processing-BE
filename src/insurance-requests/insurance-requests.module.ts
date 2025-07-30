import { Module } from '@nestjs/common';
import { InsuranceRequestsService } from './insurance-requests.service';
import { InsuranceRequestsController } from './insurance-requests.controller';
import { FileModule } from 'src/file/file.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [FileModule,CommonModule],
  controllers: [InsuranceRequestsController],
  providers: [InsuranceRequestsService],
})
export class InsuranceRequestsModule {}
