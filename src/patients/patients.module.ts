import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { FileModule } from 'src/file/file.module';

@Module({
  imports:[FileModule],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
