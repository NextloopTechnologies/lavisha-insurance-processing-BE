import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from 'common/dto/pagination.dto';

export class FindAllLeadsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({
    example: 'City Care',
    description: 'Matches name, hospital, phone or email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'name', 'hospital', 'status'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'hospital', 'status'])
  sortBy?: string = 'createdAt';
}
