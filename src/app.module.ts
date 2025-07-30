import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PatientsModule } from './patients/patients.module';
import { FileModule } from './file/file.module';
import { InsuranceRequestsModule } from './insurance-requests/insurance-requests.module';
import { CommentsModule } from './comments/comments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { EnhancementsModule } from './enhancements/enhancements.module';
import { QueriesModule } from './queries/queries.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    AuthModule, 
    UsersModule,
    PrismaModule, 
    PatientsModule,
    FileModule,
    InsuranceRequestsModule,
    CommentsModule,
    DashboardModule,
    DocumentsModule,
    EnhancementsModule,
    QueriesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
