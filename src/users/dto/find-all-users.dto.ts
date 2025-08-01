import { Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "common/dto/pagination.dto"

export class FindAllUserDto extends PaginationDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    email? : string;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;
}