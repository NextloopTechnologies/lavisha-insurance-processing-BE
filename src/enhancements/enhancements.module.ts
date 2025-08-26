import { Module } from '@nestjs/common';
import { EnhancementsService } from './enhancements.service';
import { EnhancementsController } from './enhancements.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports:[CommonModule],
  controllers: [EnhancementsController],
  providers: [EnhancementsService],
})
export class EnhancementsModule {}
