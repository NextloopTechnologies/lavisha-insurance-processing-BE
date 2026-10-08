import { IsEmail, IsEnum, IsIn, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ enum: Role, example: Role.HOSPITAL })
  @IsEnum(Role)
  @IsIn([
    Role.ADMIN,
    Role.HOSPITAL,
    Role.HOSPITAL_MANAGER,
  ], { message: 'SUPERADMIN cannot be created manually' })
  role: Role;
}
