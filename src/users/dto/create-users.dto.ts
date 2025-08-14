import { IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ 
        example: 'hospital-user-uuid', 
        required: false,
        description: 'Required if role is HOSPITAL_MANAGER'
    })
    @ValidateIf(o => o.role === Role.HOSPITAL_MANAGER)
    @IsString({ message: 'hospitalId must be provided if role is HOSPITAL_MANAGER' })
    hospitalId?: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'john@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({ example: 'City Hospital' })
    @IsOptional()
    @IsString()
    hospitalName?: string;

    @ApiPropertyOptional({ example: 'profiles/fileName.jpg' })
    @IsOptional()
    @IsString()
    profileFileName?: string;

    @ApiPropertyOptional({ example: 'https://files.example.com/profiles/fileName.jpg' })
    @IsOptional()
    @IsString()
    profileUrl?: string;

    @ApiPropertyOptional({ example: 'City Hospital' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ 
        example: 'hospitals/fileName.pdf',
        required: false,
        description: 'Required if role is HOSPITAL'
    })
    @ValidateIf(o => o.role === Role.HOSPITAL)
    @IsString({ message: 'rateListFileName must be provided if role is HOSPITAL' })
    rateListFileName?: string;

    @ApiProperty({ enum: Role, example: Role.HOSPITAL })
    @IsEnum(Role)
    role: Role; 
}