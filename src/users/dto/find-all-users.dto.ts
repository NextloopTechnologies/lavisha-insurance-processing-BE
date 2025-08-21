import { Role } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";
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
    @IsIn([
        Role.ADMIN,
        Role.HOSPITAL,
        Role.HOSPITAL_MANAGER,
    ], { message: 'SUPERADMIN cannot be created manually' })
    role?: Role;
}