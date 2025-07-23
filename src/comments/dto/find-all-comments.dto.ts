import { CommentType, Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto";

export class FindAllCommentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @IsOptional()
  @IsString()
  insuranceRequestId?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsEnum(Role)
  role: Role;
}