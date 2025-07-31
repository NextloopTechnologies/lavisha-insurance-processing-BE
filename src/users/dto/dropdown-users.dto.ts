import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class DropdownUsersDto {
    @ApiPropertyOptional({ example: "Sam"})
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: Role, example: Role.HOSPITAL})
    @IsOptional()
    @IsEnum(Role)
    role?: Role;
}

export class DropdownUsersResponseDto {
    @ApiProperty({ example: "uuid"})
    @IsString()
    id: string;

    @ApiProperty({ example: "City Hospital"})
    @IsString()
    name: string;
}