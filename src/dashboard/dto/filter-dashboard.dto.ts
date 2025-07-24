import { IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterDashboardDto {
  @Type(() => Date)
  @IsDate()
  fromDate: Date;

  @Type(() => Date)
  @IsDate()
  toDate: Date;
}
