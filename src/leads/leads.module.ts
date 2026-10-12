import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsKeyGuard } from './leads-key.guard';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadsKeyGuard],
})
export class LeadsModule {}
