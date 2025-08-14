import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CommentType, Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto";

export class FindAllCommentsDto extends PaginationDto { 
  @ApiPropertyOptional({ enum: CommentType })
  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @ApiPropertyOptional({ 
    example: 'insuranceRequest-uuid',
    description: "Required for claim level comments list" 
  })
  @IsOptional()
  @IsString()
  insuranceRequestId?: string;

  @ApiPropertyOptional({ 
    example: 'hospital-uuid',
    description: "Required for manager level comments list" 
  })
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}