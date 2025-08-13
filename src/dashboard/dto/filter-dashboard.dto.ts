import { IsDate, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterDashboardDto {
  @ApiProperty({ example: '2024-01-01', description: 'Start date (YYYY-MM-DD)' })
  @Type(() => Date)
  @IsDate()
  fromDate: Date;

  @ApiProperty({ example: '2024-01-31', description: 'End date (YYYY-MM-DD)' })
  @Type(() => Date)
  @IsDate()
  toDate: Date;

  @ApiPropertyOptional({ example: "hospital user uuid"})
  @IsOptional()
  @IsString()
  hospitalUserId?: string
}
