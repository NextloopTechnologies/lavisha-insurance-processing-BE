import { Module } from '@nestjs/common';
import { EnhancementsService } from './enhancements.service';
import { EnhancementsController } from './enhancements.controller';

@Module({
  controllers: [EnhancementsController],
  providers: [EnhancementsService],
})
export class EnhancementsModule {}
