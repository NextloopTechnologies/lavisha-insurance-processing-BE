import { Module } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { QueriesController } from './queries.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports:[CommonModule],
  controllers: [QueriesController],
  providers: [QueriesService],
})
export class QueriesModule {}
