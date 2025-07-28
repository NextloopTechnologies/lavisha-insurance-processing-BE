import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CommentType, Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto";

export class FindAllCommentsDto extends PaginationDto { 
  @ApiPropertyOptional({ enum: CommentType })
  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @ApiPropertyOptional({ example: 'insuranceRequest-uuid' })
  @IsOptional()
  @IsString()
  insuranceRequestId?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}