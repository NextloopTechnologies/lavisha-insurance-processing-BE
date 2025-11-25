import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MutateUserResponseDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'john@example.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ example: 'City Hospital' })
    @IsOptional()
    @IsString()
    hospitalName?: string;

    @ApiPropertyOptional({ example: 'https://files.example.com/profiles/fileName.jpg' })
    @IsOptional()
    @IsString()
    profileUrl?: string;

    @ApiPropertyOptional({ example: 'City Hospital' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ example: 'hospitals/fileName.pdf' })
    @IsString()
    rateListFileName?: string;

    @ApiProperty({ example: 'https://files.example.com/hospitals/fileName.pdf' })
    @IsString()
    rateListUrl?: string;

    @ApiProperty({ enum: Role, example: Role.HOSPITAL })
    @IsEnum(Role)
    role: Role; 
}