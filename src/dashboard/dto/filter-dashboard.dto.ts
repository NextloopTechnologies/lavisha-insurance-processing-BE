import { IsOptional, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterDashboardDto {
  @IsOptional()
  @Type(() => Date)
  @IsISO8601()
  fromDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsISO8601()
  toDate?: Date;
}
